import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { UNAUTHORIZED_EVENT, clearSession, getSession, setSession } from '../lib/session';

const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [session, setSessionState] = useState(() => getSession());

  // The server rejected our token (it expired): realApi has cleared it, so log out here too.
  useEffect(() => {
    const handleUnauthorized = () => setSessionState(null);
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    const next = await api.login(credentials);
    setSession(next);
    setSessionState(next);
    return next.user;
  }, []);

  const register = useCallback(async (details) => {
    const next = await api.register(details);
    setSession(next);
    setSessionState(next);
    return next.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout(); // needs the token, so call before clearing
    } catch {
      /* log out locally even if the server call fails */
    }
    clearSession();
    setSessionState(null);
  }, []);

  // Merges new details (for example a new avatar) into the logged-in user, so the navbar
  // and everything else that shows "me" updates straight away.
  const updateUser = useCallback((changes) => {
    const current = getSession();
    if (!current) return;
    const next = { ...current, user: { ...current.user, ...changes } };
    setSession(next);
    setSessionState(next);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      login,
      register,
      logout,
      updateUser,
    }),
    [session, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export { AuthProvider, useAuth };
