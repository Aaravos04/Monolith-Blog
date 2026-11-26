import re

from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import (
    Blog, Bookmark, Comment, Follow, Like, Notification, Profile, Report,
)
from .services import notify_new_post
from .utils import BadRequest, following_ids, max_image_size, public_blogs

User = get_user_model()

# The report reasons the frontend offers (the keys in src/lib/reports.js).
# None = accept any short text. Replace it with a set, e.g.
#   {"spam", "harassment", "misinformation", "other"}
# to reject anything else.
ALLOWED_REPORT_REASONS = None

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_]{3,30}$")
# These would look like routes or official accounts.
RESERVED_USERNAMES = {
    "admin", "administrator", "api", "me", "root", "support", "staff",
    "moderator", "monolith", "null", "undefined", "login", "logout",
    "register", "profiles", "users", "blogs", "notifications", "reports",
}


def validate_new_password(password, user=None, field="new_password"):
    """Run Django's password validators; report the problems under `field`."""
    try:
        password_validation.validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({field: list(exc.messages)})


# --------------------------------------------------------------------------
# People
# --------------------------------------------------------------------------
class PersonSerializer(serializers.ModelSerializer):
    """A person inside blogs, comments, lists and notifications. NEVER has an email."""

    avatar = serializers.ImageField(source="profile.avatar", read_only=True)
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar", "is_following"]
        read_only_fields = fields

    def get_is_following(self, user):
        # About the person asking; False when logged out.
        request = self.context.get("request")
        return request is not None and user.pk in following_ids(request)


class PublicProfileSerializer(PersonSerializer):
    """GET /profiles/:username/. No email, no drafts, no private counts.

    Expects a queryset made with utils.annotate_profiles().
    """

    posts_count = serializers.IntegerField(read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)

    class Meta(PersonSerializer.Meta):
        fields = PersonSerializer.Meta.fields + [
            "date_joined", "posts_count", "followers_count", "following_count",
        ]
        read_only_fields = fields


class AuthUserSerializer(serializers.ModelSerializer):
    """The logged-in user (login, register). Includes the email: never use it for other people."""

    avatar = serializers.ImageField(source="profile.avatar", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "avatar", "date_joined",
        ]
        read_only_fields = fields


class MeSerializer(AuthUserSerializer):
    """GET /users/me/: the private profile with the dashboard counts."""

    posts_count = serializers.SerializerMethodField()
    drafts_count = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    liked_count = serializers.SerializerMethodField()
    bookmarks_count = serializers.SerializerMethodField()

    class Meta(AuthUserSerializer.Meta):
        fields = AuthUserSerializer.Meta.fields + [
            "posts_count", "drafts_count", "followers_count", "following_count",
            "liked_count", "bookmarks_count",
        ]
        read_only_fields = fields

    def get_posts_count(self, user):
        return user.blogs.filter(status=Blog.Status.PUBLISHED).count()

    def get_drafts_count(self, user):
        return user.blogs.filter(status=Blog.Status.DRAFT).count()

    def get_followers_count(self, user):
        return Follow.objects.filter(following=user, follower__is_active=True).count()

    def get_following_count(self, user):
        return Follow.objects.filter(follower=user, following__is_active=True).count()

    # Liked / bookmarked counts only include blogs that are still published.
    def get_liked_count(self, user):
        return Like.objects.filter(
            user=user, blog__status=Blog.Status.PUBLISHED, blog__author__is_active=True
        ).count()

    def get_bookmarks_count(self, user):
        return Bookmark.objects.filter(
            user=user, blog__status=Blog.Status.PUBLISHED, blog__author__is_active=True
        ).count()


class AvatarSerializer(serializers.Serializer):
    """PATCH /users/me/: set a picture, or send an empty value to clear it."""

    avatar = serializers.ImageField(allow_null=True, validators=[max_image_size(2)])

    def update(self, user, validated_data):
        if "avatar" in validated_data:
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.avatar = validated_data["avatar"]
            profile.save(update_fields=["avatar"])
        return user


# Tiny serializers that show the person behind a Like / Follow row.
class LikerSerializer(serializers.BaseSerializer):
    def to_representation(self, like):
        return PersonSerializer(like.user, context=self.context).data


class FollowerSerializer(serializers.BaseSerializer):
    def to_representation(self, follow):
        return PersonSerializer(follow.follower, context=self.context).data


class FollowingSerializer(serializers.BaseSerializer):
    def to_representation(self, follow):
        return PersonSerializer(follow.following, context=self.context).data


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "password"]
        extra_kwargs = {
            "email": {"required": True, "allow_blank": False},
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
        }

    def validate_username(self, value):
        if not USERNAME_PATTERN.match(value):
            raise serializers.ValidationError(
                "Use 3 to 30 letters, numbers or underscores (no spaces)."
            )
        if value.lower() in RESERVED_USERNAMES:
            raise serializers.ValidationError("This username is not available.")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        # Django's default User doesn't enforce unique emails; password reset needs them.
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate(self, attrs):
        # An unsaved user lets the "too similar to your username" check work.
        candidate = User(
            username=attrs.get("username"),
            email=attrs.get("email"),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        validate_new_password(attrs["password"], user=candidate, field="password")
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)  # hashes the password


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        invalid_link = serializers.ValidationError(
            {"token": "This reset link is invalid or has expired."}
        )
        try:
            pk = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=pk, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise invalid_link
        if not default_token_generator.check_token(user, attrs["token"]):
            raise invalid_link
        validate_new_password(attrs["new_password"], user=user)
        attrs["user"] = user
        return attrs


