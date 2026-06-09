import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const typeIcons = {
  task_assigned:     '📋',
  task_completed:    '✅',
  task_mentioned:    '💬',
  task_comment:      '💬',
  task_question:     '❓',
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

  const fetch = async () => {
    try {
      const { data: res } = await api.get('/notifications');
      setData(res);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetch();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      toast.success('All marked as read');
      fetch();
    } catch {}
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{data.unread_count} unread</p>
        </div>
        {data.unread_count > 0 && (
          <button className="btn btn-outline-secondary btn-sm" onClick={markAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      <div className="card p-0" style={{ overflow: 'hidden' }}>
        {loading && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        )}
        {!loading && data.notifications.data.length === 0 && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
            <p>No notifications yet</p>
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
                  Task: {notif.data.task_title}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {new Date(notif.created_at).toLocaleString()}
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
    case 'task_assigned':     return `${d.assigned_by} assigned you to "${d.task_title}"`;
    case 'task_completed':    return `${d.completed_by} completed a task`;
    case 'task_mentioned':    return `${d.mentioned_by} mentioned you in "${d.task_title}"`;
    case 'task_comment':      return `${d.from} commented on "${d.task_title}": "${d.preview}"`;
    case 'task_question':     return `${d.from} asked a question on "${d.task_title}": "${d.preview}"`;
    case 'workflow_turn':     return `It's your turn! ${d.from} passed "${d.task_title}" to you — Step ${d.step}`;
    case 'workflow_progress': return `${d.completed_by} completed Step ${d.step} → now with ${d.next_assignee}`;
    case 'workflow_finished': return `🎉 ${d.completed_by} finished the last step — task is done!`;
    case 'manager_message':   return `Message from ${d.from_name} (${d.from_dept}): "${d.message}"`;
    default:                  return 'New notification';
  }
}
