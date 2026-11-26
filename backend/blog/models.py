from django.conf import settings
from django.db import models
from django.db.models import F, Q

User = settings.AUTH_USER_MODEL

# NOTE: CheckConstraint(condition=...) needs Django 5.1+.
# On Django 4.2 / 5.0, rename `condition=` to `check=`.


class Profile(models.Model):
    """Extra data for Django's default User (the default User has no avatar).

    A Profile is created automatically for every new user (see signals.py).
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    def __str__(self):
        return f"Profile of user {self.user_id}"


class Blog(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        REMOVED = "removed", "Removed by a moderator"  # never shown by the API

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blogs")
    title = models.CharField(max_length=255)
    body = models.TextField()  # HTML from the Tiptap editor
    cover_image = models.ImageField(upload_to="blog_covers/", null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.DRAFT
    )
    # Set the first time the blog is published; kept if it goes back to draft.
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "published_at"])]

    def __str__(self):
        return self.title


class Comment(models.Model):
    class Status(models.TextChoices):
        VISIBLE = "visible", "Visible"
        REMOVED = "removed", "Removed by a moderator"

    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    body = models.TextField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.VISIBLE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["blog", "created_at"])]

    def __str__(self):
        return f"Comment {self.pk} on blog {self.blog_id}"


class Follow(models.Model):
    """`follower` follows `following`."""

    follower = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="following_links"
    )
    following = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="follower_links"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"], name="unique_follow"
            ),
            models.CheckConstraint(
                condition=~Q(follower=F("following")), name="no_self_follow"
            ),
        ]

    def __str__(self):
        return f"{self.follower_id} follows {self.following_id}"


class Like(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "blog"], name="unique_like")
        ]
        indexes = [models.Index(fields=["user", "created_at"])]


class Bookmark(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookmarks")
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "blog"], name="unique_bookmark")
        ]
        indexes = [models.Index(fields=["user", "created_at"])]


class Notification(models.Model):
    class Type(models.TextChoices):
        FOLLOW = "follow", "Follow"
        COMMENT = "comment", "Comment"
        LIKE = "like", "Like"
        NEW_POST = "new_post", "New post"

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="+")
    type = models.CharField(max_length=10, choices=Type.choices)
    # Empty for follows. Deleting the blog deletes its notifications too.
    blog = models.ForeignKey(
        Blog, null=True, blank=True, on_delete=models.CASCADE,
        related_name="notifications",
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["recipient", "is_read", "created_at"])]

    def __str__(self):
        return f"{self.type} notification for user {self.recipient_id}"


class Report(models.Model):
    class TargetType(models.TextChoices):
        BLOG = "blog", "Blog"
        COMMENT = "comment", "Comment"
        USER = "user", "User"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        REVIEWED = "reviewed", "Reviewed"
        DISMISSED = "dismissed", "Dismissed"
        ACTIONED = "actioned", "Action taken"

    reporter = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reports_made"
    )
    # What was reported: the id of a blog, comment or user (depending on target_type).
    target_type = models.CharField(max_length=10, choices=TargetType.choices)
    target_id = models.PositiveIntegerField()
    reason = models.CharField(max_length=40)
    details = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reporter", "target_type", "target_id"],
                name="unique_report_per_target",
            )
        ]
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self):
        return f"Report {self.pk}: {self.target_type} {self.target_id}"
