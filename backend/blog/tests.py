"""API tests. Run with:  python manage.py test blog

Assumes the settings from settings_snippet.py (token auth, media) and that
blog.urls is mounted at /api/v1/.
"""
import atexit
import io
import re
import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import (
    Blog, Bookmark, Comment, Follow, Like, Notification, Profile, Report,
)

User = get_user_model()
BASE = "/api/v1"
PASSWORD = "Str0ng-pass-2026!"
NEW_PASSWORD = "An0ther-str0ng-pass!"

# Uploaded test images go to a temporary folder that is removed afterwards.
TEST_MEDIA = tempfile.mkdtemp()
atexit.register(shutil.rmtree, TEST_MEDIA, ignore_errors=True)

PERSON_KEYS = {"id", "username", "first_name", "last_name", "avatar", "is_following"}
BLOG_KEYS = {
    "id", "title", "body", "cover_image", "status", "author", "likes_count",
    "comments_count", "liked_by_me", "bookmarked_by_me", "created_at",
    "updated_at", "published_at",
}


def make_user(username, **extra):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=PASSWORD,
        first_name=username.title(),
        last_name="Tester",
        **extra,
    )


def make_blog(author, status=Blog.Status.PUBLISHED, title="Hello", **extra):
    if status == Blog.Status.PUBLISHED:
        extra.setdefault("published_at", timezone.now())
    extra.setdefault("body", "<p>Body text</p>")
    return Blog.objects.create(author=author, title=title, status=status, **extra)


