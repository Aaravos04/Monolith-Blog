# HANDOFF: Monolith blog frontend (read this first in a new chat)

**To the next Claude:** this file is the full brief. Read all of it, then `README.md` (how the app works and the API contract) and `BACKEND.md` (what the Django side must do). Do not redo finished work. If this folder is not in your workspace, ask the user to attach the latest `monolith-frontend-v*.zip` and unzip it.

Current version: **0.4.0** (the "final version", plus the polish round described in section 9).

---

## 1. The project and the person

- **Monolith: Multi-user Blog App.** Django REST Framework backend (built by the user separately) plus this React client. This repo is **only the client**.
- The user is **fairly beginner in Django** (was taught one `UserSerializer` for everything; has used plain `urlpatterns`, not DRF routers; prefers function-based views unless class-based ones have specific benefits, and wants to be told those benefits first; renamed the `Post` model to `Blog`; uses the default Django user model; their API lives under `/api/v1` with auth, users, blogs, reports, comments, notifications). If you help with the backend, explain simply and say why.
- They are comfortable in React but like plain explanations. They want to be **told when you add something they did not ask for** (for example an extra place a feature appears).
- Report moderation happens in a **separate admin panel**, not in this client.
- Claude Project: "Monolith: Multi-user Blog App". Memory notes about the user live under that project.

## 2. Standing rules (the user's preferences: follow them every time)

**Code style (checked by `dev-tools/check3.cjs`)**
- `const` arrow functions only. No `function` declarations, no function expressions, no method shorthand in objects.
- **All `export`s at the end of the file**, nothing after them. Components use `export default X;` at the bottom.
- One exception: React error boundaries must be classes. `ErrorBoundary.jsx` uses arrow-function class properties (`render = () => ...`) to stay within the rules.

