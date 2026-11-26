// Stores { token, user } in localStorage so a refresh keeps you logged in.
const KEY = 'monolith_session';

const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
};

const setSession = (session) => {
  localStorage.setItem(KEY, JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem(KEY);
};

// Fired (on window) when the server says the saved login is no longer valid (HTTP 401),
// so the app can drop the stale session and show the logged-out navbar.
const UNAUTHORIZED_EVENT = 'monolith:unauthorized';

export { getSession, setSession, clearSession, UNAUTHORIZED_EVENT };
