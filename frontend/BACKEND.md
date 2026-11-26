# What the Django backend has to handle

A checklist for the Django REST Framework side of Monolith, written from what this React client expects. Items are grouped by when you need them:

- **A. Needed to connect:** the frontend breaks or lies without these.
- **B. Needed before real users:** security, abuse protection, performance.
- **C. Later:** improvements, not blockers.

Endpoint paths are the ones used in `src/api/realApi.js`. If your `urls.py` differs, change `realApi.js`, not the pages. `tests/realApi.test.js` checks every path listed here.

---

## A. Needed to connect

### A1. General contract

| Topic | What the frontend expects |
| --- | --- |
| Base URL | `/api/v1` (set `VITE_API_URL` to change it). In dev, Vite proxies `/api` and `/media` to `127.0.0.1:8000`. |
| Auth | DRF `TokenAuthentication`: header `Authorization: Token <key>`. Logged-out reads must work for public data (feed, search, blogs, profiles, likers, followers). |
| Expired login | Return **401** for a bad or expired token. The frontend then clears the saved login by itself and shows the logged-out navbar. |
| Not found | Return **404** for a missing blog or user. The frontend shows a proper "not found" page. Also use 404 for a draft requested by someone who is not its author (do not reveal that it exists). |
| Errors | `{"detail": "..."}` or `{"field": ["message"]}`. Messages are shown to the user as-is, so keep them readable. |
| Pagination | Standard DRF page shape `{count, next, previous, results}`, 10 per page (any size works). The frontend only uses `results` and whether `next` exists. |
| Uploads | Blogs (`cover_image`) and the avatar are sent as `multipart/form-data`. To clear an image the frontend sends the field with an empty value, so the `ImageField` needs `allow_null=True`. |
| Rich text | `body` is HTML from the Tiptap editor. |

### A2. Endpoints

| Purpose | Request | Notes |
| --- | --- | --- |
| Log in / register / log out | `POST /auth/login/`, `/auth/register/`, `/auth/logout/` | Returns `{token, user}`. `user` includes `email` and `avatar`. |
| Forgot password | `POST /auth/forgot-password/` `{email}` | Always answer the same way, so nobody can find out which emails have accounts. |
| Feed | `GET /blogs/?feed=latest\|following\|recommended&page=` | Published posts only. `latest` = newest first. `following` needs login. `recommended` = your own ranking (see A5). No `feed` param means latest. |
| Search | `GET /blogs/search/?q=&by=title\|content\|author&page=` | Published only. `by` picks the one field to search. |
| My posts / drafts | `GET /blogs/mine/?status=published\|draft` | A plain list is fine (not paginated). |
| Blog | `GET / PATCH / DELETE /blogs/:id/`, `POST /blogs/` | Only the author may change or delete. Drafts are visible only to the author. |
| Comments | `GET / POST /blogs/:id/comments/`, `DELETE /blogs/:id/comments/:cid/` | Only on published posts. Only the commenter may delete. |
| Like / unlike | `POST / DELETE /blogs/:id/like/` | Reply `{"liked": true, "likes_count": 12}`. Must be **safe to repeat** (liking twice stays one like). Published posts only. |
| Who liked a post | `GET /blogs/:id/likes/?page=` | People (see A3), newest like first. Public. |
| My liked posts | `GET /users/me/likes/?page=` | Blogs, most recently liked first. Skip drafts and deleted posts. |
| Bookmark / unbookmark | `POST / DELETE /blogs/:id/bookmark/` | Reply `{"bookmarked": true}`. Same rules as likes. |
| My bookmarks | `GET /users/me/bookmarks/?page=` | Blogs, most recently saved first. **Private.** |
| My profile (private) | `GET /users/me/`, `PATCH /users/me/` | PATCH multipart with `avatar` (file, or empty to clear). Includes email and the private counts (A3). |
| Public profile | `GET /profiles/:username/` | **Never** email or drafts. |
| A user's posts | `GET /profiles/:username/blogs/?page=` | Published only. |
| A user's followers / following | `GET /profiles/:username/followers/?page=` and `/following/?page=` | People. Public. |
| My followers / following | `GET /users/me/followers/`, `/users/me/following/` | A plain list is fine. |
| Follow / unfollow | `POST / DELETE /users/:id/follow/` | No following yourself. Repeating is harmless. |
| Notifications | `GET /notifications/` | The logged-in user's own, newest first (the frontend shows the latest ~30). |
| Mark one read | `PATCH /notifications/:id/` `{"is_read": true}` | Only the recipient. |
| **Mark all read** | `POST /notifications/mark-all-read/` | Marks every one of the user's notifications read. 204 or 200 is fine. |
| Delete one | `DELETE /notifications/:id/` | Permanent. Only the recipient. |
| Report | `POST /reports/` `{target_type, target_id, reason, details}` | `target_type` is `blog`, `comment` or `user`. |

