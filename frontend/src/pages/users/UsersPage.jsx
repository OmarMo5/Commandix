import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '', department_id: '', is_active: true });
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', { params: { search, page } });
      setUsers(data.data);
      setMeta(data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/roles').then(r => setRoles(r.data));
    api.get('/departments').then(r => setDepartments(r.data));
  }, []);

  useEffect(() => { fetchUsers(); }, [search, page]);

  const openModal = (user = null) => {
    setEdit(user);
    setForm(user ? {
      name: user.name, email: user.email, password: '',
      role_id: user.role?.id || '', department_id: user.department?.id || '',
      is_active: user.is_active,
    } : { name: '', email: '', password: '', role_id: '', department_id: '', is_active: true });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (edit) {
        await api.put(`/users/${edit.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch { toast.error('Failed to delete'); }
  };

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{meta?.total || 0} total users</p>
        </div>
        <button className="btn-accent" onClick={() => openModal()}>+ Add User</button>
      </div>

      <div className="mb-4">
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Search users..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="table-card">
        <table className="table mb-0">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>Loading...</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>No users found</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                      {u.avatar ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : u.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {u.role ? (
                    <span style={{ fontSize: 12, background: 'var(--accent)20', color: 'var(--accent)', padding: '2px 10px', borderRadius: 20 }}>
                      {u.role.display_name}
                    </span>
                  ) : <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>—</span>}
                </td>
                <td style={{ fontSize: 13 }}>{u.department?.name || '—'}</td>
                <td>
                  <span
                    style={{
                      fontSize: 12, padding: '2px 10px', borderRadius: 20,
                      background: u.is_active ? '#d1fae5' : '#fee2e2',
                      color: u.is_active ? '#059669' : '#dc2626',
                    }}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => openModal(u)}>✏️</button>
                    <button className="btn btn-sm" onClick={() => toggleActive(u)}
                      style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      {u.is_active ? '🚫' : '✅'}
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(u.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && meta.last_page > 1 && (
          <div className="d-flex justify-content-center gap-2 p-3">
            {[...Array(meta.last_page)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={page === i + 1 ? 'btn-accent' : 'btn btn-outline-secondary btn-sm'}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit ? 'Edit User' : 'New User'}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name *</label>
                    <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password {edit ? '(leave blank to keep)' : '*'}</label>
                    <input type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!edit} />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}>
                        <option value="">No Role</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label">Department</label>
                      <select className="form-select" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                        <option value="">No Department</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-accent" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
