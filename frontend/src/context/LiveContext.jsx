import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { t } from '../i18n';

// Near-real-time updates without a socket server: one tiny summary request every
// few seconds (paused while the tab is hidden, refreshed the moment it's focused again).
// Everything that shows "something new" — bell, sidebar badge, group cards, open pages —
// reads from this single poll instead of running its own timer.

const EMPTY = { unread_count: 0, latest_id: 0, groups_unread: {}, tasks_unread: {}, dm_unread: {} };
const POLL_MS = 10_000;

const LiveContext = createContext({ ...EMPTY, groupsUnreadTotal: 0, dmUnreadTotal: 0, refresh: () => {} });

export function LiveProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(EMPTY);
  const previous = useRef(null);   // null until the first response, so page load never toasts

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/summary');

      const before = previous.current;
      if (before && data.latest_id > before.latest_id && data.unread_count > before.unread_count) {
        const n = data.unread_count - before.unread_count;
        toast.info(n === 1 ? t('You have a new notification') : t('You have {n} new notifications', { n }), {
          onClick: () => navigate('/notifications'),
        });
      }

      // A new direct message — unless you are already in the Messages page, where it simply appears.
      const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
      if (before && sum(data.dm_unread) > sum(before.dm_unread) && !window.location.pathname.startsWith('/messages')) {
        const risen = Object.keys(data.dm_unread || {}).filter((id) => (data.dm_unread[id] || 0) > ((before.dm_unread || {})[id] || 0));
        toast.info(t('You have a new message'), { onClick: () => navigate(risen.length === 1 ? `/messages/${risen[0]}` : '/messages') });
      }

      previous.current = data;
      setSummary(data);
    } catch {
      // Offline or signed out — the next tick simply tries again.
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      previous.current = null;
      return undefined;
    }

    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    refresh();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user?.id, refresh]);

  const value = useMemo(() => {
    const live = user ? summary : EMPTY;   // never show the previous account's numbers
    return {
      ...live,
      groupsUnreadTotal: Object.values(live.groups_unread || {}).reduce((a, b) => a + b, 0),
      dmUnreadTotal: Object.values(live.dm_unread || {}).reduce((a, b) => a + b, 0),
      refresh,
    };
  }, [user, summary, refresh]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
