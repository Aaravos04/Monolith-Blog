"""Small helpers shared by the serializers and the views."""
from django.contrib.auth import get_user_model
from django.db.models import Count, Exists, OuterRef, Q, Subquery
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.pagination import PageNumberPagination

from .models import Blog, Bookmark, Comment, Follow, Like

User = get_user_model()


class BadRequest(APIException):
    """A 400 whose body is {"detail": "message"}.

    The frontend shows `detail` as-is, so this gives clean error messages
    (a plain ValidationError would come back as a list).
    """

    status_code = 400
    default_detail = "Bad request."
    default_code = "bad_request"


# --------------------------------------------------------------------------
# Pagination
# --------------------------------------------------------------------------
class StandardPagination(PageNumberPagination):
    """{count, next, previous, results}, 10 per page, ?page=2 for the next."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50  # nobody can ask for ?page_size=100000


def paginate(request, items, serializer_class):
    """Paginate a queryset (or list) and serialize the current page."""
    paginator = StandardPagination()
    page = paginator.paginate_queryset(items, request)
    data = serializer_class(page, many=True, context={"request": request}).data
    return paginator.get_paginated_response(data)


# --------------------------------------------------------------------------
# Image validation
# --------------------------------------------------------------------------
def max_image_size(megabytes):
    """Field validator: reject files bigger than `megabytes` MB."""
    limit = megabytes * 1024 * 1024

    def validator(image):
        if image.size > limit:
            raise serializers.ValidationError(
                f"Image must be {megabytes} MB or smaller."
            )

    return validator


# --------------------------------------------------------------------------
# Querysets
# --------------------------------------------------------------------------
def active_users():
    """Users who can be seen. Suspended / closed accounts (is_active=False) are hidden."""
    return User.objects.filter(is_active=True)


def public_blogs():
    """Blogs anyone may read: published, by an active author."""
    return Blog.objects.filter(status=Blog.Status.PUBLISHED, author__is_active=True)


def annotate_blogs(queryset, user):
    """Add the counts and the viewer's own flags to a Blog queryset.

    One query for the whole list instead of several per blog.
    (Call this BEFORE filtering across likes/comments, so the counts stay right.)
    """
    queryset = queryset.select_related("author", "author__profile").annotate(
        likes_count=Count("likes", distinct=True),
        comments_count=Count(
            "comments",
            filter=Q(comments__status=Comment.Status.VISIBLE),
            distinct=True,
        ),
    )
    if user.is_authenticated:
        queryset = queryset.annotate(
            liked_by_me=Exists(Like.objects.filter(user=user, blog=OuterRef("pk"))),
            bookmarked_by_me=Exists(
                Bookmark.objects.filter(user=user, blog=OuterRef("pk"))
            ),
        )
    return queryset


def saved_blogs(user, model):
    """Published blogs the user liked (model=Like) or bookmarked (model=Bookmark),
    most recently saved first."""
    saved_at = model.objects.filter(user=user, blog=OuterRef("pk")).values("created_at")[:1]
    queryset = (
        public_blogs()
        .annotate(saved_at=Subquery(saved_at))
        .filter(saved_at__isnull=False)
    )
    return annotate_blogs(queryset, user).order_by("-saved_at", "-id")


def annotate_profiles(queryset):
    """Add posts / followers / following counts to a User queryset."""
    return queryset.select_related("profile").annotate(
        posts_count=Count(
            "blogs", filter=Q(blogs__status=Blog.Status.PUBLISHED), distinct=True
        ),
        followers_count=Count(
            "follower_links",
            filter=Q(follower_links__follower__is_active=True),
            distinct=True,
        ),
        following_count=Count(
            "following_links",
            filter=Q(following_links__following__is_active=True),
            distinct=True,
        ),
    )


def followers_of(user):
    """Follow rows for the people who follow `user`, newest first."""
    return (
        Follow.objects.filter(following=user, follower__is_active=True)
        .select_related("follower", "follower__profile")
        .order_by("-created_at", "-id")
    )


def following_of(user):
    """Follow rows for the people `user` follows, newest first."""
    return (
        Follow.objects.filter(follower=user, following__is_active=True)
        .select_related("following", "following__profile")
        .order_by("-created_at", "-id")
    )


def following_ids(request):
    """IDs of everyone the requester follows (one query per request, then cached)."""
    user = request.user
    if not user.is_authenticated:
        return set()
    cached = getattr(request, "_following_ids", None)
    if cached is None:
        cached = set(
            Follow.objects.filter(follower=user).values_list("following_id", flat=True)
        )
        request._following_ids = cached
    return cached
