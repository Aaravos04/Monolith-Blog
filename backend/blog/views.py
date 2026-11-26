"""Function-based API views for Monolith. urls.py lists every URL.

Pattern used by every view:
    @api_view([...])            which HTTP methods it accepts
    @permission_classes([...])  who may call it
    def view(request, ...):     read request, do the work, return a Response
"""
import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes,
)
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import (
    AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly,
)
from rest_framework.response import Response

from .models import Blog, Bookmark, Comment, Follow, Like, Notification
from .serializers import (
    AuthUserSerializer, AvatarSerializer, BlogSerializer, BlogWriteSerializer,
    CommentSerializer, FollowerSerializer, FollowingSerializer,
    ForgotPasswordSerializer, LikerSerializer, LoginSerializer, MeSerializer,
    NotificationSerializer, PublicProfileSerializer, RegisterSerializer,
    ReportSerializer, ResetPasswordSerializer,
)
from .services import notify_comment, notify_follow, notify_like
from .utils import (
    BadRequest, active_users, annotate_blogs, annotate_profiles, followers_of,
    following_of, paginate, public_blogs, saved_blogs,
)

logger = logging.getLogger(__name__)
User = get_user_model()

FEEDS = ("latest", "following", "recommended")
SEARCH_FIELDS = ("title", "content", "author")
RECOMMENDED_POOL = 200  # the recommended feed ranks the newest 200 published blogs


# ==========================================================================
# Small helpers
# ==========================================================================
def serialize(serializer_class, request, instance, many=False):
    return serializer_class(instance, many=many, context={"request": request}).data


def get_visible_blog(request, pk):
    """The blog if the requester may see it, otherwise 404.

    Published blogs are public. A draft is visible only to its author, and
    everyone else gets a 404 (we don't reveal that it exists).
    """
    user = request.user
    visible = Q(status=Blog.Status.PUBLISHED, author__is_active=True)
    if user.is_authenticated:
        visible |= Q(author=user, status=Blog.Status.DRAFT)
    return get_object_or_404(annotate_blogs(Blog.objects.filter(visible), user), pk=pk)


def blog_json(request, pk):
    """A freshly annotated blog, serialized (used after create / update)."""
    blog = annotate_blogs(Blog.objects.filter(pk=pk), request.user).get()
    return serialize(BlogSerializer, request, blog)


def auth_payload(request, user):
    """{token, user}: what login and register answer with."""
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "user": serialize(AuthUserSerializer, request, user)}