### A3. Response shapes

```jsonc
// "person": inside blogs, comments, follow lists, likers and notifications. NEVER has an email.
{ "id": 2, "username": "asha", "first_name": "Asha", "last_name": "Menon",
  "avatar": "url or null", "is_following": false }   // is_following is about the person asking; false when logged out

// blog
{ "id": 1, "title": "...", "body": "<p>...</p>", "cover_image": "url or null",
  "status": "published",                  // or "draft"
  "author": { /* person */ },
  "likes_count": 12, "comments_count": 3,
  "liked_by_me": false, "bookmarked_by_me": false,   // false when logged out
  "created_at": "ISO", "updated_at": "ISO", "published_at": "ISO or null" }

// GET /users/me/   (private)
{ "id": 1, "username": "...", "email": "...", "first_name": "...", "last_name": "...", "avatar": "...",
  "date_joined": "ISO", "posts_count": 3, "drafts_count": 1, "followers_count": 2, "following_count": 4,
  "liked_count": 5, "bookmarks_count": 2 }     // liked/bookmarks: published posts only

// GET /profiles/:username/   (public: a separate serializer, no email, no drafts_count, no liked/bookmarks counts)
{ "id": 2, "username": "asha", "first_name": "...", "last_name": "...", "avatar": "...",
  "date_joined": "ISO", "posts_count": 2, "followers_count": 2, "following_count": 1, "is_following": false }

// notification: "blog" is null for follows
{ "id": 7, "type": "comment",             // "follow" | "comment" | "like" | "new_post"
  "is_read": false, "created_at": "ISO",
  "actor": { /* person */ }, "blog": { "id": 5, "title": "Hello, Monolith" } }
```

**Privacy rule that matters most:** never expose who bookmarked a post, or how many people did. Only the viewer's own `bookmarked_by_me`.

### A4. Models you need

- **Profile/User:** `avatar = ImageField(null=True, blank=True)`.
- **Blog:** `status` (`draft`/`published`), `published_at` (set the first time it is published), `cover_image`.
- **Comment, Follow** (unique on follower+following).
- **Like** (user, blog, created_at), **unique on (user, blog)**.
- **Bookmark**: same shape, unique on (user, blog).
- **Notification:** recipient, actor, `type` (`follow`, `comment`, `like`, `new_post`), optional blog, `is_read`, `created_at`.
- **Report:** reporter, `target_type`, `target_id`, `reason`, `details`, `status` (`open`/`reviewed`/`dismissed`/`actioned`), `created_at`; unique on (reporter, target_type, target_id).

### A5. Business rules

- **Drafts** can't be liked, bookmarked or commented on, and only the author can read them.
- **Unpublishing** a post (published to draft): keep its likes and comments, but hide it from every list, and hide its notifications (the frontend assumes this).
- **Deleting** a post removes its comments, likes, bookmarks and notifications.
- **Counts:** `likes_count` and `comments_count` on every blog in every list. Use `annotate(Count(..., distinct=True))` and `select_related`/`prefetch_related`, or a list of 10 posts will cost 30+ queries. `liked_by_me` and `bookmarked_by_me` can be an `Exists(...)` annotation.
- **Reports:** no reporting your own content or yourself, one report per person per item, `other` needs `details`. Validate the reason against the same lists as `src/lib/reports.js`.
- **Search:** case-insensitive contains on the chosen field. For `author`, match first name, last name and username.
- **Recommended feed:** this is your decision. A sensible first version: published posts, excluding the viewer's own and ones they already liked, ordered by `(likes + 2 × comments + 1) / (age_in_days + 2)^1.5`, with ties by newest. Later: boost authors the viewer follows or tags they like. It must work for logged-out readers (plain popularity).

### A6. Notifications (create them on the server)

The frontend only displays them. Create a notification when:

| Event | Recipient | Type | Rules |
| --- | --- | --- | --- |
| Someone follows you | the followed user | `follow` | Skip if one from the same person is already unread. |
| Someone comments on a post | the post's author | `comment` | Not for your own comments on your own post. |
| **Someone likes a post** | the post's author | `like` | Not for your own likes. **Once per person per post** (unlike then like again stays quiet), otherwise people can spam an author by toggling. |
| A followed author publishes | each follower | `new_post` | Only the first time a post is published, never for edits. |

Do it in the view or service layer, or with Django signals. Never notify someone about their own action. For a very popular post, consider grouping later ("Asha and 5 others liked …"); the current UI shows one row per notification.

---

## B. Needed before real users

### B1. Rate limiting (DRF throttling)

Set `DEFAULT_THROTTLE_CLASSES` (`AnonRateThrottle`, `UserRateThrottle`) and add **scoped** throttles for the dangerous endpoints. Suggested starting values, tune them later:

