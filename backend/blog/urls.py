from django.urls import path

from . import views

# Mounted at /api/v1/ (see settings_snippet.py), so "blogs/" means /api/v1/blogs/.
# Every path matches src/api/realApi.js, trailing slashes included.
#
# <int:pk> only matches digits, so "blogs/search/" and "blogs/mine/" are never
# mistaken for a blog id, whatever the order. (Order still matters when two
# patterns could match the same URL.)
urlpatterns = [
    # auth
    path("auth/login/", views.login, name="auth-login"),
    path("auth/register/", views.register, name="auth-register"),
    path("auth/logout/", views.logout, name="auth-logout"),
    path("auth/forgot-password/", views.forgot_password, name="auth-forgot-password"),
    path("auth/reset-password/", views.reset_password, name="auth-reset-password"),

    # blogs
    path("blogs/", views.blogs, name="blogs"),
    path("blogs/search/", views.search_blogs, name="blogs-search"),
    path("blogs/mine/", views.my_blogs, name="blogs-mine"),
    path("blogs/<int:pk>/", views.blog_detail, name="blog-detail"),

    # comments
    path("blogs/<int:pk>/comments/", views.blog_comments, name="blog-comments"),
    path("blogs/<int:pk>/comments/<int:comment_id>/", views.comment_detail, name="comment-detail"),

    # likes and bookmarks
    path("blogs/<int:pk>/like/", views.blog_like, name="blog-like"),
    path("blogs/<int:pk>/likes/", views.blog_likers, name="blog-likers"),
    path("blogs/<int:pk>/bookmark/", views.blog_bookmark, name="blog-bookmark"),

    # my own account (private)
    path("users/me/", views.me, name="me"),
    path("users/me/likes/", views.my_likes, name="me-likes"),
    path("users/me/bookmarks/", views.my_bookmarks, name="me-bookmarks"),
    path("users/me/followers/", views.my_followers, name="me-followers"),
    path("users/me/following/", views.my_following, name="me-following"),

    # follow someone (by id)
    path("users/<int:pk>/follow/", views.follow_user, name="user-follow"),

    # public profiles (by username)
    path("profiles/<str:username>/", views.public_profile, name="profile"),
    path("profiles/<str:username>/blogs/", views.profile_blogs, name="profile-blogs"),
    path("profiles/<str:username>/followers/", views.profile_followers, name="profile-followers"),
    path("profiles/<str:username>/following/", views.profile_following, name="profile-following"),

    # notifications
    path("notifications/", views.notifications, name="notifications"),
    path("notifications/mark-all-read/", views.notifications_mark_all_read, name="notifications-mark-all-read"),
    path("notifications/<int:pk>/", views.notification_detail, name="notification-detail"),

    # reports
    path("reports/", views.reports, name="reports"),
]