# ==========================================================================
# Auth   /auth/...
# ==========================================================================
# authentication_classes([]) = ignore any old token the browser may still send,
# so a stale login can't block someone from logging in again.
@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(auth_payload(request, user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"].strip()
    # Usernames are unique ignoring case, so "Asha" and "asha" are the same person.
    canonical = (
        User.objects.filter(username__iexact=username)
        .values_list("username", flat=True)
        .first()
    )
    # authenticate() also returns None for suspended / closed (inactive) accounts.
    user = authenticate(
        request=request,
        username=canonical or username,
        password=serializer.validated_data["password"],
    )
    if user is None:
        raise BadRequest("Wrong username or password, or the account is disabled.")
    update_last_login(None, user)
    return Response(auth_payload(request, user))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    request.auth.delete()  # request.auth is the token used for this request
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def forgot_password(request):
    """Always answers the same way, so nobody can find out which emails have accounts."""
    serializer = ForgotPasswordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"]

    reset_url = getattr(
        settings, "PASSWORD_RESET_URL", "http://localhost:5173/reset-password"
    )
    for user in User.objects.filter(email__iexact=email, is_active=True):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        try:
            send_mail(
                subject="Reset your Monolith password",
                message=(
                    f"Hi {user.get_username()},\n\n"
                    f"Use this link to choose a new password:\n"
                    f"{reset_url}?uid={uid}&token={token}\n\n"
                    "If you didn't ask for this, you can ignore this email."
                ),
                from_email=None,  # uses DEFAULT_FROM_EMAIL
                recipient_list=[user.email],
            )
        except Exception:
            # Don't tell the caller (that would reveal the account exists), but log it.
            logger.exception("Could not send the password reset email")

    return Response(
        {"detail": "If an account with that email exists, a reset link has been sent."}
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def reset_password(request):
    """Body: {uid, token, new_password}, taken from the emailed link."""
    serializer = ResetPasswordSerializer(data=request.data)
    print(serializer)
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data["user"]
    user.set_password(serializer.validated_data["new_password"])
    user.save(update_fields=["password"])
    Token.objects.filter(user=user).delete()  # sign the user out everywhere
    return Response({"detail": "Password has been reset."})


# ==========================================================================
# Blogs   /blogs/...
# ==========================================================================
def recommended(request, queryset):
    """Recommended feed: popular but fresh.

    score = (likes + 2 x comments + 1) / (age_in_days + 2) ^ 1.5, ties go to the newest.
    Skips the viewer's own blogs and ones they already liked. Works logged out too.
    """
    user = request.user
    if user.is_authenticated:
        liked = Like.objects.filter(user=user).values("blog_id")
        queryset = queryset.exclude(author=user).exclude(pk__in=liked)

    candidates = list(queryset.order_by("-published_at", "-id")[:RECOMMENDED_POOL])
    now = timezone.now()

    def score(blog):
        published = blog.published_at or blog.created_at
        age_days = (now - published).total_seconds() / 86400
        return (blog.likes_count + 2 * blog.comments_count + 1) / (age_days + 2) ** 1.5

    candidates.sort(
        key=lambda blog: (score(blog), blog.published_at or blog.created_at),
        reverse=True,
    )
    return paginate(request, candidates, BlogSerializer)


def list_blogs(request):
    """GET /blogs/?feed=latest|following|recommended&page="""
    feed = request.query_params.get("feed") or "latest"
    if feed not in FEEDS:
        raise BadRequest("feed must be latest, following or recommended.")
    user = request.user
    queryset = annotate_blogs(public_blogs(), user)

    if feed == "recommended":
        return recommended(request, queryset)
    if feed == "following":
        if not user.is_authenticated:
            raise NotAuthenticated()
        followed = Follow.objects.filter(follower=user).values("following_id")
        queryset = queryset.filter(author_id__in=followed)
    return paginate(request, queryset.order_by("-published_at", "-id"), BlogSerializer)


def create_blog(request):
    """POST /blogs/  (multipart form: title, body, status, cover_image)"""
    serializer = BlogWriteSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    blog = serializer.save()
    return Response(blog_json(request, blog.pk), status=status.HTTP_201_CREATED)


# GET is public; POST needs a login.
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticatedOrReadOnly])
def blogs(request):
    if request.method == "POST":
        return create_blog(request)
    return list_blogs(request)


@api_view(["GET"])
@permission_classes([AllowAny])
def search_blogs(request):
    """GET /blogs/search/?q=&by=title|content|author&page="""
    query = request.query_params.get("q", "").strip()
    field = request.query_params.get("by") or "title"
    if field not in SEARCH_FIELDS:
        raise BadRequest("by must be title, content or author.")

    queryset = annotate_blogs(public_blogs(), request.user).order_by("-published_at", "-id")
    if not query:
        queryset = queryset.none()
    elif field == "title":
        queryset = queryset.filter(title__icontains=query)
    elif field == "content":
        queryset = queryset.filter(body__icontains=query)
    else:
        queryset = queryset.filter(
            Q(author__username__icontains=query)
            | Q(author__first_name__icontains=query)
            | Q(author__last_name__icontains=query)
        )
    return paginate(request, queryset, BlogSerializer)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_blogs(request):
    """GET /blogs/mine/?status=published|draft  (a plain list, not paginated)"""
    wanted = request.query_params.get("status")
    if wanted and wanted not in (Blog.Status.PUBLISHED, Blog.Status.DRAFT):
        raise BadRequest("status must be published or draft.")
    statuses = [wanted] if wanted else [Blog.Status.DRAFT, Blog.Status.PUBLISHED]
    queryset = annotate_blogs(
        Blog.objects.filter(author=request.user, status__in=statuses), request.user
    ).order_by("-created_at", "-id")
    return Response(serialize(BlogSerializer, request, queryset, many=True))


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticatedOrReadOnly])
def blog_detail(request, pk):
    blog = get_visible_blog(request, pk)
    if request.method == "GET":
        return Response(serialize(BlogSerializer, request, blog))

    if blog.author_id != request.user.id:
        raise PermissionDenied("Only the author can change or delete this blog.")
    if request.method == "DELETE":
        blog.delete()  # also deletes its comments, likes, bookmarks and notifications
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = BlogWriteSerializer(
        blog, data=request.data, partial=True, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(blog_json(request, blog.pk))


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticatedOrReadOnly])
def blog_comments(request, pk):
    """GET: all visible comments, oldest first (a plain list). POST {body}: add one."""
    blog = get_object_or_404(public_blogs(), pk=pk)  # only published blogs have comments

    if request.method == "GET":
        comments = (
            Comment.objects.filter(
                blog=blog, status=Comment.Status.VISIBLE, author__is_active=True
            )
            .select_related("author", "author__profile")
            .order_by("created_at", "id")
        )
        return Response(serialize(CommentSerializer, request, comments, many=True))

    serializer = CommentSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    comment = serializer.save(author=request.user, blog=blog)
    notify_comment(request.user, blog)
    return Response(serialize(CommentSerializer, request, comment), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def comment_detail(request, pk, comment_id):
    """Only the person who wrote the comment can delete it."""
    blog = get_object_or_404(public_blogs(), pk=pk)
    comment = get_object_or_404(
        Comment.objects.filter(blog=blog, status=Comment.Status.VISIBLE), pk=comment_id
    )
    if comment.author_id != request.user.id:
        raise PermissionDenied("You can only delete your own comments.")
    comment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# Likes and bookmarks (published blogs only; repeating a request is harmless)
# --------------------------------------------------------------------------
@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def blog_like(request, pk):
    """POST = like, DELETE = unlike. Answers {liked, likes_count}."""
    blog = get_object_or_404(public_blogs(), pk=pk)
    if request.method == "POST":
        _, created = Like.objects.get_or_create(user=request.user, blog=blog)
        if created:
            notify_like(request.user, blog)
    else:
        Like.objects.filter(user=request.user, blog=blog).delete()
    return Response(
        {
            "liked": request.method == "POST",
            "likes_count": Like.objects.filter(blog=blog).count(),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def blog_likers(request, pk):
    """People who liked a blog, newest like first (paginated)."""
    blog = get_object_or_404(public_blogs(), pk=pk)
    likes = (
        Like.objects.filter(blog=blog, user__is_active=True)
        .select_related("user", "user__profile")
        .order_by("-created_at", "-id")
    )
    return paginate(request, likes, LikerSerializer)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def blog_bookmark(request, pk):
    """POST = bookmark, DELETE = remove. Answers {bookmarked}. Bookmarks are private."""
    blog = get_object_or_404(public_blogs(), pk=pk)
    if request.method == "POST":
        Bookmark.objects.get_or_create(user=request.user, blog=blog)
    else:
        Bookmark.objects.filter(user=request.user, blog=blog).delete()
    return Response({"bookmarked": request.method == "POST"})


# ==========================================================================
# Me   /users/me/...   (private)
# ==========================================================================
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def me(request):
    """GET: your private profile. PATCH (multipart): avatar file, or empty to clear it."""
    if request.method == "PATCH":
        serializer = AvatarSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
    user = User.objects.select_related("profile").get(pk=request.user.pk)
    return Response(serialize(MeSerializer, request, user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_likes(request):
    return paginate(request, saved_blogs(request.user, Like), BlogSerializer)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_bookmarks(request):
    return paginate(request, saved_blogs(request.user, Bookmark), BlogSerializer)


# These two are plain lists (the dashboard loads them all at once).
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_followers(request):
    return Response(serialize(FollowerSerializer, request, followers_of(request.user), many=True))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_following(request):
    return Response(serialize(FollowingSerializer, request, following_of(request.user), many=True))


# ==========================================================================
# Follow   /users/:id/follow/
# ==========================================================================
@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def follow_user(request, pk):
    """POST = follow, DELETE = unfollow. Repeating either is harmless."""
    target = get_object_or_404(active_users(), pk=pk)
    if target.pk == request.user.pk:
        raise BadRequest("You can't follow yourself.")

    if request.method == "POST":
        _, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if created:
            notify_follow(request.user, target)
    else:
        Follow.objects.filter(follower=request.user, following=target).delete()
    return Response(
        {
            "is_following": request.method == "POST",
            "followers_count": Follow.objects.filter(
                following=target, follower__is_active=True
            ).count(),
        }
    )


# ==========================================================================
# Public profiles   /profiles/:username/...   (no email, no drafts)
# ==========================================================================
def get_profile_user(username):
    """An active user by username, ignoring case (404 otherwise)."""
    return get_object_or_404(active_users(), username__iexact=username)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_profile(request, username):
    queryset = annotate_profiles(active_users())
    user = get_object_or_404(queryset, username__iexact=username)
    return Response(serialize(PublicProfileSerializer, request, user))


@api_view(["GET"])
@permission_classes([AllowAny])
def profile_blogs(request, username):
    author = get_profile_user(username)
    queryset = annotate_blogs(public_blogs().filter(author=author), request.user)
    return paginate(request, queryset.order_by("-published_at", "-id"), BlogSerializer)


@api_view(["GET"])
@permission_classes([AllowAny])
def profile_followers(request, username):
    return paginate(request, followers_of(get_profile_user(username)), FollowerSerializer)


@api_view(["GET"])
@permission_classes([AllowAny])
def profile_following(request, username):
    return paginate(request, following_of(get_profile_user(username)), FollowingSerializer)


# ==========================================================================
# Notifications   /notifications/...   (always the logged-in user's own)
# ==========================================================================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notifications(request):
    """The latest 30, newest first, as a plain list.

    Notifications about a blog that is no longer published are hidden.
    """
    latest = (
        Notification.objects.filter(recipient=request.user, actor__is_active=True)
        .filter(Q(blog__isnull=True) | Q(blog__status=Blog.Status.PUBLISHED))
        .select_related("actor", "actor__profile", "blog")
        .order_by("-created_at", "-id")[:30]
    )
    return Response(serialize(NotificationSerializer, request, latest, many=True))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def notifications_mark_all_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def notification_detail(request, pk):
    """PATCH {is_read: true}: mark one read. DELETE: remove it for good."""
    # Filtering by recipient means other people's notifications are a 404.
    notification = get_object_or_404(Notification.objects.filter(recipient=request.user), pk=pk)
    if request.method == "DELETE":
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = NotificationSerializer(
        notification, data=request.data, partial=True, context={"request": request}
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ==========================================================================
# Reports   /reports/
# ==========================================================================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reports(request):
    """Body: {target_type: blog|comment|user, target_id, reason, details}.

    Reports are reviewed in the Django admin (see admin.py).
    """
    serializer = ReportSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)
