// Demo data for the mock API. Safe to edit or delete once your backend is connected.

// A grey SVG with a few circles, standing in for uploaded cover images.
const cover = (n) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">` +
      `<rect width="1200" height="600" fill="#e5e5e5"/>` +
      `<g fill="none" stroke="#000" stroke-width="3">` +
      Array.from(
        { length: 5 },
        (_, i) => `<circle cx="${180 + i * 210}" cy="300" r="${40 + ((i * 37 + n * 53) % 110)}"/>`
      ).join('') +
      `</g></svg>`
  );

// A grey SVG with a few rings, standing in for an uploaded profile picture.
const avatarArt = (n) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
      `<rect width="128" height="128" fill="#e5e5e5"/>` +
      `<g fill="none" stroke="#000" stroke-width="3">` +
      Array.from({ length: 4 }, (_, i) => `<circle cx="64" cy="64" r="${10 + i * (8 + n * 3)}"/>`).join('') +
      `</g></svg>`
  );

const seedUsers = [
  {
    id: 1,
    username: 'demo',
    email: 'demo@example.com',
    password: 'demo1234',
    first_name: 'Demo',
    last_name: 'User',
    date_joined: '2026-09-01T10:00:00.000Z',
    avatar: null,
  },
  {
    id: 2,
    username: 'asha',
    email: 'asha@example.com',
    password: 'asha1234',
    first_name: 'Asha',
    last_name: 'Menon',
    date_joined: '2026-08-14T08:30:00.000Z',
    avatar: avatarArt(1),
  },
  {
    id: 3,
    username: 'ravi',
    email: 'ravi@example.com',
    password: 'ravi1234',
    first_name: 'Ravi',
    last_name: 'Iyer',
    date_joined: '2026-08-20T12:15:00.000Z',
    avatar: null,
  },
];

// Blog bodies are HTML, exactly what the Tiptap editor produces.
const seedBlogs = [
  {
    id: 1,
    title: 'Why I finally started writing in public',
    body:
      '<p>For years I kept notes in private folders that nobody, including future me, ever opened. Writing in public changed that. The moment someone else might read a paragraph, I started asking whether it was clear, whether it was true, and whether it was worth their time.</p>' +
      '<h2>Rough is fine</h2>' +
      '<p>The first few posts were rough. That turned out to be fine. A rough post that exists teaches you more than a perfect one that never ships.</p>' +
      '<p>If you have been putting this off, start small: <strong>one idea, one page, one honest ending.</strong></p>',
    cover_image: cover(1),
    status: 'published',
    author_id: 2,
    created_at: '2026-10-12T09:30:00.000Z',
    updated_at: '2026-10-12T09:30:00.000Z',
    published_at: '2026-10-12T09:30:00.000Z',
  },
  {
    id: 2,
    title: 'A gentle introduction to REST APIs',
    body:
      '<p>A REST API is just a polite agreement about URLs and verbs. The nice part is predictability: once you know how <code>/blogs/</code> and <code>/blogs/1/</code> behave, you can guess how <code>/comments/</code> will behave without reading any documentation.</p>' +
      '<h2>The four verbs you need first</h2>' +
      '<ul><li><strong>GET</strong> reads something</li><li><strong>POST</strong> creates something</li><li><strong>PUT / PATCH</strong> changes something</li><li><strong>DELETE</strong> removes something</li></ul>' +
      '<p>Status codes are the other half of the conversation: 200 means fine, 201 means created, 400 means you sent something wrong, and 401 means the server does not know who you are.</p>',
    cover_image: cover(2),
    status: 'published',
    author_id: 3,
    created_at: '2026-10-08T14:10:00.000Z',
    updated_at: '2026-10-09T08:00:00.000Z',
    published_at: '2026-10-08T14:10:00.000Z',
  },
  {
    id: 3,
    title: 'Small habits that make code reviews kinder',
    body:
      '<p>Review the code, not the person. Ask questions before making statements: "What happens if this list is empty?" lands very differently from "You forgot the empty case."</p>' +
      '<blockquote><p>Reviewers who only ever list problems train authors to dread the process.</p></blockquote>' +
      '<p>Point out what is good, too, and keep pull requests small. Nobody does their best review work on a thousand-line diff.</p>',
    cover_image: null,
    status: 'published',
    author_id: 2,
    created_at: '2026-10-03T11:45:00.000Z',
    updated_at: '2026-10-03T11:45:00.000Z',
    published_at: '2026-10-03T11:45:00.000Z',
  },
  {
    id: 4,
    title: 'Notes from a week without notifications',
    body:
      '<p>I turned off every non-essential notification for seven days. The first two days felt strange: I kept reaching for my phone to check nothing in particular.</p>' +
      '<p>By day four I was finishing tasks in one sitting. By day seven I had read two chapters of a book I had been avoiding for months.</p>' +
      '<p>I turned a few notifications back on, but only the ones from actual humans.</p>',
    cover_image: null,
    status: 'published',
    author_id: 3,
    created_at: '2026-09-27T17:20:00.000Z',
    updated_at: '2026-09-27T17:20:00.000Z',
    published_at: '2026-09-27T17:20:00.000Z',
  },
  {
    id: 5,
    title: 'Hello, Monolith',
    body:
      '<p>This is my first post here. I plan to write about building things with Django and React, and about what I get wrong along the way.</p>',
    cover_image: null,
    status: 'published',
    author_id: 1,
    created_at: '2026-10-15T07:00:00.000Z',
    updated_at: '2026-10-15T07:00:00.000Z',
    published_at: '2026-10-15T07:00:00.000Z',
  },
  {
    id: 6,
    title: 'Ideas for my first long-form post',
    body:
      '<ul><li>Serializers explained for beginners</li><li>Why I split my API into /api/v1</li><li>Rich text editors: what I learned</li></ul>',
    cover_image: null,
    status: 'draft',
    author_id: 1,
    created_at: '2026-10-17T18:30:00.000Z',
    updated_at: '2026-10-18T09:10:00.000Z',
    published_at: null,
  },
];

