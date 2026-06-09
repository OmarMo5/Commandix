import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState({});
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editDept, setEditDept]       = useState(null);
  const [showMsgModal, setShowMsgModal]   = useState(false);
  const [allUsers, setAllUsers]       = useState([]);
  const { isAdmin, isManager, user }  = useAuth();

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/departments');
      setDepartments(data);
      // auto-expand single dept (employee/manager view)
      if (data.length === 1) setExpanded({ [data[0].id]: true });
    } catch { toast.error('Failed to load departments'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchDepts();
    // admin/manager needs users for the create/edit form
    if (isAdmin()) {
      api.get('/users', { params: { per_page: 200 } }).then(r => setAllUsers(r.data.data || []));
    }
  }, []);

  const toggleExpand = (id) =>
    setExpanded(p => ({ ...p, [id]: !p[id] }));

  const deleteDept = async (id) => {
    if (!confirm('Delete this department? Users in it will become unassigned.')) return;
    try {
      await api.delete(`/departments/${id}`);
      toast.success('Department deleted');
      fetchDepts();
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return (
    <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
      Loading departments...
    </div>
  );

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="d-flex gap-2">
          {(isAdmin() || isManager()) && (
            <button
              className="btn btn-outline-secondary btn-sm"
              style={{ fontSize: 13 }}
              onClick={() => setShowMsgModal(true)}
            >
              ✉️ Message a Manager
            </button>
          )}
          {isAdmin() && (
            <button className="btn-accent" onClick={() => { setEditDept(null); setShowDeptModal(true); }}>
              + Add Department
            </button>
          )}
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🏢</div>
          <p style={{ fontSize: 15 }}>No departments yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {departments.map(dept => (
            <DeptCard
              key={dept.id}
              dept={dept}
              expanded={!!expanded[dept.id]}
              onToggle={() => toggleExpand(dept.id)}
              onEdit={() => { setEditDept(dept); setShowDeptModal(true); }}
              onDelete={() => deleteDept(dept.id)}
              isAdmin={isAdmin()}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dept modal */}
      {showDeptModal && (
        <DeptFormModal
          dept={editDept}
          users={allUsers}
          onClose={() => setShowDeptModal(false)}
          onSaved={fetchDepts}
        />
      )}

      {/* Manager message modal */}
      {showMsgModal && (
        <MessageManagerModal onClose={() => setShowMsgModal(false)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Department Card                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function DeptCard({ dept, expanded, onToggle, onEdit, onDelete, isAdmin, currentUserId }) {
  const manager    = dept.manager;
  // exclude the manager from team members list — they're already shown separately
  const members    = (dept.users || []).filter(m => m.id !== manager?.id);
  // "my dept" if user is a member OR is the manager
  const isMyDept   = members.some(m => m.id === currentUserId) || manager?.id === currentUserId;

  return (
    <div
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        borderLeft: isMyDept ? '3px solid var(--accent)' : '1px solid var(--border-color)',
      }}
    >
      {/* ── Header row ── */}
      <div
        style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
          background: isMyDept ? 'var(--accent)05' : 'transparent',
        }}
        onClick={onToggle}
      >
        {/* Icon */}
        <div style={{
          width: 46, height: 46, borderRadius: 12, flexShrink: 0,
          background: isMyDept ? 'var(--accent)' : 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          color: isMyDept ? '#fff' : 'var(--text-secondary)',
        }}>
          🏢
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{dept.name}</span>
            {isMyDept && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'var(--accent)20', color: 'var(--accent)',
              }}>
                Your Department
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
            {manager ? `👤 ${manager.name}` : '👤 No manager'} · {members.length} member{members.length !== 1 ? 's' : ''} · {dept.tasks_count ?? 0} tasks
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          {isAdmin && (
            <div className="dropdown">
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20, padding: '0 4px' }}
                data-bs-toggle="dropdown"
              >⋮</button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><button className="dropdown-item" onClick={onEdit}>✏️ Edit</button></li>
                <li><button className="dropdown-item text-danger" onClick={onDelete}>🗑️ Delete</button></li>
              </ul>
            </div>
          )}
          <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={{ padding: '20px 24px' }}>
          {dept.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, fontStyle: 'italic' }}>
              {dept.description}
            </p>
          )}

          <div className="row g-4">
            {/* Manager block */}
            <div className="col-md-4">
              <SectionLabel>Manager</SectionLabel>
              {manager ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                }}>
                  <UserAvatar user={manager} size={44} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {manager.name}
                      {manager.id === currentUserId && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)' }}>You</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{manager.email}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 4,
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: '#6366f120', color: '#6366f1',
                    }}>
                      Manager
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--bg-primary)', border: '1px dashed var(--border-color)',
                  fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center',
                }}>
                  No manager assigned
                </div>
              )}
            </div>

            {/* Members block */}
            <div className="col-md-8">
              <SectionLabel>Team Members ({members.length})</SectionLabel>
              {members.length === 0 ? (
                <div style={{
                  padding: '14px', borderRadius: 12,
                  background: 'var(--bg-primary)', border: '1px dashed var(--border-color)',
                  fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center',
                }}>
                  No members yet. Assign users to this department from the Users page.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 10,
                }}>
                  {members.map(m => (
                    <MemberCard key={m.id} member={m} isMe={m.id === currentUserId} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Member Card                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function MemberCard({ member, isMe }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 10,
      background: isMe ? 'var(--accent)08' : 'var(--bg-primary)',
      border: `1px solid ${isMe ? 'var(--accent)40' : 'var(--border-color)'}`,
    }}>
      <UserAvatar user={member} size={34} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {member.name}
          {isMe && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--accent)' }}>You</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {member.role?.display_name || 'Employee'}
        </div>
        {member.is_active === false && (
          <span style={{ fontSize: 10, color: '#ef4444' }}>Inactive</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dept Form Modal                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function DeptFormModal({ dept, users, onClose, onSaved }) {
  const [form, setForm]     = useState({
    name:        dept?.name        || '',
    description: dept?.description || '',
    manager_id:  dept?.manager?.id || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (dept) {
        await api.put(`/departments/${dept.id}`, form);
        toast.success('Department updated');
      } else {
        await api.post('/departments', form);
        toast.success('Department created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{dept ? 'Edit Department' : 'New Department'}</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Name *</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control" rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Manager</label>
                <select
                  className="form-select"
                  value={form.manager_id}
                  onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}
                >
                  <option value="">— No Manager —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Selecting a manager will also assign them to this department.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Message Manager Modal  — pick from list                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function MessageManagerModal({ onClose }) {
  const [managers, setManagers]   = useState([]);
  const [loadingMgr, setLoadingMgr] = useState(true);
  const [selected, setSelected]   = useState('');
  const [message, setMessage]     = useState('');
  const [sending, setSending]     = useState(false);
  const { user }                  = useAuth();

  useEffect(() => {
    api.get('/departments/managers-list')
      .then(r => setManagers(r.data))
      .finally(() => setLoadingMgr(false));
  }, []);

  const handleSend = async () => {
    if (!selected) { toast.error('Please select a manager'); return; }
    if (!message.trim()) { toast.error('Please write a message'); return; }
    setSending(true);
    try {
      const { data } = await api.post('/departments/message-manager', {
        to_manager_id: selected,
        message: message.trim(),
      });
      toast.success(data.message);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const selectedMgr = managers.find(m => m.id === Number(selected));

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">✉️ Message a Manager</h5>
            <button className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            {loadingMgr ? (
              <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>
                Loading managers...
              </div>
            ) : managers.length === 0 ? (
              <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
                <p style={{ fontSize: 13 }}>No other managers found.</p>
              </div>
            ) : (
              <>
                {/* Manager picker */}
                <div className="mb-4">
                  <label className="form-label">Select Manager *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {managers.map(m => (
                      <label
                        key={m.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                          border: `2px solid ${selected == m.id ? 'var(--accent)' : 'var(--border-color)'}`,
                          background: selected == m.id ? 'var(--accent)08' : 'var(--bg-primary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name="manager"
                          value={m.id}
                          checked={selected == m.id}
                          onChange={e => setSelected(e.target.value)}
                          style={{ display: 'none' }}
                        />
                        <UserAvatar user={m} size={36} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {m.department?.name ? `🏢 ${m.department.name}` : 'No department'}
                          </div>
                        </div>
                        {selected == m.id && (
                          <span style={{ color: 'var(--accent)', fontSize: 18 }}>✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Message box */}
                <div>
                  <label className="form-label">
                    Your Message *
                    {selectedMgr && (
                      <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 400 }}>
                        → to {selectedMgr.name}
                      </span>
                    )}
                  </label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder={selectedMgr ? `Write your message to ${selectedMgr.name}...` : 'Select a manager first...'}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    disabled={!selected}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {message.length}/1000 characters
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-accent"
              onClick={handleSend}
              disabled={sending || !selected || !message.trim() || loadingMgr}
            >
              {sending ? 'Sending...' : '📨 Send Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Shared helpers                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function UserAvatar({ user, size = 34 }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, flexShrink: 0 }}
    >
      {user?.avatar
        ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        : (user?.name?.slice(0, 2).toUpperCase() || '?')
      }
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--text-secondary)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}
