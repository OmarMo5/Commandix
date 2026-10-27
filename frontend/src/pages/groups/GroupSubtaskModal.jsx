import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { t } from '../../i18n';

export default function GroupSubtaskModal({ groupId, groupMembers, mentionCandidates, onClose, onSaved }) {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]       = useState('medium');
  const [dueDate, setDueDate]         = useState('');
  const [assignees, setAssignees]     = useState([]);
  const [mentions, setMentions]       = useState([]);
  const [loading, setLoading]         = useState(false);

  const toggleAssignee = (id) => {
    setAssignees(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  };

  const toggleMention = (id) => {
    setMentions(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (assignees.length === 0) {
      toast.error(t('Assign this task to at least one group member.'));
      return;
    }
    setLoading(true);
    try {
      await api.post(`/tasks/${groupId}/subtasks`, {
        title,
        description,
        priority,
        due_date: dueDate || null,
        assignees,
        mentions,
      });
      toast.success(t('Task created'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to create task'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('📋 New Task in Group')}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">{t('Title *')}</label>
                <input
                  className="form-control"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">{t('Description')}</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="row g-3 mb-1">
                <div className="col-6">
                  <label className="form-label">{t('Priority')}</label>
                  <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">{t('Low')}</option>
                    <option value="medium">{t('Medium')}</option>
                    <option value="high">{t('High')}</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label">{t('Due Date')}</label>
                  <input type="date" className="form-control" value={dueDate}
                    onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="mb-1 mt-2">
                <label className="form-label">{t('Assign to (')}{assignees.length} {t('selected)')}</label>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {t('Only members of this group can be assigned.')}
                </div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                  {groupMembers.map(u => (
                    <div key={u.id} className="form-check d-flex align-items-center gap-2" style={{ marginBottom: 6 }}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`sub-assignee-${u.id}`}
                        checked={assignees.includes(u.id)}
                        onChange={() => toggleAssignee(u.id)}
                        style={{ margin: 0 }}
                      />
                      <label htmlFor={`sub-assignee-${u.id}`} className="d-flex align-items-center gap-2" style={{ fontSize: 13, cursor: 'pointer', flex: 1 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                          {u.avatar
                            ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                            : u.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{u.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {mentionCandidates?.length > 0 && (
                <div className="mb-1 mt-3">
                  <label className="form-label">{t('Mention (optional) (')}{mentions.length} {t('selected)')}</label>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {t("Tag someone from the group to loop them in — doesn't have to be an assignee.")}
                  </div>
                  <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 8 }}>
                    {mentionCandidates.map(u => (
                      <div key={u.id} className="form-check d-flex align-items-center gap-2" style={{ marginBottom: 6 }}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`sub-mention-${u.id}`}
                          checked={mentions.includes(u.id)}
                          onChange={() => toggleMention(u.id)}
                          style={{ margin: 0 }}
                        />
                        <label htmlFor={`sub-mention-${u.id}`} className="d-flex align-items-center gap-2" style={{ fontSize: 13, cursor: 'pointer', flex: 1 }}>
                          <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                            {u.avatar
                              ? <img src={u.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" />
                              : u.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <span>@{u.name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
              <button type="submit" className="btn-accent" disabled={loading}>
                {loading ? t('Creating...') : t('Create Task')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