const seedComments = [
  {
    id: 1,
    blog: 1,
    author_id: 3,
    body: 'This is exactly the push I needed. Starting my first post this weekend.',
    created_at: '2026-10-13T06:15:00.000Z',
  },
  {
    id: 2,
    blog: 2,
    author_id: 2,
    body: 'Great explainer. The status code summary at the end is a handy cheat sheet.',
    created_at: '2026-10-09T10:05:00.000Z',
  },
  {
    id: 3,
    blog: 2,
    author_id: 1,
    body: 'Would love a follow-up on authentication.',
    created_at: '2026-10-10T12:40:00.000Z',
  },
  {
    id: 4,
    blog: 5,
    author_id: 3,
    body: 'Welcome! Looking forward to the serializers post.',
    created_at: '2026-10-19T20:00:00.000Z',
  },
];

// { follower, following }: "follower" follows "following".
const seedFollows = [
  { follower: 1, following: 2 },
  { follower: 2, following: 1 },
  { follower: 3, following: 1 },
  { follower: 3, following: 2 },
];

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// { user_id, blog_id, created_at }: the user liked the (published) blog.
const seedLikes = [
  { user_id: 1, blog_id: 1, created_at: daysAgo(6) },
  { user_id: 3, blog_id: 1, created_at: daysAgo(5) },
  { user_id: 1, blog_id: 2, created_at: daysAgo(9) },
  { user_id: 2, blog_id: 2, created_at: daysAgo(8) },
  { user_id: 3, blog_id: 3, created_at: daysAgo(14) },
  { user_id: 2, blog_id: 5, created_at: daysAgo(3) },
  { user_id: 3, blog_id: 5, created_at: daysAgo(2) },
];

// { user_id, blog_id, created_at }: the user saved the blog for later. Bookmarks are private.
const seedBookmarks = [
  { user_id: 1, blog_id: 1, created_at: daysAgo(6) },
  { user_id: 1, blog_id: 3, created_at: daysAgo(4) },
  { user_id: 3, blog_id: 5, created_at: daysAgo(2) },
];

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

// type: 'follow' | 'comment' | 'new_post'
// user_id is who receives it, actor_id is who caused it, blog_id is null for follows.
const seedNotifications = [
  { id: 1, user_id: 1, type: 'follow', actor_id: 2, blog_id: null, created_at: hoursAgo(2), is_read: false },
  { id: 2, user_id: 1, type: 'comment', actor_id: 3, blog_id: 5, created_at: hoursAgo(5), is_read: false },
  { id: 3, user_id: 1, type: 'new_post', actor_id: 2, blog_id: 3, created_at: hoursAgo(30), is_read: true },
  { id: 4, user_id: 1, type: 'follow', actor_id: 3, blog_id: null, created_at: hoursAgo(72), is_read: true },
];

export {
  seedUsers,
  seedBlogs,
  seedComments,
  seedFollows,
  seedNotifications,
  seedLikes,
  seedBookmarks,
};
