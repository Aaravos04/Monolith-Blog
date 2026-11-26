import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const POLL_MS = 60 * 1000;

// Loads the logged-in user's notifications, re-checks every minute, and offers
// markRead(id), markAllRead() and remove(id). `hasUnread` drives the dot on the bell.
const useNotifications = () => {
  const [state, setState] = useState({ items: [], loading: true, error: '' });

  const refresh = useCallback(async () => {
    try {
      const items = await api.listNotifications();
      setState({ items, loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // If a change fails, reload the real list and then show why.
  const recover = async (err) => {
    await refresh();
    setState((s) => ({ ...s, error: err.message }));
  };

  // The screen updates first; the server call follows.
  const markRead = async (id) => {
    setState((s) => ({
      ...s,
      error: '',
      items: s.items.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    }));
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      await recover(err);
    }
  };

  // Marks everything read in one go (same optimistic approach as markRead).
  const markAllRead = async () => {
    setState((s) => ({ ...s, error: '', items: s.items.map((n) => ({ ...n, is_read: true })) }));
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      await recover(err);
    }
  };

  const remove = async (id) => {
    setState((s) => ({ ...s, error: '', items: s.items.filter((n) => n.id !== id) }));
    try {
      await api.deleteNotification(id);
    } catch (err) {
      await recover(err);
    }
  };

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    hasUnread: state.items.some((n) => !n.is_read),
    refresh,
    markRead,
    markAllRead,
    remove,
  };
};

export { useNotifications };