def png(name="pic.png"):
    """A tiny but real PNG, so Pillow's image check passes."""
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), "white").save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class BaseTest(APITestCase):
    def setUp(self):
        self.alice = make_user("alice")
        self.bob = make_user("bob")
        self.carol = make_user("carol")

    # --- small wrappers so the tests read like the API ----------------------
    def login_as(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def logout(self):
        self.client.credentials()

    def GET(self, path, data=None):
        return self.client.get(f"{BASE}{path}", data)

    def POST(self, path, data=None, format="json"):
        return self.client.post(f"{BASE}{path}", data or {}, format=format)

    def PATCH(self, path, data=None, format="json"):
        return self.client.patch(f"{BASE}{path}", data or {}, format=format)

    def DELETE(self, path):
        return self.client.delete(f"{BASE}{path}")

    def titles(self, response):
        return [blog["title"] for blog in response.data["results"]]


# ==========================================================================
# Auth
# ==========================================================================
class AuthTests(BaseTest):
    REGISTER = {
        "username": "newbie", "email": "newbie@example.com",
        "first_name": "New", "last_name": "Bie", "password": PASSWORD,
    }

    def test_register_returns_token_and_user(self):
        r = self.POST("/auth/register/", self.REGISTER)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["token"], Token.objects.get(user__username="newbie").key)
        self.assertEqual(r.data["user"]["email"], "newbie@example.com")
        self.assertIn("avatar", r.data["user"])
        self.assertNotIn("password", r.data["user"])
        self.assertTrue(User.objects.get(username="newbie").check_password(PASSWORD))
        self.assertTrue(Profile.objects.filter(user__username="newbie").exists())

    def test_register_rejects_taken_username_ignoring_case(self):
        r = self.POST("/auth/register/", {**self.REGISTER, "username": "ALICE"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("username", r.data)

    def test_register_rejects_bad_usernames(self):
        for username in ["has space", "ab", "admin", "Me", "x" * 31, "bad!name"]:
            r = self.POST("/auth/register/", {**self.REGISTER, "username": username})
            self.assertEqual(r.status_code, 400, username)

    def test_register_rejects_taken_email_ignoring_case(self):
        r = self.POST("/auth/register/", {**self.REGISTER, "email": "ALICE@example.com"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.data)

    def test_register_rejects_weak_password(self):
        r = self.POST("/auth/register/", {**self.REGISTER, "password": "123"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.data)

    def test_register_needs_names_and_email(self):
        for missing in ["first_name", "last_name", "email"]:
            data = {k: v for k, v in self.REGISTER.items() if k != missing}
            self.assertEqual(self.POST("/auth/register/", data).status_code, 400, missing)

    def test_login_returns_token_and_user_with_email(self):
        r = self.POST("/auth/login/", {"username": "alice", "password": PASSWORD})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["token"], Token.objects.get(user=self.alice).key)
        self.assertEqual(r.data["user"]["email"], "alice@example.com")
        self.assertIsNone(r.data["user"]["avatar"])

    def test_login_ignores_username_case(self):
        r = self.POST("/auth/login/", {"username": "ALICE", "password": PASSWORD})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["user"]["username"], "alice")

    def test_login_wrong_password_has_a_readable_detail(self):
        r = self.POST("/auth/login/", {"username": "alice", "password": "nope"})
        self.assertEqual(r.status_code, 400)
        self.assertIsInstance(r.data["detail"], str)

    def test_login_blocked_for_inactive_user(self):
        self.alice.is_active = False
        self.alice.save()
        r = self.POST("/auth/login/", {"username": "alice", "password": PASSWORD})
        self.assertEqual(r.status_code, 400)

    def test_login_works_even_with_a_stale_token_header(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        r = self.POST("/auth/login/", {"username": "alice", "password": PASSWORD})
        self.assertEqual(r.status_code, 200)

    def test_bad_token_is_401(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token not-a-real-token")
        self.assertEqual(self.GET("/users/me/").status_code, 401)

    def test_suspended_users_token_stops_working(self):
        self.login_as(self.alice)
        self.assertEqual(self.GET("/users/me/").status_code, 200)
        self.alice.is_active = False
        self.alice.save()
        self.assertEqual(self.GET("/users/me/").status_code, 401)

    def test_logout_deletes_the_token(self):
        self.login_as(self.alice)
        self.assertEqual(self.POST("/auth/logout/").status_code, 204)
        self.assertFalse(Token.objects.filter(user=self.alice).exists())
        self.assertEqual(self.GET("/users/me/").status_code, 401)

    def test_logout_needs_login(self):
        self.assertEqual(self.POST("/auth/logout/").status_code, 401)

    def test_forgot_and_reset_password(self):
        r = self.POST("/auth/forgot-password/", {"email": "alice@example.com"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        message = r.data["detail"]

        # An unknown email gets the same answer and no email.
        r = self.POST("/auth/forgot-password/", {"email": "nobody@example.com"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["detail"], message)
        self.assertEqual(len(mail.outbox), 1)

        uid, token = re.search(r"uid=([^&\s]+)&token=(\S+)", mail.outbox[0].body).groups()
        weak = self.POST("/auth/reset-password/", {"uid": uid, "token": token, "new_password": "1"})
        self.assertEqual(weak.status_code, 400)
        self.assertIn("new_password", weak.data)

        Token.objects.create(user=self.alice)
        r = self.POST("/auth/reset-password/", {"uid": uid, "token": token, "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Token.objects.filter(user=self.alice).exists())
        r = self.POST("/auth/login/", {"username": "alice", "password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 200)

        # The link works only once (the password hash changed).
        r = self.POST("/auth/reset-password/", {"uid": uid, "token": token, "new_password": PASSWORD})
        self.assertEqual(r.status_code, 400)

    def test_reset_with_garbage_is_400(self):
        r = self.POST("/auth/reset-password/", {"uid": "zzz", "token": "x", "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 400)


# ==========================================================================
# Blogs: reading
# ==========================================================================
class BlogReadTests(BaseTest):
    def test_latest_is_public_newest_first_and_published_only(self):
        now = timezone.now()
        make_blog(self.alice, title="Old", published_at=now - timedelta(days=2))
        make_blog(self.bob, title="New", published_at=now)
        make_blog(self.alice, Blog.Status.DRAFT, title="Secret draft")
        r = self.GET("/blogs/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.titles(r), ["New", "Old"])
        self.assertEqual(r.data["count"], 2)

    def test_feed_param_latest_and_no_param_agree(self):
        make_blog(self.alice, title="A")
        self.assertEqual(self.GET("/blogs/", {"feed": "latest"}).data, self.GET("/blogs/").data)

    def test_blog_shape(self):
        make_blog(self.alice)
        blog = self.GET("/blogs/").data["results"][0]
        self.assertEqual(set(blog), BLOG_KEYS)
        self.assertEqual(set(blog["author"]), PERSON_KEYS)
        self.assertNotIn("email", blog["author"])
        self.assertEqual(blog["status"], "published")
        self.assertIs(blog["liked_by_me"], False)
        self.assertIs(blog["bookmarked_by_me"], False)
        self.assertIsNotNone(blog["published_at"])

    def test_pagination_is_ten_per_page(self):
        for n in range(12):
            make_blog(self.alice, title=f"Blog {n}", published_at=timezone.now() - timedelta(minutes=n))
        first = self.GET("/blogs/")
        self.assertEqual(len(first.data["results"]), 10)
        self.assertEqual(first.data["count"], 12)
        self.assertIsNotNone(first.data["next"])
        second = self.GET("/blogs/", {"page": 2})
        self.assertEqual(len(second.data["results"]), 2)
        self.assertIsNone(second.data["next"])

    def test_page_size_is_capped(self):
        for n in range(3):
            make_blog(self.alice, title=f"Blog {n}")
        r = self.GET("/blogs/", {"page_size": 100000})
        self.assertEqual(r.status_code, 200)

    def test_unknown_feed_is_400(self):
        self.assertEqual(self.GET("/blogs/", {"feed": "nonsense"}).status_code, 400)

    def test_blogs_of_inactive_authors_are_hidden(self):
        blog = make_blog(self.alice)
        self.alice.is_active = False
        self.alice.save()
        self.assertEqual(self.GET("/blogs/").data["count"], 0)
        self.assertEqual(self.GET(f"/blogs/{blog.id}/").status_code, 404)

    def test_removed_blogs_are_hidden_from_everyone_even_the_author(self):
        blog = make_blog(self.alice, Blog.Status.REMOVED)
        self.assertEqual(self.GET(f"/blogs/{blog.id}/").status_code, 404)
        self.login_as(self.alice)
        self.assertEqual(self.GET(f"/blogs/{blog.id}/").status_code, 404)
        self.assertEqual(len(self.GET("/blogs/mine/").data), 0)

    def test_counts_only_count_visible_comments_and_all_likes(self):
        blog = make_blog(self.alice)
        Like.objects.create(user=self.bob, blog=blog)
        Like.objects.create(user=self.carol, blog=blog)
        Comment.objects.create(blog=blog, author=self.bob, body="one")
        Comment.objects.create(blog=blog, author=self.bob, body="two")
        Comment.objects.create(blog=blog, author=self.bob, body="hidden", status=Comment.Status.REMOVED)
        data = self.GET(f"/blogs/{blog.id}/").data
        self.assertEqual(data["likes_count"], 2)
        self.assertEqual(data["comments_count"], 2)

    def test_my_flags(self):
        liked = make_blog(self.alice, title="Liked")
        saved = make_blog(self.alice, title="Saved")
        Like.objects.create(user=self.bob, blog=liked)
        Bookmark.objects.create(user=self.bob, blog=saved)
        self.login_as(self.bob)
        by_title = {b["title"]: b for b in self.GET("/blogs/").data["results"]}
        self.assertTrue(by_title["Liked"]["liked_by_me"])
        self.assertFalse(by_title["Liked"]["bookmarked_by_me"])
        self.assertTrue(by_title["Saved"]["bookmarked_by_me"])
        # ...and another person's flags are not mine
        self.login_as(self.carol)
        by_title = {b["title"]: b for b in self.GET("/blogs/").data["results"]}
        self.assertFalse(by_title["Liked"]["liked_by_me"])

    def test_bookmarks_are_never_counted_publicly(self):
        blog = make_blog(self.alice)
        Bookmark.objects.create(user=self.bob, blog=blog)
        data = self.GET(f"/blogs/{blog.id}/").data
        self.assertNotIn("bookmarks_count", data)
        self.assertFalse(data["bookmarked_by_me"])

    def test_author_is_following_flag(self):
        make_blog(self.alice)
        Follow.objects.create(follower=self.bob, following=self.alice)
        self.assertFalse(self.GET("/blogs/").data["results"][0]["author"]["is_following"])
        self.login_as(self.bob)
        self.assertTrue(self.GET("/blogs/").data["results"][0]["author"]["is_following"])
        self.login_as(self.carol)
        self.assertFalse(self.GET("/blogs/").data["results"][0]["author"]["is_following"])

    def test_following_feed(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        make_blog(self.alice, title="From Alice")
        make_blog(self.alice, Blog.Status.DRAFT, title="Alice draft")
        make_blog(self.carol, title="From Carol")
        self.assertEqual(self.GET("/blogs/", {"feed": "following"}).status_code, 401)
        self.login_as(self.bob)
        r = self.GET("/blogs/", {"feed": "following"})
        self.assertEqual(self.titles(r), ["From Alice"])

    def test_recommended_ranks_popular_blogs_first_and_works_logged_out(self):
        quiet = make_blog(self.alice, title="Quiet")
        popular = make_blog(self.alice, title="Popular")
        for fan in [self.bob, self.carol, make_user("dave")]:
            Like.objects.create(user=fan, blog=popular)
        r = self.GET("/blogs/", {"feed": "recommended"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.titles(r), ["Popular", "Quiet"])
        self.assertEqual(quiet.status, Blog.Status.PUBLISHED)

    def test_recommended_skips_my_own_and_already_liked(self):
        make_blog(self.bob, title="Mine")
        liked = make_blog(self.alice, title="Already liked")
        make_blog(self.alice, title="Fresh")
        Like.objects.create(user=self.bob, blog=liked)
        self.login_as(self.bob)
        r = self.GET("/blogs/", {"feed": "recommended"})
        self.assertEqual(self.titles(r), ["Fresh"])

    def test_recommended_prefers_newer_when_equal(self):
        now = timezone.now()
        make_blog(self.alice, title="Older", published_at=now - timedelta(days=5))
        make_blog(self.alice, title="Newer", published_at=now)
        r = self.GET("/blogs/", {"feed": "recommended"})
        self.assertEqual(self.titles(r), ["Newer", "Older"])


# ==========================================================================
# Blogs: detail, create, edit, delete
# ==========================================================================
@override_settings(MEDIA_ROOT=TEST_MEDIA)
class BlogWriteTests(BaseTest):
    def test_detail_is_public_for_published(self):
        blog = make_blog(self.alice)
        r = self.GET(f"/blogs/{blog.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["id"], blog.id)

    def test_unknown_blog_is_404(self):
        self.assertEqual(self.GET("/blogs/99999/").status_code, 404)

    def test_draft_is_visible_only_to_its_author(self):
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.assertEqual(self.GET(f"/blogs/{draft.id}/").status_code, 404)
        self.login_as(self.bob)
        self.assertEqual(self.GET(f"/blogs/{draft.id}/").status_code, 404)
        self.login_as(self.alice)
        self.assertEqual(self.GET(f"/blogs/{draft.id}/").status_code, 200)

    def test_create_needs_login(self):
        r = self.POST("/blogs/", {"title": "t", "body": "b", "status": "draft"}, format="multipart")
        self.assertEqual(r.status_code, 401)

    def test_create_draft_has_no_published_at_and_notifies_nobody(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        self.login_as(self.alice)
        r = self.POST("/blogs/", {"title": "t", "body": "<p>b</p>", "status": "draft"}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "draft")
        self.assertIsNone(r.data["published_at"])
        self.assertEqual(Blog.objects.get(pk=r.data["id"]).author, self.alice)
        self.assertEqual(Notification.objects.count(), 0)

    def test_create_published_with_cover_notifies_followers_once(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        self.login_as(self.alice)
        r = self.POST(
            "/blogs/",
            {"title": "t", "body": "<p>b</p>", "status": "published", "cover_image": png()},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201)
        self.assertIsNotNone(r.data["published_at"])
        self.assertTrue(r.data["cover_image"].endswith(".png"))
        note = Notification.objects.get()
        self.assertEqual(
            (note.recipient, note.actor, note.type, note.blog_id),
            (self.bob, self.alice, "new_post", r.data["id"]),
        )

    def test_create_accepts_json_too(self):
        self.login_as(self.alice)
        r = self.POST("/blogs/", {"title": "t", "body": "b"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "draft")

    def test_create_rejects_other_statuses_and_blank_fields(self):
        self.login_as(self.alice)
        for bad in [{"status": "removed"}, {"status": "nonsense"}, {"title": ""}, {"body": ""}]:
            data = {"title": "t", "body": "b", "status": "draft", **bad}
            self.assertEqual(self.POST("/blogs/", data, format="multipart").status_code, 400, bad)

    def test_create_rejects_a_file_that_is_not_an_image(self):
        self.login_as(self.alice)
        fake = SimpleUploadedFile("evil.png", b"not really an image", content_type="image/png")
        r = self.POST("/blogs/", {"title": "t", "body": "b", "cover_image": fake}, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("cover_image", r.data)

    def test_only_the_author_can_edit(self):
        blog = make_blog(self.alice)
        self.assertEqual(self.PATCH(f"/blogs/{blog.id}/", {"title": "x"}).status_code, 401)
        self.login_as(self.bob)
        self.assertEqual(self.PATCH(f"/blogs/{blog.id}/", {"title": "x"}).status_code, 403)
        self.login_as(self.alice)
        r = self.PATCH(f"/blogs/{blog.id}/", {"title": "Edited"}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["title"], "Edited")

    def test_editing_someone_elses_draft_is_404_not_403(self):
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.login_as(self.bob)
        self.assertEqual(self.PATCH(f"/blogs/{draft.id}/", {"title": "x"}).status_code, 404)

    def test_frontend_style_full_multipart_update(self):
        blog = make_blog(self.alice)
        self.login_as(self.alice)
        r = self.PATCH(
            f"/blogs/{blog.id}/",
            {"title": "New title", "body": "<p>new</p>", "status": "published"},
            format="multipart",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["body"], "<p>new</p>")

    def test_cover_can_be_replaced_and_cleared_with_an_empty_value(self):
        self.login_as(self.alice)
        blog = make_blog(self.alice)
        r = self.PATCH(f"/blogs/{blog.id}/", {"cover_image": png()}, format="multipart")
        self.assertIsNotNone(r.data["cover_image"])
        r = self.PATCH(f"/blogs/{blog.id}/", {"cover_image": ""}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["cover_image"])

    def test_publishing_a_draft_notifies_followers_once_even_after_unpublishing(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.login_as(self.alice)
        r = self.PATCH(f"/blogs/{draft.id}/", {"status": "published"})
        self.assertEqual(r.status_code, 200)
        first_published_at = r.data["published_at"]
        self.assertIsNotNone(first_published_at)
        self.assertEqual(Notification.objects.filter(type="new_post").count(), 1)

        # Edits, unpublishing and publishing again stay quiet and keep the date.
        self.PATCH(f"/blogs/{draft.id}/", {"title": "Edited"})
        self.PATCH(f"/blogs/{draft.id}/", {"status": "draft"})
        r = self.PATCH(f"/blogs/{draft.id}/", {"status": "published"})
        self.assertEqual(r.data["published_at"], first_published_at)
        self.assertEqual(Notification.objects.filter(type="new_post").count(), 1)

    def test_unpublishing_keeps_likes_and_comments_but_hides_the_blog(self):
        blog = make_blog(self.alice)
        Like.objects.create(user=self.bob, blog=blog)
        Comment.objects.create(blog=blog, author=self.bob, body="hi")
        self.login_as(self.alice)
        self.PATCH(f"/blogs/{blog.id}/", {"status": "draft"})
        self.assertEqual(self.GET("/blogs/").data["count"], 0)
        self.assertEqual(Like.objects.count(), 1)
        self.assertEqual(Comment.objects.count(), 1)
        self.login_as(self.bob)
        self.assertEqual(self.GET("/users/me/likes/").data["count"], 0)

    def test_delete_removes_the_blog_and_everything_attached(self):
        blog = make_blog(self.alice)
        Like.objects.create(user=self.bob, blog=blog)
        Bookmark.objects.create(user=self.bob, blog=blog)
        Comment.objects.create(blog=blog, author=self.bob, body="hi")
        Notification.objects.create(recipient=self.alice, actor=self.bob, type="like", blog=blog)
        self.login_as(self.bob)
        self.assertEqual(self.DELETE(f"/blogs/{blog.id}/").status_code, 403)
        self.login_as(self.alice)
        self.assertEqual(self.DELETE(f"/blogs/{blog.id}/").status_code, 204)
        self.assertEqual(Blog.objects.count(), 0)
        self.assertEqual(
            (Like.objects.count(), Bookmark.objects.count(), Comment.objects.count(), Notification.objects.count()),
            (0, 0, 0, 0),
        )


# ==========================================================================
# Blogs: my blogs and search
# ==========================================================================
class MyBlogsAndSearchTests(BaseTest):
    def test_mine_needs_login_and_is_a_plain_list_of_my_blogs(self):
        make_blog(self.alice, title="Published")
        make_blog(self.alice, Blog.Status.DRAFT, title="Draft")
        make_blog(self.bob, title="Not mine")
        self.assertEqual(self.GET("/blogs/mine/").status_code, 401)
        self.login_as(self.alice)
        r = self.GET("/blogs/mine/")
        self.assertIsInstance(r.data, list)
        self.assertEqual({b["title"] for b in r.data}, {"Published", "Draft"})
        self.assertEqual([b["title"] for b in self.GET("/blogs/mine/", {"status": "draft"}).data], ["Draft"])
        self.assertEqual([b["title"] for b in self.GET("/blogs/mine/", {"status": "published"}).data], ["Published"])
        self.assertEqual(self.GET("/blogs/mine/", {"status": "removed"}).status_code, 400)

    def test_search_by_title_content_and_author(self):
        make_blog(self.alice, title="Django tips")
        make_blog(self.bob, title="Cooking", body="<p>All about django sauce</p>")
        make_blog(self.carol, title="Travel")
        make_blog(self.alice, Blog.Status.DRAFT, title="Django draft")

        r = self.GET("/blogs/search/", {"q": "DJANGO", "by": "title"})
        self.assertEqual(self.titles(r), ["Django tips"])
        r = self.GET("/blogs/search/", {"q": "sauce", "by": "content"})
        self.assertEqual(self.titles(r), ["Cooking"])
        r = self.GET("/blogs/search/", {"q": "carol", "by": "author"})
        self.assertEqual(self.titles(r), ["Travel"])
        r = self.GET("/blogs/search/", {"q": "tester", "by": "author"})  # last name
        self.assertEqual(r.data["count"], 3)

    def test_search_defaults_to_title_and_is_paginated(self):
        for n in range(12):
            make_blog(self.alice, title=f"Python {n}")
        r = self.GET("/blogs/search/", {"q": "python"})
        self.assertEqual(r.data["count"], 12)
        self.assertEqual(len(r.data["results"]), 10)
        self.assertIsNotNone(r.data["next"])

    def test_search_with_blank_query_or_bad_field(self):
        make_blog(self.alice)
        r = self.GET("/blogs/search/", {"q": "  ", "by": "title"})
        self.assertEqual((r.status_code, r.data["count"]), (200, 0))
        self.assertEqual(self.GET("/blogs/search/", {"q": "x", "by": "email"}).status_code, 400)


# ==========================================================================
# Comments
# ==========================================================================
class CommentTests(BaseTest):
    def setUp(self):
        super().setUp()
        self.blog = make_blog(self.alice)
        self.url = f"/blogs/{self.blog.id}/comments/"

    def test_add_and_list_oldest_first_as_a_plain_list(self):
        self.assertEqual(self.POST(self.url, {"body": "hi"}).status_code, 401)
        self.login_as(self.bob)
        r = self.POST(self.url, {"body": "First"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["body"], "First")
        self.assertEqual(r.data["author"]["username"], "bob")
        self.assertNotIn("email", r.data["author"])
        self.POST(self.url, {"body": "Second"})
        self.logout()
        listed = self.GET(self.url)
        self.assertEqual(listed.status_code, 200)
        self.assertIsInstance(listed.data, list)
        self.assertEqual([c["body"] for c in listed.data], ["First", "Second"])

    def test_empty_or_huge_comment_is_400(self):
        self.login_as(self.bob)
        self.assertEqual(self.POST(self.url, {"body": ""}).status_code, 400)
        self.assertEqual(self.POST(self.url, {"body": "x" * 2001}).status_code, 400)

    def test_removed_comments_are_hidden(self):
        Comment.objects.create(blog=self.blog, author=self.bob, body="ok")
        Comment.objects.create(blog=self.blog, author=self.bob, body="rude", status=Comment.Status.REMOVED)
        self.assertEqual([c["body"] for c in self.GET(self.url).data], ["ok"])

    def test_no_comments_on_drafts_or_missing_blogs(self):
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.login_as(self.alice)  # even the author
        self.assertEqual(self.POST(f"/blogs/{draft.id}/comments/", {"body": "x"}).status_code, 404)
        self.assertEqual(self.GET("/blogs/99999/comments/").status_code, 404)

    def test_commenting_notifies_the_author_but_not_for_your_own_comment(self):
        self.login_as(self.bob)
        self.POST(self.url, {"body": "Nice"})
        note = Notification.objects.get()
        self.assertEqual((note.recipient, note.actor, note.type, note.blog), (self.alice, self.bob, "comment", self.blog))
        self.login_as(self.alice)
        self.POST(self.url, {"body": "Thanks"})
        self.assertEqual(Notification.objects.count(), 1)

    def test_only_the_commenter_can_delete(self):
        comment = Comment.objects.create(blog=self.blog, author=self.bob, body="mine")
        url = f"{self.url}{comment.id}/"
        self.assertEqual(self.DELETE(url).status_code, 401)
        self.login_as(self.alice)  # the blog's author is not the commenter
        self.assertEqual(self.DELETE(url).status_code, 403)
        self.login_as(self.bob)
        self.assertEqual(self.DELETE(url).status_code, 204)
        self.assertEqual(Comment.objects.count(), 0)

    def test_comment_must_belong_to_that_blog(self):
        other = make_blog(self.carol)
        comment = Comment.objects.create(blog=other, author=self.bob, body="elsewhere")
        self.login_as(self.bob)
        self.assertEqual(self.DELETE(f"{self.url}{comment.id}/").status_code, 404)


# ==========================================================================
# Likes and bookmarks
# ==========================================================================
class LikeTests(BaseTest):
    def setUp(self):
        super().setUp()
        self.blog = make_blog(self.alice)
        self.url = f"/blogs/{self.blog.id}/like/"

    def test_like_and_unlike_answer_with_the_new_state(self):
        self.assertEqual(self.POST(self.url).status_code, 401)
        self.login_as(self.bob)
        r = self.POST(self.url)
        self.assertEqual((r.status_code, r.data), (200, {"liked": True, "likes_count": 1}))
        r = self.DELETE(self.url)
        self.assertEqual((r.status_code, r.data), (200, {"liked": False, "likes_count": 0}))

    def test_repeating_is_harmless(self):
        self.login_as(self.bob)
        self.POST(self.url)
        r = self.POST(self.url)
        self.assertEqual(r.data, {"liked": True, "likes_count": 1})
        self.assertEqual(Like.objects.count(), 1)
        self.DELETE(self.url)
        r = self.DELETE(self.url)
        self.assertEqual(r.data, {"liked": False, "likes_count": 0})

    def test_drafts_cannot_be_liked(self):
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.login_as(self.alice)
        self.assertEqual(self.POST(f"/blogs/{draft.id}/like/").status_code, 404)

    def test_like_notifies_the_author_once_per_person(self):
        self.login_as(self.bob)
        self.POST(self.url)
        self.DELETE(self.url)
        self.POST(self.url)  # unlike then like again stays quiet
        self.assertEqual(Notification.objects.filter(type="like").count(), 1)
        self.login_as(self.carol)
        self.POST(self.url)
        self.assertEqual(Notification.objects.filter(type="like").count(), 2)

    def test_liking_your_own_blog_does_not_notify(self):
        self.login_as(self.alice)
        self.POST(self.url)
        self.assertEqual(Notification.objects.count(), 0)

    def test_likers_list_is_public_newest_first_and_paginated(self):
        now = timezone.now()
        Like.objects.create(user=self.bob, blog=self.blog)
        Like.objects.create(user=self.carol, blog=self.blog)
        Like.objects.filter(user=self.bob).update(created_at=now - timedelta(hours=1))
        r = self.GET(f"/blogs/{self.blog.id}/likes/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p["username"] for p in r.data["results"]], ["carol", "bob"])
        self.assertEqual(set(r.data["results"][0]), PERSON_KEYS)

    def test_my_likes_newest_first_skipping_drafts_and_unpublished(self):
        now = timezone.now()
        older = make_blog(self.alice, title="Older like")
        newer = make_blog(self.alice, title="Newer like")
        hidden = make_blog(self.alice, title="Later unpublished")
        for blog in (older, newer, hidden):
            Like.objects.create(user=self.bob, blog=blog)
        Like.objects.filter(blog=older).update(created_at=now - timedelta(hours=2))
        Like.objects.filter(blog=newer).update(created_at=now - timedelta(hours=1))
        Like.objects.filter(blog=hidden).update(created_at=now - timedelta(hours=3))
        Blog.objects.filter(pk=hidden.pk).update(status=Blog.Status.DRAFT)

        self.assertEqual(self.GET("/users/me/likes/").status_code, 401)
        self.login_as(self.bob)
        r = self.GET("/users/me/likes/")
        self.assertEqual(self.titles(r), ["Newer like", "Older like"])
        # counts stay correct (the filter must not shrink them)
        Like.objects.create(user=self.carol, blog=newer)
        r = self.GET("/users/me/likes/")
        self.assertEqual(r.data["results"][0]["likes_count"], 2)
        self.assertTrue(r.data["results"][0]["liked_by_me"])


class BookmarkTests(BaseTest):
    def setUp(self):
        super().setUp()
        self.blog = make_blog(self.alice)
        self.url = f"/blogs/{self.blog.id}/bookmark/"

    def test_bookmark_and_remove(self):
        self.assertEqual(self.POST(self.url).status_code, 401)
        self.login_as(self.bob)
        self.assertEqual(self.POST(self.url).data, {"bookmarked": True})
        self.assertEqual(self.POST(self.url).data, {"bookmarked": True})  # repeating is harmless
        self.assertEqual(Bookmark.objects.count(), 1)
        self.assertEqual(self.DELETE(self.url).data, {"bookmarked": False})
        self.assertEqual(self.DELETE(self.url).data, {"bookmarked": False})

    def test_drafts_cannot_be_bookmarked_and_nobody_is_notified(self):
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.login_as(self.alice)
        self.assertEqual(self.POST(f"/blogs/{draft.id}/bookmark/").status_code, 404)
        self.login_as(self.bob)
        self.POST(self.url)
        self.assertEqual(Notification.objects.count(), 0)

    def test_my_bookmarks_are_private_and_newest_first(self):
        other = make_blog(self.alice, title="Second")
        Bookmark.objects.create(user=self.bob, blog=self.blog)
        Bookmark.objects.create(user=self.bob, blog=other)
        Bookmark.objects.filter(blog=self.blog).update(created_at=timezone.now() - timedelta(hours=1))
        Bookmark.objects.create(user=self.carol, blog=self.blog)

        self.assertEqual(self.GET("/users/me/bookmarks/").status_code, 401)
        self.login_as(self.bob)
        r = self.GET("/users/me/bookmarks/")
        self.assertEqual(self.titles(r), ["Second", "Hello"])
        self.assertTrue(all(b["bookmarked_by_me"] for b in r.data["results"]))
        self.login_as(self.carol)
        self.assertEqual(self.titles(self.GET("/users/me/bookmarks/")), ["Hello"])


# ==========================================================================
# Follows and profiles
# ==========================================================================
class FollowTests(BaseTest):
    def test_follow_and_unfollow(self):
        url = f"/users/{self.alice.id}/follow/"
        self.assertEqual(self.POST(url).status_code, 401)
        self.login_as(self.bob)
        r = self.POST(url)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["is_following"])
        self.assertEqual(r.data["followers_count"], 1)
        self.POST(url)  # repeating is harmless
        self.assertEqual(Follow.objects.count(), 1)
        r = self.DELETE(url)
        self.assertFalse(r.data["is_following"])
        self.assertEqual(self.DELETE(url).status_code, 200)
        self.assertEqual(Follow.objects.count(), 0)

    def test_cannot_follow_yourself_or_a_stranger_id(self):
        self.login_as(self.bob)
        r = self.POST(f"/users/{self.bob.id}/follow/")
        self.assertEqual(r.status_code, 400)
        self.assertIsInstance(r.data["detail"], str)
        self.assertEqual(self.POST("/users/99999/follow/").status_code, 404)

    def test_follow_notifies_once_while_unread(self):
        url = f"/users/{self.alice.id}/follow/"
        self.login_as(self.bob)
        self.POST(url)
        self.DELETE(url)
        self.POST(url)  # unfollow + follow again while the first is still unread
        self.assertEqual(Notification.objects.filter(type="follow").count(), 1)
        note = Notification.objects.get()
        self.assertEqual((note.recipient, note.actor), (self.alice, self.bob))
        self.assertIsNone(note.blog)
        Notification.objects.update(is_read=True)
        self.DELETE(url)
        self.POST(url)
        self.assertEqual(Notification.objects.filter(type="follow").count(), 2)

    def test_my_followers_and_following_are_plain_lists(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        Follow.objects.create(follower=self.carol, following=self.alice)
        Follow.objects.create(follower=self.alice, following=self.bob)
        self.login_as(self.alice)
        followers = self.GET("/users/me/followers/")
        self.assertIsInstance(followers.data, list)
        self.assertEqual({p["username"] for p in followers.data}, {"bob", "carol"})
        following = self.GET("/users/me/following/")
        self.assertEqual([p["username"] for p in following.data], ["bob"])
        self.assertTrue(following.data[0]["is_following"])
        self.assertEqual(set(following.data[0]), PERSON_KEYS)

    def test_my_follow_lists_need_login(self):
        self.assertEqual(self.GET("/users/me/followers/").status_code, 401)
        self.assertEqual(self.GET("/users/me/following/").status_code, 401)


class ProfileTests(BaseTest):
    PUBLIC_KEYS = PERSON_KEYS | {"date_joined", "posts_count", "followers_count", "following_count"}

    def test_public_profile_has_no_private_data(self):
        make_blog(self.alice)
        make_blog(self.alice, Blog.Status.DRAFT)
        Follow.objects.create(follower=self.bob, following=self.alice)
        Follow.objects.create(follower=self.alice, following=self.carol)
        r = self.GET("/profiles/alice/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.data), self.PUBLIC_KEYS)
        for secret in ["email", "drafts_count", "liked_count", "bookmarks_count"]:
            self.assertNotIn(secret, r.data)
        self.assertEqual(
            (r.data["posts_count"], r.data["followers_count"], r.data["following_count"]),
            (1, 1, 1),
        )
        self.assertFalse(r.data["is_following"])
        self.login_as(self.bob)
        self.assertTrue(self.GET("/profiles/alice/").data["is_following"])

    def test_username_lookup_ignores_case_and_unknown_or_inactive_is_404(self):
        self.assertEqual(self.GET("/profiles/ALICE/").status_code, 200)
        self.assertEqual(self.GET("/profiles/nobody/").status_code, 404)
        self.carol.is_active = False
        self.carol.save()
        self.assertEqual(self.GET("/profiles/carol/").status_code, 404)
        self.assertEqual(self.GET("/profiles/carol/blogs/").status_code, 404)

    def test_profile_blogs_are_published_only_and_paginated(self):
        for n in range(11):
            make_blog(self.alice, title=f"Blog {n}", published_at=timezone.now() - timedelta(minutes=n))
        make_blog(self.alice, Blog.Status.DRAFT, title="Draft")
        make_blog(self.bob, title="Bob's")
        r = self.GET("/profiles/alice/blogs/")
        self.assertEqual(r.data["count"], 11)
        self.assertEqual(len(r.data["results"]), 10)
        self.assertNotIn("Draft", self.titles(r))
        self.assertIsNotNone(r.data["next"])
        self.login_as(self.alice)  # even the owner doesn't see drafts here
        self.assertEqual(self.GET("/profiles/alice/blogs/").data["count"], 11)

    def test_profile_follower_and_following_lists_are_public_and_paginated(self):
        Follow.objects.create(follower=self.bob, following=self.alice)
        Follow.objects.create(follower=self.alice, following=self.carol)
        r = self.GET("/profiles/alice/followers/")
        self.assertEqual([p["username"] for p in r.data["results"]], ["bob"])
        self.assertIn("count", r.data)
        r = self.GET("/profiles/alice/following/")
        self.assertEqual([p["username"] for p in r.data["results"]], ["carol"])
        self.assertNotIn("email", r.data["results"][0])


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class MeTests(BaseTest):
    def test_private_profile_shape_and_counts(self):
        liked = make_blog(self.bob)
        saved = make_blog(self.bob)
        gone = make_blog(self.bob)
        make_blog(self.alice)
        make_blog(self.alice, Blog.Status.DRAFT)
        Like.objects.create(user=self.alice, blog=liked)
        Like.objects.create(user=self.alice, blog=gone)
        Bookmark.objects.create(user=self.alice, blog=saved)
        Blog.objects.filter(pk=gone.pk).update(status=Blog.Status.DRAFT)  # no longer counts
        Follow.objects.create(follower=self.bob, following=self.alice)
        Follow.objects.create(follower=self.alice, following=self.bob)
        Follow.objects.create(follower=self.alice, following=self.carol)

        self.assertEqual(self.GET("/users/me/").status_code, 401)
        self.login_as(self.alice)
        r = self.GET("/users/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["email"], "alice@example.com")
        self.assertEqual(
            {k: r.data[k] for k in ["posts_count", "drafts_count", "followers_count", "following_count", "liked_count", "bookmarks_count"]},
            {"posts_count": 1, "drafts_count": 1, "followers_count": 1, "following_count": 2, "liked_count": 1, "bookmarks_count": 1},
        )
        self.assertIsNone(r.data["avatar"])

    def test_avatar_can_be_set_and_cleared(self):
        self.login_as(self.alice)
        r = self.PATCH("/users/me/", {"avatar": png("me.png")}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["avatar"].endswith(".png"))
        r = self.PATCH("/users/me/", {"avatar": ""}, format="multipart")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["avatar"])

    def test_avatar_shows_up_next_to_the_author(self):
        make_blog(self.alice)
        self.login_as(self.alice)
        self.PATCH("/users/me/", {"avatar": png()}, format="multipart")
        author = self.GET("/blogs/").data["results"][0]["author"]
        self.assertTrue(author["avatar"].endswith(".png"))

    def test_avatar_must_be_a_real_image(self):
        self.login_as(self.alice)
        fake = SimpleUploadedFile("x.png", b"nope", content_type="image/png")
        self.assertEqual(self.PATCH("/users/me/", {"avatar": fake}, format="multipart").status_code, 400)

    def test_other_fields_cannot_be_changed_here(self):
        self.login_as(self.alice)
        self.PATCH("/users/me/", {"email": "hacked@example.com", "username": "root", "is_staff": True})
        self.alice.refresh_from_db()
        self.assertEqual((self.alice.email, self.alice.username, self.alice.is_staff), ("alice@example.com", "alice", False))


# ==========================================================================
# Notifications
# ==========================================================================
class NotificationTests(BaseTest):
    def test_list_is_my_own_newest_first_and_a_plain_list(self):
        blog = make_blog(self.alice)
        first = Notification.objects.create(recipient=self.alice, actor=self.bob, type="comment", blog=blog)
        second = Notification.objects.create(recipient=self.alice, actor=self.carol, type="follow")
        Notification.objects.create(recipient=self.bob, actor=self.alice, type="follow")
        Notification.objects.filter(pk=first.pk).update(created_at=timezone.now() - timedelta(hours=1))

        self.assertEqual(self.GET("/notifications/").status_code, 401)
        self.login_as(self.alice)
        r = self.GET("/notifications/")
        self.assertIsInstance(r.data, list)
        self.assertEqual([n["id"] for n in r.data], [second.id, first.id])

    def test_notification_shape(self):
        blog = make_blog(self.alice, title="Hello, Monolith")
        Notification.objects.create(recipient=self.alice, actor=self.bob, type="comment", blog=blog)
        Notification.objects.create(recipient=self.alice, actor=self.carol, type="follow")
        self.login_as(self.alice)
        by_type = {n["type"]: n for n in self.GET("/notifications/").data}
        comment = by_type["comment"]
        self.assertEqual(set(comment), {"id", "type", "is_read", "created_at", "actor", "blog"})
        self.assertEqual(comment["blog"], {"id": blog.id, "title": "Hello, Monolith"})
        self.assertEqual(set(comment["actor"]), PERSON_KEYS)
        self.assertIs(comment["is_read"], False)
        self.assertIsNone(by_type["follow"]["blog"])

    def test_only_the_latest_30_are_returned(self):
        for _ in range(35):
            Notification.objects.create(recipient=self.alice, actor=self.bob, type="follow")
        self.login_as(self.alice)
        self.assertEqual(len(self.GET("/notifications/").data), 30)

    def test_notifications_of_unpublished_blogs_are_hidden(self):
        blog = make_blog(self.alice)
        Notification.objects.create(recipient=self.alice, actor=self.bob, type="like", blog=blog)
        self.login_as(self.alice)
        self.assertEqual(len(self.GET("/notifications/").data), 1)
        Blog.objects.filter(pk=blog.pk).update(status=Blog.Status.DRAFT)
        self.assertEqual(len(self.GET("/notifications/").data), 0)
        Blog.objects.filter(pk=blog.pk).update(status=Blog.Status.PUBLISHED)
        self.assertEqual(len(self.GET("/notifications/").data), 1)

    def test_mark_one_read_only_changes_is_read_and_only_for_the_recipient(self):
        note = Notification.objects.create(recipient=self.alice, actor=self.bob, type="follow")
        url = f"/notifications/{note.id}/"
        self.assertEqual(self.PATCH(url, {"is_read": True}).status_code, 401)
        self.login_as(self.bob)
        self.assertEqual(self.PATCH(url, {"is_read": True}).status_code, 404)
        self.login_as(self.alice)
        r = self.PATCH(url, {"is_read": True, "type": "like", "actor": self.carol.id})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["is_read"])
        note.refresh_from_db()
        self.assertEqual((note.is_read, note.type, note.actor), (True, "follow", self.bob))

    def test_mark_all_read_only_touches_my_notifications(self):
        Notification.objects.create(recipient=self.alice, actor=self.bob, type="follow")
        Notification.objects.create(recipient=self.alice, actor=self.carol, type="follow")
        theirs = Notification.objects.create(recipient=self.bob, actor=self.alice, type="follow")
        self.assertEqual(self.POST("/notifications/mark-all-read/").status_code, 401)
        self.login_as(self.alice)
        self.assertEqual(self.POST("/notifications/mark-all-read/").status_code, 204)
        self.assertEqual(Notification.objects.filter(recipient=self.alice, is_read=False).count(), 0)
        theirs.refresh_from_db()
        self.assertFalse(theirs.is_read)

    def test_delete_is_permanent_and_only_for_the_recipient(self):
        note = Notification.objects.create(recipient=self.alice, actor=self.bob, type="follow")
        url = f"/notifications/{note.id}/"
        self.login_as(self.bob)
        self.assertEqual(self.DELETE(url).status_code, 404)
        self.login_as(self.alice)
        self.assertEqual(self.DELETE(url).status_code, 204)
        self.assertFalse(Notification.objects.filter(pk=note.id).exists())


# ==========================================================================
# Reports
# ==========================================================================
class ReportTests(BaseTest):
    def setUp(self):
        super().setUp()
        self.blog = make_blog(self.alice)
        self.comment = Comment.objects.create(blog=self.blog, author=self.alice, body="hi")

    def report(self, target_type, target_id, reason="spam", details=""):
        return self.POST("/reports/", {"target_type": target_type, "target_id": target_id, "reason": reason, "details": details})

    def test_needs_login(self):
        self.assertEqual(self.report("blog", self.blog.id).status_code, 401)

    def test_report_a_blog_a_comment_and_a_user(self):
        self.login_as(self.bob)
        for target_type, target_id in [("blog", self.blog.id), ("comment", self.comment.id), ("user", self.alice.id)]:
            r = self.report(target_type, target_id, details="because")
            self.assertEqual(r.status_code, 201, target_type)
            self.assertEqual(r.data["status"], "open")
        self.assertEqual(Report.objects.filter(reporter=self.bob).count(), 3)

    def test_one_report_per_person_per_item(self):
        self.login_as(self.bob)
        self.assertEqual(self.report("blog", self.blog.id).status_code, 201)
        r = self.report("blog", self.blog.id, reason="harassment")
        self.assertEqual(r.status_code, 400)
        self.assertIsInstance(r.data["detail"], str)
        self.login_as(self.carol)  # someone else may report the same blog
        self.assertEqual(self.report("blog", self.blog.id).status_code, 201)

    def test_cannot_report_yourself_or_your_own_content(self):
        self.login_as(self.alice)
        self.assertEqual(self.report("blog", self.blog.id).status_code, 400)
        self.assertEqual(self.report("comment", self.comment.id).status_code, 400)
        self.assertEqual(self.report("user", self.alice.id).status_code, 400)

    def test_other_needs_details(self):
        self.login_as(self.bob)
        r = self.report("blog", self.blog.id, reason="other", details="  ")
        self.assertEqual(r.status_code, 400)
        self.assertIn("details", r.data)
        self.assertEqual(self.report("blog", self.blog.id, reason="other", details="Explained").status_code, 201)

    def test_bad_input_is_400(self):
        self.login_as(self.bob)
        self.assertEqual(self.report("post", self.blog.id).status_code, 400)  # unknown type
        self.assertEqual(self.report("blog", 99999).status_code, 400)  # doesn't exist
        self.assertEqual(self.report("blog", self.blog.id, reason="").status_code, 400)
        draft = make_blog(self.alice, Blog.Status.DRAFT)
        self.assertEqual(self.report("blog", draft.id).status_code, 400)  # can't see it, can't report it

    def test_reports_are_write_only_over_the_api(self):
        self.login_as(self.bob)
        self.assertEqual(self.GET("/reports/").status_code, 405)
