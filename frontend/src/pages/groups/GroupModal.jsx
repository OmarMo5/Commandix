import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

export default function GroupModal({ onClose, onSaved }) {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers]         = useState([]);
  const [directory, setDirectory]     = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    api.get('/users/directory').then(r => setDirectory(r.data || []));
  }, []);

  const toggleMember = (id) => {
    setMembers(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  };

  const filtered = directory.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (members.length === 0) {
      toast.error('Add at least one member to the group.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/tasks/groups', {
        title,
        description,
        assignees: members,
      });
      toast.success('Group created');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🔒 New Private Group</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                Only the people you add here can see this group or anything inside it — chat, checklist, files. No one else, no exceptions.
              </div>

              <div className="mb-3">
                <label className="form-label">Group Name *</label>
                <input
                  className="form-control"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Budget Review"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="mb-1">
                <label className="form-label">Members * ({members.length} selected)</label>
                <input
                  className="form-control form-control-sm mb-2"
                  placeholder="Search people..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                  {filtered.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '10px 0' }}>No matches.</div>
                  )}
                  {filtered.map(u => (
                    <div key={u.id} className="form-check d-flex align-items-center gap-2" style={{ marginBottom: 6 }}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`member-${u.id}`}
                        checked={members.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        style={{ margin: 0 }}
                      />
                      <label htmlFor={`member-${u.id}`} className="d-flex align-items-center gap-2" style={{ fontSize: 13, cursor: 'pointer', flex: 1 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                          {u.avatar
                            ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                            : u.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{u.name}</span>
                        {u.department?.name && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>· {u.department.name}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-accent" disabled={loading}>
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
