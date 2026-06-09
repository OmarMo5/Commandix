import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import TaskModal from './TaskModal';
import TaskDetailModal from './TaskDetailModal';

const COLUMNS = [
  { key: 'pending',     label: 'Pending',     icon: '⏳', color: '#f59e0b' },
  { key: 'in_progress', label: 'In Progress', icon: '🔄', color: '#3b82f6' },
  { key: 'completed',   label: 'Completed',   icon: '✅', color: '#10b981' },
];

export default function TasksPage() {
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editTask, setEditTask]       = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [search, setSearch]           = useState('');
  const [dragOverCol, setDragOverCol] = useState(null);   // column key being dragged over
  const dragTaskId = useRef(null);                         // id of task being dragged
  const { isAdmin, isManager } = useAuth();

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/tasks', { params: { search, per_page: 100 } });
      setTasks(data.data);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [search]);

  const updateStatus = async (taskId, status) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    try {
      await api.put(`/tasks/${taskId}/status`, { status });
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
      fetchTasks(); // revert
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch { toast.error('Failed to delete task'); }
  };

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const handleDragStart = (taskId) => {
    dragTaskId.current = taskId;
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = dragTaskId.current;
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== colKey) {
      updateStatus(taskId, colKey);
    }
    dragTaskId.current = null;
  };

  const handleDragEnd = () => {
    setDragOverCol(null);
    dragTaskId.current = null;
  };

  const tasksByStatus = (status) => tasks.filter(t => t.status === status);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">{tasks.length} total tasks</p>
        </div>
        {(isAdmin() || isManager()) && (
          <button className="btn-accent" onClick={() => { setEditTask(null); setShowModal(true); }}>
            + New Task
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>Loading tasks...</div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map(col => (
            <div
              key={col.key}
              className="kanban-col"
              style={{
                outline: dragOverCol === col.key ? `2px dashed ${col.color}` : 'none',
                transition: 'outline 0.15s',
              }}
              onDragOver={e => handleDragOver(e, col.key)}
              onDrop={e => handleDrop(e, col.key)}
            >
              <div className="kanban-col-header">
                <span>{col.icon} {col.label}</span>
                <span style={{
                  background: col.color + '20', color: col.color,
                  borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700,
                }}>
                  {tasksByStatus(col.key).length}
                </span>
              </div>

              <div className="kanban-col-body">
                {dragOverCol === col.key && tasksByStatus(col.key).length === 0 && (
                  <div style={{
                    border: `2px dashed ${col.color}`, borderRadius: 10,
                    padding: '20px', textAlign: 'center',
                    fontSize: 13, color: col.color, opacity: 0.7,
                  }}>
                    Drop here
                  </div>
                )}

                {tasksByStatus(col.key).length === 0 && dragOverCol !== col.key && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                    No tasks
                  </div>
                )}

                {tasksByStatus(col.key).map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => setDetailTaskId(task.id)}
                    onEdit={() => { setEditTask(task); setShowModal(true); }}
                    onDelete={() => deleteTask(task.id)}
                    onStatusChange={updateStatus}
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TaskModal task={editTask} onClose={() => setShowModal(false)} onSaved={fetchTasks} />
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
          onStatusChanged={fetchTasks}
        />
      )}
    </div>
  );
}

/* ── Task Card ─────────────────────────────────────────────────────────────── */

function TaskCard({ task, onOpen, onEdit, onDelete, onStatusChange, onDragStart, onDragEnd }) {
  const { isAdmin, isManager, user } = useAuth();
  const canEdit    = isAdmin() || isManager() || task.creator_id === user?.id;
  const canMove    = canEdit || task.assignees?.some(a => a.id === user?.id);
  const otherStats = ['pending', 'in_progress', 'completed'].filter(s => s !== task.status);

  return (
    <div
      className="task-card"
      draggable={canMove}
      onDragStart={e => { e.stopPropagation(); onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{ cursor: canMove ? 'grab' : 'pointer' }}
      title={canMove ? 'Drag to move, or click to open' : 'Click to open'}
    >
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="d-flex align-items-center gap-1">
          <span className={`badge badge-${task.priority}`} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>
            {task.priority}
          </span>
          {task.workflow_enabled && (
            <span style={{ fontSize: 10, background: '#6366f120', color: '#6366f1', padding: '2px 6px', borderRadius: 20 }}>🔄</span>
          )}
        </div>

        {canEdit && (
          <div className="dropdown" onClick={e => e.stopPropagation()}>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0 4px' }}
              data-bs-toggle="dropdown"
            >
              ⋮
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button className="dropdown-item" style={{ fontSize: 13 }} onClick={onOpen}>
                  🔍 View Details
                </button>
              </li>
              <li><hr className="dropdown-divider" /></li>
              {otherStats.map(s => (
                <li key={s}>
                  <button className="dropdown-item" style={{ fontSize: 13 }} onClick={() => onStatusChange(task.id, s)}>
                    Move → {s.replace('_', ' ')}
                  </button>
                </li>
              ))}
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item" style={{ fontSize: 13 }} onClick={onEdit}>✏️ Edit</button></li>
              <li><button className="dropdown-item text-danger" style={{ fontSize: 13 }} onClick={onDelete}>🗑️ Delete</button></li>
            </ul>
          </div>
        )}
      </div>

      <h6 style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{task.title}</h6>

      {task.description && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
          {task.description.length > 80 ? task.description.slice(0, 80) + '…' : task.description}
        </p>
      )}

      <div className="d-flex align-items-center justify-content-between mt-2">
        <div className="d-flex gap-1">
          {task.assignees?.slice(0, 3).map(u => (
            <div key={u.id} className="avatar" style={{ width: 24, height: 24, fontSize: 10 }} title={u.name}>
              {u.avatar
                ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                : u.name?.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {task.assignees?.length > 3 && (
            <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
        {task.due_date && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            📅 {new Date(task.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      {task.attachments?.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
          📎 {task.attachments.length} attachment{task.attachments.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
