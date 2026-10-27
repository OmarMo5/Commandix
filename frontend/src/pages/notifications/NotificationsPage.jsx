import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useLive } from '../../context/LiveContext';
import { t, formatDate, formatDateTime } from '../../i18n';

const typeIcons = {
  task_assigned:     '📋',
  task_completed:    '✅',
  task_mentioned:    '💬',
  task_comment:      '💬',
  task_question:     '❓',
  comment_mention:   '🏷️',
  task_due_soon:     '⏰',
  task_overdue:      '🚨',
  group_member_left: '🚪',
  workflow_turn:     '🔵',
  workflow_progress: '🔄',
  workflow_finished: '🎉',
  manager_message:   '✉️',
  default:           '🔔',
};

export default function NotificationsPage() {
  const [data, setData] = useState({ notifications: { data: [] }, unread_count: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { latest_id } = useLive();

  const fetch = async () => {
    try {
      const { data: res } = await api.get('/notifications');
      setData(res);
    } catch { toast.error(t('Failed to load notifications')); }
    finally { setLoading(false); }
  };

  // The live poll bumps latest_id when something new arrives — reload the list then.
  useEffect(() => { fetch(); }, [latest_id]);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetch();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      toast.success(t('All marked as read'));
      fetch();
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Notifications')}</h1>
          <p className="page-subtitle">{data.unread_count} {t('unread')}</p>
        </div>
        {data.unread_count > 0 && (
          <button className="btn btn-outline-secondary btn-sm" onClick={markAllRead}>
            {t('Mark all as read')}
          </button>
        )}
      </div>

      <div className="card p-0" style={{ overflow: 'hidden' }}>
        {loading && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading...')}</div>
        )}
        {!loading && data.notifications.data.length === 0 && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <p>{t('No notifications yet')}</p>
          </div>
        )}
        {data.notifications.data.map(notif => (
          <div
            key={notif.id}
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              background: notif.read_at ? 'transparent' : 'var(--accent)08',
              cursor: 'pointer',
            }}
            onClick={() => {
              if (!notif.read_at) markRead(notif.id);
              if (notif.data?.task_id) navigate('/tasks');
            }}
          >
            <div style={{ fontSize: 28 }}>
              {typeIcons[notif.type] || typeIcons.default}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: notif.read_at ? 400 : 600, fontSize: 14 }}>
                {getNotifText(notif)}
              </div>
              {notif.data?.task_title && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
                  {t('Task:')} {notif.data.task_title}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {formatDateTime(notif.created_at)}
              </div>
            </div>
            {!notif.read_at && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
            )}
          </div>
        ))}
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
    case 'manager_message':   return t('Message from {name} ({dept}): "{text}"', { name: d.from_name, dept: d.from_dept, text: d.message });
    default:                  return t('New notification');
  }
}
