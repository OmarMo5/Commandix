import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLive } from '../../context/LiveContext';
import GroupModal from './GroupModal';
import TaskDetailModal from '../tasks/TaskDetailModal';
import { t } from '../../i18n';

export default function GroupsPage() {
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [detailId, setDetailId]       = useState(null);
  const [tab, setTab]                 = useState('active');   // 'active' | 'archived'
  const { user } = useAuth();
  const { groups_unread, latest_id } = useLive();

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/tasks', { params: { scope: 'groups', per_page: 100, archived: tab === 'archived' ? 1 : 0 } });
      setGroups(data.data);
    } catch { toast.error(t('Failed to load groups')); }
    finally { setLoading(false); }
  };

  // Re-fetch when the live poll sees a new notification (e.g. someone just added me to a group).
  useEffect(() => { fetchGroups(); }, [latest_id, tab]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('🔒 Private Groups')}</h1>
          <p className="page-subtitle">
            {t(tab === 'archived' ? (groups.length === 1 ? '{n} archived group — visible only to their members' : '{n} archived groups — visible only to their members') : (groups.length === 1 ? '{n} group — visible only to their members' : '{n} groups — visible only to their members'), { n: groups.length })}
          </p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>{t('+ Create Group')}</button>
      </div>

      <div className="d-flex gap-2 mb-4">
        {[['active', t('Active')], ['archived', t('📦 Archived')]].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setLoading(true); setTab(key); }}
            className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-outline-secondary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading groups...')}</div>
      ) : groups.length === 0 ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 14 }}>
            {tab === 'archived'
              ? t('No archived groups. Archive a finished group to tuck it away here.')
              : t('No groups yet. Create one to work privately with specific people.')}
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {groups.map(g => (
            <div key={g.id} className="col-md-6 col-lg-4">
              <GroupCard group={g} currentUserId={user?.id} unread={groups_unread[g.id] || 0} onOpen={() => setDetailId(g.id)} />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GroupModal onClose={() => setShowModal(false)} onSaved={fetchGroups} />
      )}

      {detailId && (
        <TaskDetailModal
          taskId={detailId}
          onClose={() => setDetailId(null)}
          onStatusChanged={fetchGroups}
        />
      )}
    </div>
  );
}

function GroupCard({ group, currentUserId, unread, onOpen }) {
  const isClosed = !!group.closed_at;
  const statusColor = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' }[group.status] || '#94a3b8';

  return (
    <div
      className="task-card"
      onClick={onOpen}
      style={{ cursor: 'pointer', opacity: isClosed || group.archived_at ? 0.7 : 1 }}
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span style={{ fontSize: 11, background: '#6366f120', color: '#6366f1', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
          {t('🔒 Private')}
        </span>
        {isClosed && (
          <span style={{ fontSize: 11, background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            {t('Closed')}
          </span>
        )}
        {group.archived_at && (
          <span style={{ fontSize: 11, background: '#64748b20', color: '#64748b', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            {t('Archived')}
          </span>
        )}
        {unread > 0 && <span className="unread-pill" title={t("Unread messages")}>{unread > 99 ? '99+' : unread} {t('new')}</span>}
      </div>

      <h6 style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{group.title}</h6>

      {group.description && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
          {group.description.length > 80 ? group.description.slice(0, 80) + '…' : group.description}
        </p>
      )}

      <div className="d-flex align-items-center justify-content-between mt-2">
        <div className="d-flex gap-1">
          {group.assignees?.slice(0, 4).map(u => (
            <div key={u.id} className="avatar" style={{ width: 24, height: 24, fontSize: 10 }} title={u.name}>
              {u.avatar
                ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                : u.name?.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {group.assignees?.length > 4 && (
            <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              +{group.assignees.length - 4}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: statusColor, fontWeight: 600 }}>
          {t(group.status?.replace('_', ' '))}
        </span>
      </div>

      {group.creator_id === currentUserId && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
          {t('👑 You created this group')}
        </div>
      )}
    </div>
  );
}