# --------------------------------------------------------------------------
# Blogs
# --------------------------------------------------------------------------
class BlogSerializer(serializers.ModelSerializer):
    """What the frontend reads. Expects a queryset made with utils.annotate_blogs()."""

    author = PersonSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.SerializerMethodField()
    bookmarked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Blog
        fields = [
            "id", "title", "body", "cover_image", "status", "author",
            "likes_count", "comments_count", "liked_by_me", "bookmarked_by_me",
            "created_at", "updated_at", "published_at",
        ]
        read_only_fields = fields

    # False when logged out (the annotations only exist for logged-in viewers).
    def get_liked_by_me(self, blog):
        return getattr(blog, "liked_by_me", False)

    def get_bookmarked_by_me(self, blog):
        return getattr(blog, "bookmarked_by_me", False)


class BlogWriteSerializer(serializers.ModelSerializer):
    """What the author sends (multipart form data) to create or edit a blog."""

    status = serializers.ChoiceField(choices=["draft", "published"], required=False)
    # allow_null: the frontend clears the picture by sending the field empty.
    cover_image = serializers.ImageField(
        required=False, allow_null=True, validators=[max_image_size(5)]
    )

    class Meta:
        model = Blog
        fields = ["title", "body", "cover_image", "status"]
        extra_kwargs = {"body": {"max_length": 100_000}}

    @transaction.atomic
    def create(self, validated_data):
        validated_data.setdefault("status", Blog.Status.DRAFT)
        blog = Blog(author=self.context["request"].user, **validated_data)
        publishing = blog.status == Blog.Status.PUBLISHED
        if publishing:
            blog.published_at = timezone.now()
        blog.save()
        if publishing:
            notify_new_post(blog)
        return blog

    @transaction.atomic
    def update(self, blog, validated_data):
        # Only the FIRST publication sets published_at and notifies followers.
        first_publication = (
            validated_data.get("status") == Blog.Status.PUBLISHED
            and blog.published_at is None
        )
        for field, value in validated_data.items():
            setattr(blog, field, value)
        if first_publication:
            blog.published_at = timezone.now()
        blog.save()
        if first_publication:
            notify_new_post(blog)
        return blog


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------
class CommentSerializer(serializers.ModelSerializer):
    author = PersonSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "blog", "body", "author", "created_at"]
        read_only_fields = ["id", "blog", "author", "created_at"]
        extra_kwargs = {"body": {"max_length": 2000}}


# --------------------------------------------------------------------------
# Notifications
# --------------------------------------------------------------------------
class NotificationBlogSerializer(serializers.ModelSerializer):
    class Meta:
        model = Blog
        fields = ["id", "title"]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    """`blog` is null for follows. Only `is_read` can be changed."""

    actor = PersonSerializer(read_only=True)
    blog = NotificationBlogSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "type", "is_read", "created_at", "actor", "blog"]
        read_only_fields = ["id", "type", "created_at", "actor", "blog"]


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------
class ReportSerializer(serializers.ModelSerializer):
    target_type = serializers.ChoiceField(choices=Report.TargetType.values)
    target_id = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=40)
    details = serializers.CharField(allow_blank=True, max_length=1000, default="")

    class Meta:
        model = Report
        fields = ["id", "target_type", "target_id", "reason", "details", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        user = self.context["request"].user
        target_type, target_id = attrs["target_type"], attrs["target_id"]
        reason = attrs["reason"].strip()
        details = attrs["details"].strip()

        if ALLOWED_REPORT_REASONS is not None and reason not in ALLOWED_REPORT_REASONS:
            raise serializers.ValidationError({"reason": "Pick one of the listed reasons."})
        if reason == "other" and not details:
            raise serializers.ValidationError(
                {"details": "Please describe the problem when the reason is 'other'."}
            )

        # The target must exist and be something the reporter could see.
        if target_type == Report.TargetType.BLOG:
            target = public_blogs().filter(pk=target_id).first()
            owner_id = target.author_id if target else None
        elif target_type == Report.TargetType.COMMENT:
            target = Comment.objects.filter(
                pk=target_id,
                status=Comment.Status.VISIBLE,
                blog__status=Blog.Status.PUBLISHED,
            ).first()
            owner_id = target.author_id if target else None
        else:
            target = User.objects.filter(pk=target_id, is_active=True).first()
            owner_id = target.pk if target else None

        if target is None:
            raise serializers.ValidationError({"target_id": f"That {target_type} does not exist."})
        if owner_id == user.pk:
            raise BadRequest(
                "You can't report yourself."
                if target_type == Report.TargetType.USER
                else "You can't report your own content."
            )
        if Report.objects.filter(
            reporter=user, target_type=target_type, target_id=target_id
        ).exists():
            raise BadRequest("You have already reported this.")

        attrs["reason"] = reason
        attrs["details"] = details
        return attrs

    def create(self, validated_data):
        validated_data["reporter"] = self.context["request"].user
        try:
            with transaction.atomic():  # a savepoint, so a clash can't break the request
                return super().create(validated_data)
        except IntegrityError:
            # Two identical reports sent at the same moment.
            raise BadRequest("You have already reported this.")