| Endpoint | Scope | Suggested limit |
| --- | --- | --- |
| Login | by IP and by username | 5/min, 20/hour |
| Register | by IP | 5/hour |
| Forgot password | by IP and by email | 3/hour |
| Like, bookmark, follow (and their undo) | by user | 60/min |
| Comments | by user | 10/min |
| Reports | by user | 10/hour |
| Create / update blog | by user | 20/hour |
| Search | by IP | 30/min |
| Avatar / cover uploads | by user | 10/hour |
| Everything else | anon / user | 100/hour anon, 1000/hour user |

Throttle state needs a shared cache (Redis) in production; the default per-process cache does not work with several workers. Return **429** with a `Retry-After` header.

### B2. Security

- **Sanitize blog HTML on save** (for example `nh3`) with an allow-list matching Tiptap's output: `p, h2, h3, strong, em, s, code, pre, blockquote, ul, ol, li, a[href], br, hr`. The frontend also sanitizes with DOMPurify, but never rely on the client. Force `rel="noopener noreferrer"` on links.
- **Image uploads:** limit size (5 MB covers, 2 MB avatars, as the frontend assumes), verify with Pillow (not just the extension), re-encode, strip EXIF (it can contain GPS), cap dimensions, random file names. Serve media from separate storage (S3 or similar) in production.
- **Permissions:** object-level checks everywhere (author-only edit/delete, recipient-only notifications, owner-only bookmarks). Test each with a second user.
- **Don't leak:** emails only in `/auth/*` and `/users/me/`; 404 (not 403) for other people's drafts; same answer for forgot-password whether the email exists or not.
- **Tokens:** plain DRF tokens never expire. At least rotate on login/logout and delete on password change; better, use expiring JWTs (then change `authHeader()` in `realApi.js` to `Bearer`). The frontend stores the token in `localStorage`; httpOnly cookies are safer but need CSRF handling.
- **Passwords:** Django's validators, a minimum length, hashing with the default PBKDF2/Argon2, a **password reset confirmation** endpoint and email (the frontend page for the emailed link is not built yet).
- **Email verification** at sign-up (optional but recommended) so reports and notifications can't be aimed at fake accounts.
- **Settings for production:** `DEBUG=False`, `ALLOWED_HOSTS`, HTTPS only, secure cookies, `CORS_ALLOWED_ORIGINS` set to your real frontend only, secrets from environment variables, `SECURE_*` headers.
- **Username rules:** case-insensitive unique, no spaces, block reserved names (`admin`, `me`, `api`, ...). The frontend uses `/users/:username`, so a username that looks like another route would be confusing.

### B3. Performance and data integrity

- Database constraints: unique on Like, Bookmark, Follow, Report (see A4), so repeated or racing requests cannot create duplicates (use `get_or_create`, catch `IntegrityError`).
- Indexes: `Blog(status, published_at)`, `Like(blog)`, `Like(user, created_at)`, `Bookmark(user, created_at)`, `Notification(recipient, is_read, created_at)`, `Follow(following)`, `Follow(follower)`.
- Page size cap: set `max_page_size` so nobody asks for `?page_size=100000`.
- Search: `icontains` is fine to start; move to PostgreSQL full-text search (or similar) when it gets slow.
- Old notifications: delete or archive after a while; the list only shows the latest ~30.
- Count caching: if counts get slow, store `likes_count` / `comments_count` on the Blog and update with signals or `F()` expressions.

### B4. Moderation (the separate admin panel)

You said reports are reviewed in a separate admin UI. The backend needs:

- The report list with status, reporter, target (title / comment text / username) and filters by reason and status.
- Actions: dismiss, hide or remove a blog or comment, warn or suspend a user. Hidden content must disappear from **every** API response (feed, search, profile, likes and bookmarks lists, notifications).
- A suspended user's token must stop working (401), so the frontend logs them out.
- An audit log of who did what, and optionally a notification to the reporter when a report is resolved.
- Group repeated reports for the same target so moderators see one item.

### B5. Operations

- Automated tests (`pytest-django` or Django's test runner): every permission rule above, like/bookmark idempotency, notification rules, privacy of bookmarks and email.
- API docs (`drf-spectacular`) so the contract above is checked, not only written.
- Logging and error tracking (Sentry or similar); backups; a CI pipeline that runs tests; migrations reviewed.

---

## C. Later

- Email notifications (or digests) alongside the in-app ones; web push or WebSockets instead of the 60-second polling the bell does now.
- Grouped notifications; notification preferences per type.
- Tags or categories, and a "trending" feed.
- Personalized recommendations (follows, likes, reading history).
- Soft delete and restore for posts; edit history.
- Blocking and muting users; per-user comment controls.
- Bio and links on profiles (and editing user details, which has no UI yet).
- Account deletion and data export (privacy law compliance).
- Draft autosave; scheduled publishing.
- Page numbers for search: return `count` and the frontend can show them.
