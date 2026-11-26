"""Moderation happens here, in the Django admin (http://localhost:8000/admin/).

Open Reports, read the target, then use the actions on the Blogs, Comments and
Users pages. Hidden (removed) content disappears from every API response.
"""
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    Blog, Bookmark, Comment, Follow, Like, Notification, Profile, Report,
)

User = get_user_model()


# --------------------------------------------------------------------------
# Users: show the avatar on the user page, add suspend / reactivate actions
# --------------------------------------------------------------------------
class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = [ProfileInline]
    actions = ["suspend_users", "reactivate_users"]

    @admin.action(description="Suspend selected users (they can no longer log in)")
    def suspend_users(self, request, queryset):
        # Never lock out staff from here.
        queryset.filter(is_staff=False, is_superuser=False).update(is_active=False)

    @admin.action(description="Reactivate selected users")
    def reactivate_users(self, request, queryset):
        queryset.update(is_active=True)


# --------------------------------------------------------------------------
# Blogs and comments: hide / restore
# --------------------------------------------------------------------------
@admin.register(Blog)
class BlogAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "author", "status", "published_at", "created_at"]
    list_filter = ["status"]
    search_fields = ["title", "author__username"]
    actions = ["remove_blogs", "restore_blogs"]

    @admin.action(description="Remove selected blogs (hide them everywhere)")
    def remove_blogs(self, request, queryset):
        queryset.update(status=Blog.Status.REMOVED)

    @admin.action(description="Restore selected removed blogs")
    def restore_blogs(self, request, queryset):
        # Back to published if it ever was, otherwise back to a draft.
        for blog in queryset.filter(status=Blog.Status.REMOVED):
            blog.status = Blog.Status.PUBLISHED if blog.published_at else Blog.Status.DRAFT
            blog.save(update_fields=["status", "updated_at"])


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["id", "short_body", "author", "blog", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["body", "author__username"]
    actions = ["remove_comments", "restore_comments"]

    @admin.display(description="Comment")
    def short_body(self, comment):
        return comment.body[:60]

    @admin.action(description="Remove selected comments (hide them everywhere)")
    def remove_comments(self, request, queryset):
        queryset.update(status=Comment.Status.REMOVED)

    @admin.action(description="Restore selected comments")
    def restore_comments(self, request, queryset):
        queryset.update(status=Comment.Status.VISIBLE)


# --------------------------------------------------------------------------
# Reports: read what was reported, then mark the outcome
# --------------------------------------------------------------------------
@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = [
        "id", "target_type", "target_id", "target_preview", "reason", "status",
        "reporter", "created_at",
    ]
    list_filter = ["status", "target_type", "reason"]
    search_fields = ["details", "reporter__username"]
    readonly_fields = ["reporter", "target_type", "target_id", "target_preview", "reason", "details", "created_at"]
    actions = ["mark_reviewed", "mark_dismissed", "mark_actioned"]

    @admin.display(description="What was reported")
    def target_preview(self, report):
        if report.target_type == Report.TargetType.BLOG:
            blog = Blog.objects.filter(pk=report.target_id).first()
            return f"Blog: {blog.title}" if blog else "(deleted)"
        if report.target_type == Report.TargetType.COMMENT:
            comment = Comment.objects.filter(pk=report.target_id).first()
            return f"Comment: {comment.body[:80]}" if comment else "(deleted)"
        user = User.objects.filter(pk=report.target_id).first()
        return f"User: {user.username}" if user else "(deleted)"

    @admin.action(description="Mark as reviewed")
    def mark_reviewed(self, request, queryset):
        queryset.update(status=Report.Status.REVIEWED)

    @admin.action(description="Dismiss (no problem found)")
    def mark_dismissed(self, request, queryset):
        queryset.update(status=Report.Status.DISMISSED)

    @admin.action(description="Mark as action taken")
    def mark_actioned(self, request, queryset):
        queryset.update(status=Report.Status.ACTIONED)


# Plain registrations, handy for looking around.
admin.site.register(Follow)
admin.site.register(Like)
admin.site.register(Bookmark)
admin.site.register(Notification)
