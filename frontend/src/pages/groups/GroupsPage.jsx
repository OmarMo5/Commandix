import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import GroupModal from './GroupModal';
import TaskDetailModal from '../tasks/TaskDetailModal';

export default function GroupsPage() {
  const [groups, setGroups]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [detailId, setDetailId]       = useState(null);
  const { user } = useAuth();

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/tasks', { params: { scope: 'groups', per_page: 100 } });
      setGroups(data.data);
    } catch { toast.error('Failed to load groups'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔒 Private Groups</h1>
          <p className="page-subtitle">
            {groups.length} group{groups.length !== 1 ? 's' : ''} — visible only to their members
          </p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>+ Create Group</button>
      </div>

      {loading ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 14 }}>No groups yet. Create one to work privately with specific people.</p>
        </div>
      ) : (
        <div className="row g-3">
          {groups.map(g => (
            <div key={g.id} className="col-md-6 col-lg-4">
              <GroupCard group={g} currentUserId={user?.id} onOpen={() => setDetailId(g.id)} />
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

function GroupCard({ group, currentUserId, onOpen }) {
  const isClosed = !!group.closed_at;
  const statusColor = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' }[group.status] || '#94a3b8';

  return (
    <div
      className="task-card"
      onClick={onOpen}
      style={{ cursor: 'pointer', opacity: isClosed ? 0.7 : 1 }}
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <span style={{ fontSize: 11, background: '#6366f120', color: '#6366f1', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
          🔒 Private
        </span>
        {isClosed && (
          <span style={{ fontSize: 11, background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
            Closed
          </span>
        )}
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
          {group.status?.replace('_', ' ')}
        </span>
      </div>

      {group.creator_id === currentUserId && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
          👑 You created this group
        </div>
      )}
    </div>
  );
}
