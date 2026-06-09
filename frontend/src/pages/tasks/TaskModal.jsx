import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import WorkflowSetup from './WorkflowSetup';
import { useAuth } from '../../context/AuthContext';

export default function TaskModal({ task, onClose, onSaved }) {
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState('details'); // 'details' | 'workflow'
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    status: task?.status || 'pending',
    department_id: task?.department?.id || '',
    due_date: task?.due_date || '',
    assignees: task?.assignees?.map(u => u.id) || [],
    mentions: task?.mentions?.map(u => u.id) || [],
  });
  const [workflowSteps, setWorkflowSteps] = useState([]); // [ { user_id, name } ]
  const [enableWorkflow, setEnableWorkflow] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);

  useEffect(() => {
    api.get('/users', { params: { per_page: 100 } }).then(r => setUsers(r.data.data || []));
    api.get('/departments').then(r => setDepartments(r.data));
    // eslint-disable-next-line
    // If editing a task with existing workflow, preload
    if (task?.workflow_enabled && task?.workflowSteps?.length) {
      setEnableWorkflow(true);
      setWorkflowSteps(task.workflowSteps.map(s => ({ user_id: s.user_id, name: s.user?.name || '' })));
    }
  }, []);

  const toggleUser = (id, field) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (enableWorkflow && workflowSteps.length < 2) {
      toast.error('Workflow needs at least 2 people. Add more or disable workflow.');
      setTab('workflow');
      return;
    }

    setLoading(true);
    try {
      let savedTask;
      if (task) {
        const { data } = await api.put(`/tasks/${task.id}`, form);
        savedTask = data;
        toast.success('Task updated');
      } else {
        const { data } = await api.post('/tasks', form);
        savedTask = data;
        toast.success('Task created');
      }

      // Upload attachment
      if (attachment) {
        const fd = new FormData();
        fd.append('file', attachment);
        await api.post(`/tasks/${savedTask.id}/attachments`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Save workflow if enabled
      if (enableWorkflow && workflowSteps.length >= 2) {
        await api.post(`/tasks/${savedTask.id}/workflow`, {
          steps: workflowSteps.map(s => ({ user_id: s.user_id })),
        });
        toast.success('Workflow chain saved & first person notified');
      } else if (!enableWorkflow && task?.workflow_enabled) {
        // Remove workflow if it was disabled
        await api.delete(`/tasks/${savedTask.id}/workflow`);
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (t) => ({
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header" style={{ paddingBottom: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <h5 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', width: '100%' }}>
              <button style={tabStyle('details')} onClick={() => setTab('details')}>📋 Details</button>
              <button style={tabStyle('workflow')} onClick={() => setTab('workflow')}>
                🔄 Workflow Chain
                {enableWorkflow && (
                  <span style={{ marginLeft: 6, background: 'var(--accent)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>
                    {workflowSteps.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">

              {/* ── DETAILS TAB ── */}
              {tab === 'details' && (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Title *</label>
                    <input
                      className="form-control"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-control" value={form.due_date}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Department</label>
                    <select className="form-select" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                      <option value="">No Department</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Attachment</label>
                    <input type="file" className="form-control"
                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={e => setAttachment(e.target.files[0])} />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Assign To</label>
                    <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                      {users.map(u => (
                        <div key={u.id} className="form-check" style={{ marginBottom: 4 }}>
                          <input className="form-check-input" type="checkbox" id={`assign-${u.id}`}
                            checked={form.assignees.includes(u.id)} onChange={() => toggleUser(u.id, 'assignees')} />
                          <label className="form-check-label" htmlFor={`assign-${u.id}`} style={{ fontSize: 13 }}>{u.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Mention (@)</label>
                    <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                      {users
                        .filter(u => u.id !== currentUser?.id)
                        .map(u => (
                          <div key={u.id} className="form-check" style={{ marginBottom: 4 }}>
                            <input className="form-check-input" type="checkbox" id={`mention-${u.id}`}
                              checked={form.mentions.includes(u.id)} onChange={() => toggleUser(u.id, 'mentions')} />
                            <label className="form-check-label" htmlFor={`mention-${u.id}`} style={{ fontSize: 13 }}>@{u.name}</label>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* ── WORKFLOW TAB ── */}
              {tab === 'workflow' && (
                <div>
                  {/* Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="wf-toggle"
                        checked={enableWorkflow}
                        onChange={e => setEnableWorkflow(e.target.checked)}
                        style={{ width: 40, height: 22, cursor: 'pointer' }}
                      />
                    </div>
                    <label htmlFor="wf-toggle" style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Enable Sequential Workflow</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Task passes from person to person in order — each one gets notified when it's their turn.
                      </div>
                    </label>
                  </div>

                  {enableWorkflow && (
                    <WorkflowSetup
                      users={users}
                      steps={workflowSteps}
                      onChange={setWorkflowSteps}
                    />
                  )}

                  {!enableWorkflow && (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>🔄</div>
                      <p style={{ fontSize: 14 }}>Enable workflow to set up a sequential chain of people.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={loading}>
                {loading ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