**Design**
- **Black and white only.** Use the four tokens in `src/index.css`: `ink` (#000), `paper` (#fff), `muted` (#525252), `subtle` (#f5f5f5). No colours, no themes (colour may come later, and the tokens make that a one-file change).
- **No animations.** Only a few hover effects.
- **Lucide icons** (`lucide-react`).
- Navbar and Footer are shared (`components/layout/Layout.jsx` wraps every page).
- Reusable classes in `index.css`: `.btn .btn-primary .btn-outline .btn-sm .input .label .card .notice`.

**How to work (the user asked for this explicitly)**
- Large changes: analyze, split into **small, independently verifiable milestones**, estimate which files are heaviest, **do one milestone per response** unless told otherwise.
- After each milestone say: **what changed, what remains, how to verify.**
- **Preserve existing behavior** unless a change requires otherwise.
- **Never claim something is complete unless it was produced and, where possible, verified.** Be honest about what could not be verified (see section 7).
- Work big files in logical sections with no duplicate definitions.
- If a usage limit is near, leave an exact handoff (progress, remaining work, file names, next step). Keep this file current for that reason.
- Deliver files to the user with SendUserFile (they once thought nothing had been sent). Send a zip at each meaningful stop.
- Be warm and brief. The user is appreciative; no need for long recaps.

## 3. Tech stack

React 18 · React Router 6 · Vite 5 · Tailwind CSS v4 (`@tailwindcss/vite`, `@tailwindcss/typography` for `.prose`) · `lucide-react` · Tiptap (StarterKit, Link, Placeholder) for the editor · DOMPurify for displaying user HTML · vitest + jsdom for tests. No TypeScript, no state library.

## 4. Architecture in one page

- **Dual API layer.** `src/api/index.js` exports `api` = `mockApi` or `realApi` depending on `VITE_USE_MOCK` (default mock). Both expose the **same function names**; the pages never know which. Anything you add to one you must add to the other (a test checks the real one's paths).
- **mockApi** (`src/api/mockApi.js`): a fake backend in `localStorage` (key `monolith_mock_db_v2`) seeded from `src/api/seed.js`. `upgrade()` tops up older saved data with newer collections (add new collections there too). A fake delay of 200 ms is skipped when vitest sets `MODE=test`. Demo logins: `demo/demo1234`, `asha/asha1234`, `ravi/ravi1234`.
- **realApi** (`src/api/realApi.js`): `fetch` wrapper. Token auth header `Authorization: Token <key>`. Errors are `Error` objects with `.status`. A 401 while a session exists clears it and dispatches `monolith:unauthorized` (AuthContext listens). DRF pages `{count,next,previous,results}` become `{results, hasMore}` via `toPage`. Blogs and avatar go as multipart. Endpoint paths are placeholders the user adjusts to their `urls.py`.
- **Lists:** `useAsync(fn, deps)` for one-shot loads (returns `{data,error,status,loading,setData}`; `status` is the HTTP status of a failure). `usePaginatedList(fetchPage, deps)` for "Load more" lists (`fetchPage(page)` must return `{results, hasMore}`). Search uses `useAsync` plus `Pagination` (Previous / Next, `?page=` in the URL) instead.
- **Auth:** `AuthContext` (`user`, `isAuthenticated`, `login`, `register`, `logout`, `updateUser`); session in `localStorage` (`lib/session.js`). `ProtectedRoute` sends guests to `/login` with `state.from`.
- **Dialogs:** `Modal` (native `<dialog>`, needs `m-auto`; renders children only while open, so content remounts fresh each open). `PeopleDialog`, `ReportDialog` build on it.
- **Errors:** `ErrorBoundary` (in `Layout`, keyed by path, and in `main.jsx`); `NotFound` is reusable with `title`/`message` and is shown on 404s. `useDocumentTitle(title)` on every page.
- **Counts:** `formatCount` in `lib/format.js` (999 → `999`, 1234 → `1.2K`, 15900 → `15K`, 123456 → `120K`, 1234567 → `1.2M`, always rounded down).

## 5. File map

```
src/
  main.jsx, App.jsx           entry (ErrorBoundary > AuthProvider > App); routes inside <Layout />
  index.css                   Tailwind v4 setup, colour tokens, small component classes
  api/                        index.js, mockApi.js, realApi.js, seed.js
  context/AuthContext.jsx
  hooks/                      useAsync, usePaginatedList, useNotifications (poll 60s, optimistic read / read all / delete),
                              useDismiss (outside click + Escape), useDocumentTitle
  lib/                        format.js, search.js (search fields), reports.js (report reasons), image.js (resize), session.js
  pages/                      Home (Latest/Following/Recommended), Search, BlogDetail, PublicProfile,
                              Dashboard (tabs: posts, drafts, liked, bookmarks, following, followers), Write, Login, Register,
                              ForgotPassword, NotFound
  components/
    layout/                   Layout, Navbar, Footer, UserMenu (avatar dropdown), NotificationBell (floating panel)
    BlogCard, BlogList, PostRow (dashboard row), PostStats (read-only like/comment counts), LikeButton, BookmarkButton,
    CommentSection, FollowButton, UserRow, PeopleDialog, Pagination, Tabs, Modal, ReportDialog, ReportButton,
    NotificationItem, Avatar, AuthorLink, SearchBar, RichTextEditor, RichContent, Notice, PasswordInput,
    ProtectedRoute, ErrorBoundary
tests/                        format.test.js, mockApi.test.js, realApi.test.js, helpers.js (vitest)
dev-tools/                    offline checkers + a tiny vitest stand-in (optional; see its README)
README.md                     user-facing docs and API contract
BACKEND.md                    the Django checklist (endpoints, rules, rate limiting, security, moderation)
HANDOFF.md                    this file
```

## 6. Feature inventory (all implemented in the mock and wired to realApi)

Auth (login, register, logout, forgot password) · feed with Latest / Following / Recommended · search page (title/content/author, Previous/Next paging) · blog page (cover, rich body, follow, report, edit/delete for the author, comments, like, bookmark, comment-count jump link, "Who liked this" dialog) · write page (Tiptap, cover image, draft/publish) · dashboard (private details, avatar upload, six tabs) · public profiles (no email, followers/following dialogs, report, follow) · profile pictures everywhere a person appears (initials fallback) · navbar avatar menu · notifications panel (follow, comment, like, new_post; mark read, mark all read, delete; unread dot) · reports for blogs, comments, users · likes and bookmarks (bookmarks private) with counts on cards, blog page and the author's own dashboard rows · error boundary, 404 pages, expired-login handling, page titles.

## 7. Verification status: read this before claiming anything

- **The UI has never been built or run.** The workspace where this was written could not reach the npm registry (DNS failure, tried several times; do not try to bypass it). So `npm install`, `npm run dev`, `npm run build` and real `vitest` were **never executed**.
- What *was* verified, offline: syntax, undefined names, unresolved imports, unused imports and Lucide icon names (`dev-tools/check2.cjs`, 0 errors); code style (`dev-tools/check3.cjs`, 0 problems); the mock API, real API (with a fake `fetch`) and formatters through `tests/` run on a vitest stand-in (`dev-tools/run-tests.mts`, 55 tests passing). Earlier ad-hoc suites covered the same ground plus more.
- **Not verified:** anything that needs a real browser: rendering, layout, Tailwind v4 class behaviour (`line-clamp-2`, `m-auto` on `<dialog>`, `sr-only`), the `vitest` config in `vite.config.js`, `import.meta.env?.MODE` in the Vite build, Tiptap behaviour, the `<dialog>` modals, focus handling in the avatar menu, scrolling after paging. Expect a few small fixes on the first real run.
- If you *can* install packages in your session: run `npm install && npm run build && npm test` first and fix what shows up before adding features. If you cannot, use the dev-tools scripts and say so honestly.
- To check by hand in the browser: log in as `demo`. Post 1 is already liked and bookmarked. Dashboard → Liked shows posts 1 and 2. `/users/demo` → Followers lists asha and ravi.

## 8. Decisions already made (do not reopen without a reason)

- Count format: `<1000` plain, then two significant digits rounded down with K/M (B added beyond). Exact number in the hover title.
- Bookmarks are **private**: no "who bookmarked" list, no public count.
- People lists added: who liked a post; followers and following on public profiles. Own followers/following stay as dashboard tabs.
- Search: Previous / Next with `?page=`; no page numbers because the API gives only `next`. Other lists use "Load more". Dashboard posts/drafts/following/followers still load all at once.
- Recommended feed: the backend decides; the mock ranks `(likes + 2·comments + 1) / (age_days + 2)^1.5` and excludes the viewer's own posts.
- Like notifications are created by the **backend**; the frontend renders the `like` type, and the mock creates them (once per person per post, never for yourself).
- Drafts cannot be liked, bookmarked or commented on. Deleting a post removes its likes, bookmarks, comments and notifications. A post turned back into a draft disappears from liked/bookmarked lists.
- Notifications panel shows the latest 30 and polls every 60 seconds (no websockets yet).
- Mock-only extras (not backend concerns): fake delay, localStorage db.

## 9. History (what was built when)

v1 starter UI → v2 Tailwind black-and-white, six pages → v3 search page with field selector, public profiles, arrow-function style → v4 profile pictures, avatar menu, notifications panel, reports → v5 likes, bookmarks, counts, Liked/Bookmarks tabs, people dialogs, search paging → **v0.4.0 polish round** (this one): bigger counts (`PostStats` `text-sm`, 16 px icons; blog-page buttons regular size), Recommended tab, Mark all as read, `like` notification type, error boundary, 404 pages, 401 logout, page titles, vitest tests, `BACKEND.md`, this handoff.

## 10. What is left

**For the user (manual, in this order)**
1. Unzip, `npm install`, `npm run dev`, click through every page logged out and as `demo`, `asha`, `ravi`. Send Claude any visual problem or console error.
2. `npm test` and `npm run build`. Report anything that fails (the vitest setup was never run for real).
3. Work through `BACKEND.md` section A in Django, then set `VITE_USE_MOCK=false` and adjust paths in `src/api/realApi.js`. Section B before real users.
4. Build the separate admin panel for report moderation (`BACKEND.md` B4).
5. Decide: password-reset confirmation page (the screen opened from the emailed link is **not built**), editing user details (no UI), bio on profiles.

**For Claude (possible next tasks, when asked)**
- Fix whatever the first real run reveals.
- Component tests with `@testing-library/react` (LikeButton, BookmarkButton, PeopleDialog, NotificationBell, Home tabs) and Playwright end-to-end tests once Django is connected.
- Paginate the remaining dashboard lists; page numbers on search once the API returns `count`.
- Reset-password confirmation page; edit user details; profile bio.
- Grouped notifications; live updates instead of polling.
- Accessibility pass (keyboard, screen reader, focus order) and a colour theme later.
- Help the user build the Django side from `BACKEND.md` (explain simply).

## 11. First steps for a new chat

1. Read this file, `README.md`, `BACKEND.md`. Look at `HANDOFF.md` section 7 before saying anything works.
2. Ask what the user wants next only if it is not obvious from their message; otherwise start.
3. For anything non-trivial: milestones, one at a time, with "what changed / what remains / how to verify", and update sections 7 and 10 of this file when the state changes.
4. Run the checks (`npm test`, or the dev-tools) before declaring a milestone done. Send a new zip at each stop.
5. Keep the style rules in section 2: they are the user's explicit preferences.
