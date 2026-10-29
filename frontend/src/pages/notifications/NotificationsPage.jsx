import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, AtSign, MessageSquare, HelpCircle, Clock, AlarmClock,
  LogOut, Zap, RefreshCw, CheckCheck, Mail, Bell, Check, Undo2, BellOff, Inbox, SmilePlus,
} from 'lucide-react';
import api from '../../api/axios';
import { useLive } from '../../context/LiveContext';
import { pathFor, tabFor } from '../../utils/links';
import { t, formatDate, formatDateTime } from '../../i18n';

const typeIcons = {
  task_assigned:     ClipboardList,
  task_completed:    CheckCircle2,
  task_mentioned:    AtSign,
  task_comment:      MessageSquare,
  task_question:     HelpCircle,
  comment_mention:   AtSign,
  task_due_soon:     Clock,
  task_overdue:      AlarmClock,
  group_member_left: LogOut,
  workflow_turn:     Zap,
  workflow_progress: RefreshCw,
  workflow_finished: CheckCheck,
  manager_message:   Mail,
  comment_reaction:  SmilePlus,
};

const TABS = ['primary', 'other', 'later', 'cleared'];
const GROUPS = ['all', 'assigned', 'mentions', 'comments', 'reminders'];
const SNOOZE = [
  { key: 'later_today', label: () => t('Later today') },
  { key: 'tomorrow',    label: () => t('Tomorrow') },
  { key: 'next_week',   label: () => t('Next week') },
  { key: 'someday',     label: () => t('Until I move it') },
];

const tabLabel = (tab) => ({ primary: t('Primary'), other: t('Other'), later: t('Later'), cleared: t('Cleared') }[tab]);
const groupLabel = (g) => ({ all: t('All'), assigned: t('Assigned'), mentions: t('Mentions'), comments: t('Comments'), reminders: t('Reminders') }[g]);

/** Date bucket for the section headings: Today · Yesterday · Last 7 days · Earlier this month · "March 2026". */
function bucketOf(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return { key: 'today', label: t('Today') };
  if (days === 1) return { key: 'yesterday', label: t('Yesterday') };
  if (days < 7) return { key: 'week', label: t('Last 7 days') };
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return { key: 'month', label: t('Earlier this month') };
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: formatDate(d, { month: 'long', year: 'numeric' }) };
}

