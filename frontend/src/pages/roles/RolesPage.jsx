import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ name: '', display_name: '', description: '', permissions: [] });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    try {
      const [r, p] = await Promise.all([api.get('/roles'), api.get('/permissions')]);
      setRoles(r.data);
      setAllPermissions(p.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const openModal = (role = null) => {
    setEdit(role);
    setForm(role ? {
      name: role.name, display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions?.map(p => p.id) || [],
    } : { name: '', display_name: '', description: '', permissions: [] });
    setShowModal(true);
  };

  const togglePerm = (id) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(id) ? f.permissions.filter(x => x !== id) : [...f.permissions, id],
    }));
  };

  const selectGroup = (group, perms) => {
    const ids = perms.map(p => p.id);
    const allSelected = ids.every(id => form.permissions.includes(id));
    setForm(f => ({
      ...f,
      permissions: allSelected
        ? f.permissions.filter(id => !ids.includes(id))
        : [...new Set([...f.permissions, ...ids])],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (edit) {
        await api.put(`/roles/${edit.id}`, form);
        toast.success('Role updated');
      } else {
        await api.post('/roles', form);
        toast.success('Role created');
      }
      setShowModal(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteRole = async (id) => {
    if (!confirm('Delete this role?')) return;
    try {
      await api.delete(`/roles/${id}`);
      toast.success('Role deleted');
      fetch();
    } catch { toast.error('Failed to delete'); }
  };

  const groups = [...new Set(allPermissions.map(p => p.group))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles & Permissions</h1>
          <p className="page-subtitle">{roles.length} roles</p>
        </div>
        <button className="btn-accent" onClick={() => openModal()}>+ Add Role</button>
      </div>

      {loading ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      ) : (
        <div className="row g-3">
          {roles.map(role => (
            <div key={role.id} className="col-md-4">
              <div className="card">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 style={{ fontWeight: 700 }}>{role.display_name}</h6>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{role.name}</span>
                  </div>
                  <div className="dropdown">
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} data-bs-toggle="dropdown">⋮</button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li><button className="dropdown-item" onClick={() => openModal(role)}>✏️ Edit</button></li>
                      <li><button className="dropdown-item text-danger" onClick={() => deleteRole(role.id)}>🗑️ Delete</button></li>
                    </ul>
                  </div>
                </div>
                {role.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{role.description}</p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {role.permissions?.map(p => (
                    <span key={p.id} style={{ fontSize: 11, background: 'var(--accent)15', color: 'var(--accent)', padding: '2px 8px', borderRadius: 20 }}>
                      {p.display_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{edit ? 'Edit Role' : 'New Role'}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Role Name (slug) *</label>
                      <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. team_lead" required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Display Name *</label>
                      <input className="form-control" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Team Lead" required />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <input className="form-control" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>

                  <h6 style={{ fontWeight: 600, marginBottom: 12 }}>Permissions</h6>
                  {groups.map(group => {
                    const perms = allPermissions.filter(p => p.group === group);
                    const allSelected = perms.every(p => form.permissions.includes(p.id));
                    return (
                      <div key={group} className="mb-3">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => selectGroup(group, perms)}
                            className="form-check-input"
                            id={`group-${group}`}
                          />
                          <label htmlFor={`group-${group}`} style={{ fontWeight: 600, fontSize: 13 }}>{group}</label>
                        </div>
                        <div style={{ paddingLeft: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {perms.map(p => (
                            <div key={p.id} className="form-check form-check-inline">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`perm-${p.id}`}
                                checked={form.permissions.includes(p.id)}
                                onChange={() => togglePerm(p.id)}
                              />
                              <label className="form-check-label" htmlFor={`perm-${p.id}`} style={{ fontSize: 13 }}>
                                {p.display_name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