export default function NotificationsPage() {
  const [tab, setTab] = useState('primary');
  const [group, setGroup] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [counts, setCounts] = useState({ primary_unread: 0, other_unread: 0, later: 0 });
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuFor, setMenuFor] = useState(null);
  const navigate = useNavigate();
  const { latest_id: latestId, refresh } = useLive();
  const request = useRef(0);   // ignores a slow response that arrives after the user already switched tab

  const query = useCallback((pageNo) => ({ params: { tab, page: pageNo, ...(group !== 'all' ? { group } : {}) } }), [tab, group]);

  const load = useCallback(async (pageNo = 1) => {
    const ticket = ++request.current;
    try {
      const { data } = await api.get('/notifications', query(pageNo));
      if (ticket !== request.current) return;
      setItems((prev) => (pageNo === 1 ? data.notifications.data : [...prev, ...data.notifications.data]));
      setPage({ current: data.notifications.current_page, last: data.notifications.last_page });
      setCounts(data.counts);
      setUnread(data.unread_count);
    } catch {
      toast.error(t('Failed to load notifications'));
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [query]);

  // Switching tab/filter, or the live poll saying something new arrived, reloads from the top.
  useEffect(() => { load(1); }, [load, latestId]);

  /** Just the numbers (tab badges, bell) — used after an action so the list itself isn't reshuffled under the pointer. */
  const refreshCounts = async () => {
    try {
      const { data } = await api.get('/notifications', query(1));
      setCounts(data.counts);
      setUnread(data.unread_count);
    } catch { /* the next poll will fix it */ }
    refresh();
  };

  const leave = (id) => setItems((prev) => prev.filter((n) => n.id !== id));

  const act = async (n, verb, body, message) => {
    try {
      await api.put(`/notifications/${n.id}/${verb}`, body);
      leave(n.id);
      setMenuFor(null);
      if (message) toast.success(message);
      refreshCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Something went wrong'));
    }
  };

  const open = async (n) => {
    if (!n.read_at) {
      api.put(`/notifications/${n.id}/read`).then(() => {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
        refreshCounts();
      }).catch(() => {});
    }
    if (n.target) navigate(pathFor(n.target, tabFor(n.type)));
    else if (n.data?.task_id) toast.info(t('This task is no longer available'));
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      toast.success(t('All marked as read'));
      load(1);
      refresh();
    } catch { /* keep the list as it is */ }
  };

  const clearAll = async () => {
    try {
      await api.post('/notifications/clear-all', { tab });
      toast.success(t('Notifications cleared'));
      load(1);
      refresh();
    } catch { /* keep the list as it is */ }
  };

  const inInbox = tab === 'primary' || tab === 'other';
  const badge = (name) => (name === 'primary' ? counts.primary_unread : name === 'other' ? counts.other_unread : name === 'later' ? counts.later : 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Notifications')}</h1>
          <p className="page-subtitle">{unread} {t('unread')}</p>
        </div>
        {inInbox && (
          <div className="d-flex gap-2">
            {unread > 0 && (
              <button className="btn btn-outline-secondary btn-sm" onClick={markAllRead}>{t('Mark all as read')}</button>
            )}
            {items.length > 0 && (
              <button className="btn btn-outline-secondary btn-sm" onClick={clearAll}>
                <Check size={14} /> {t('Clear all')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="inbox-tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            className={`inbox-tab ${tab === name ? 'active' : ''}`}
            onClick={() => { setTab(name); setItems([]); setLoading(true); setMenuFor(null); }}
          >
            {tabLabel(name)}
            {badge(name) > 0 && <span className="inbox-tab-count">{badge(name) > 99 ? '99+' : badge(name)}</span>}
          </button>
        ))}
      </div>

      <div className="inbox-chips">
        {GROUPS.map((g) => (
          <button key={g} className={`inbox-chip ${group === g ? 'active' : ''}`} onClick={() => { setGroup(g); setItems([]); setLoading(true); setMenuFor(null); }}>
            {groupLabel(g)}
          </button>
        ))}
      </div>

      <div className="inbox-list">
        {loading && items.length === 0 && <div className="inbox-empty">{t('Loading...')}</div>}

        {!loading && items.length === 0 && (
          <div className="inbox-empty">
            {tab === 'later' ? <BellOff size={34} strokeWidth={1.4} /> : tab === 'cleared' ? <Inbox size={34} strokeWidth={1.4} /> : <Bell size={34} strokeWidth={1.4} />}
            <div className="inbox-empty-title">
              {tab === 'later' ? t('Nothing is parked for later') : tab === 'cleared' ? t('Nothing cleared yet') : t("You're all caught up")}
            </div>
            <div className="inbox-empty-sub">
              {tab === 'later' ? t('Snooze a notification and it will wait here until you need it.')
                : tab === 'cleared' ? t('Notifications you clear are kept here.')
                : t('New notifications will show up here.')}
            </div>
          </div>
        )}

        {items.map((n, i) => {
          const bucket = bucketOf(n.created_at);
          const heading = i === 0 || bucketOf(items[i - 1].created_at).key !== bucket.key ? bucket.label : null;
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id}>
              {heading && <div className="inbox-group-title">{heading}</div>}
              <div
                className={`inbox-row ${n.read_at ? '' : 'unread'}`}
                role="button"
                tabIndex={0}
                onClick={() => open(n)}
                onKeyDown={(e) => { if (e.key === 'Enter') open(n); }}
              >
                <span className={`inbox-icon ${n.type === 'task_overdue' ? 'danger' : ''}`}><Icon size={17} strokeWidth={1.9} /></span>
                <div className="inbox-main">
                  <div className="inbox-text">{getNotifText(n)}</div>
                  {n.data?.task_title && <div className="inbox-task">{n.data.task_title}</div>}
                  <div className="inbox-time">
                    {formatDateTime(n.created_at)}
                    {tab === 'later' && n.snoozed_until && (
                      <span className="inbox-returns"> · {t('Returns {date}', { date: formatDateTime(n.snoozed_until) })}</span>
                    )}
                  </div>
                </div>
                {!n.read_at && <span className="inbox-dot" aria-label={t('unread')} />}

                <div className="inbox-actions" onClick={(e) => e.stopPropagation()}>
                  {inInbox && (
                    <div className="inbox-snooze">
                      <button className="inbox-act" title={t('Snooze')} onClick={() => setMenuFor(menuFor === n.id ? null : n.id)}>
                        <Clock size={15} />
                      </button>
                      {menuFor === n.id && (
                        <div className="dropdown-menu show inbox-menu">
                          {SNOOZE.map((o) => (
                            <button key={o.key} className="dropdown-item" onClick={() => act(n, 'snooze', { until: o.key }, t('Snoozed'))}>
                              {o.label()}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {tab === 'later' && (
                    <button className="inbox-act" title={t('Move to inbox')} onClick={() => act(n, 'restore', undefined, t('Moved back to the inbox'))}>
                      <Undo2 size={15} />
                    </button>
                  )}
                  {tab === 'cleared' && (
                    <button className="inbox-act" title={t('Restore')} onClick={() => act(n, 'restore', undefined, t('Moved back to the inbox'))}>
                      <Undo2 size={15} />
                    </button>
                  )}
                  {tab !== 'cleared' && (
                    <button className="inbox-act inbox-clear" title={t('Clear')} onClick={() => act(n, 'clear')}>
                      <Check size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {page.current < page.last && (
          <div className="inbox-more">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => load(page.current + 1)}>{t('Load more')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function getNotifText(notif) {
  const d = notif.data || {};
  switch (notif.type) {
    case 'task_assigned':     return t('{name} assigned you to "{task}"', { name: d.assigned_by, task: d.task_title });
    case 'task_completed':    return t('{name} completed a task', { name: d.completed_by });
    case 'task_mentioned':    return t('{name} mentioned you in "{task}"', { name: d.mentioned_by, task: d.task_title });
    case 'task_comment':      return t('{name} commented on "{task}": "{text}"', { name: d.from, task: d.task_title, text: d.preview });
    case 'task_question':     return t('{name} asked a question on "{task}": "{text}"', { name: d.from, task: d.task_title, text: d.preview });
    case 'task_due_soon':     return t(d.when === 'today' ? '"{task}" is due today' : '"{task}" is due tomorrow', { task: d.task_title });
    case 'task_overdue':      return t(d.days_overdue === 1 ? '"{task}" is overdue by 1 day' : '"{task}" is overdue by {n} days', { task: d.task_title, n: d.days_overdue });
    case 'group_member_left': return t('{name} left the group "{task}"', { name: d.user_name, task: d.task_title });
    case 'comment_mention':   return t('{name} tagged you in "{task}": "{text}"', { name: d.from, task: d.task_title, text: d.preview });
    case 'workflow_turn':     return t("It's your turn! {name} passed \"{task}\" to you — Step {step}", { name: d.from, task: d.task_title, step: d.step });
    case 'workflow_progress': return t('{name} completed Step {step} → now with {next}', { name: d.completed_by, step: d.step, next: d.next_assignee });
    case 'workflow_finished': return t('🎉 {name} finished the last step — task is done!', { name: d.completed_by });
    case 'comment_reaction':  return t('{name} reacted {emoji} to your comment on "{task}": "{text}"', { name: d.from, emoji: d.emoji, task: d.task_title, text: d.preview });
    case 'manager_message':   return t('Message from {name} ({dept}): "{text}"', { name: d.from_name, dept: d.from_dept, text: d.message });
    default:                  return t('New notification');
  }
}
