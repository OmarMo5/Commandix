import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Search, X, Bookmark, BookmarkPlus, Trash2, User } from 'lucide-react';
import api from '../../api/axios';
import { EMPTY_FILTERS, filtersToParams, activeFilterCount } from '../../utils/taskFilters';
import { t } from '../../i18n';

const DUE_OPTIONS = [
  { value: '', label: t('Any due date') },
  { value: 'overdue', label: t('Overdue') },
  { value: 'today', label: t('Due today') },
  { value: 'attention', label: t('Overdue & due today') },
  { value: 'week', label: t('Next 7 days') },
  { value: 'none', label: t('No due date') },
];

export default function TaskFilters({ filters, onChange }) {
  const [departments, setDepartments] = useState([]);
  const [people, setPeople] = useState([]);
  const [views, setViews] = useState([]);
  const [searchText, setSearchText] = useState(filters.search);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState('');
  const debounce = useRef();

  const loadViews = () =>
    api.get('/saved-views', { params: { scope: 'tasks' } }).then(r => setViews(r.data || [])).catch(() => {});

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data || [])).catch(() => {});
    api.get('/users/directory').then(r => setPeople(r.data || [])).catch(() => {});
    loadViews();
  }, []);

  // When the filters are replaced from outside (a saved view, "Clear all"), reflect it in the search box.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    setSearchText(filters.search);
  }

  const set = (patch) => onChange({ ...filters, ...patch });

  const onSearch = (value) => {
    setSearchText(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => set({ search: value }), 300);
  };

  const saveView = async (e) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    try {
      await api.post('/saved-views', { name: viewName.trim(), scope: 'tasks', filters: filtersToParams(filters) });
      toast.success(t('View saved'));
      setViewName('');
      setSaving(false);
      loadViews();
    } catch (err) {
      toast.error(err.response?.data?.message || t('Failed to save view'));
    }
  };

  const applyView = (view) => onChange({ ...EMPTY_FILTERS, ...view.filters });

  const deleteView = async (e, view) => {
    e.stopPropagation();
    try {
      await api.delete(`/saved-views/${view.id}`);
      setViews(v => v.filter(x => x.id !== view.id));
    } catch { toast.error(t('Failed to delete view')); }
  };

  const active = activeFilterCount(filters);
  const chips = [
    filters.mine && { key: 'mine', label: t('My tasks') },
    filters.assigned_to_me && { key: 'assigned_to_me', label: t('Assigned to me') },
    filters.priority && { key: 'priority', label: `${t('Priority')}: ${t(filters.priority)}` },
    filters.department_id && { key: 'department_id', label: `${t('Dept')}: ${departments.find(d => String(d.id) === String(filters.department_id))?.name ?? filters.department_id}` },
    filters.assignee_id && { key: 'assignee_id', label: `${t('Assignee')}: ${people.find(p => String(p.id) === String(filters.assignee_id))?.name ?? filters.assignee_id}` },
    filters.due && { key: 'due', label: t(DUE_OPTIONS.find(o => o.value === filters.due)?.label) },
    filters.search && { key: 'search', label: `“${filters.search}”` },
  ].filter(Boolean);

  const clearOne = (key) => set({ [key]: key === 'mine' || key === 'assigned_to_me' ? false : '' });

  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-control form-control-sm"
            style={{ paddingInlineStart: 32 }}
            placeholder={t("Search title or description...")}
            value={searchText}
            onChange={e => onSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className={`btn btn-sm ${filters.mine ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => set({ mine: !filters.mine })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <User size={13} /> {t('My tasks')}
        </button>

        <select className="form-select form-select-sm" style={{ width: 'auto' }} value={filters.priority} onChange={e => set({ priority: e.target.value })}>
          <option value="">{t('Any priority')}</option>
          <option value="high">{t('High')}</option>
          <option value="medium">{t('Medium')}</option>
          <option value="low">{t('Low')}</option>
        </select>

        <select className="form-select form-select-sm" style={{ width: 'auto' }} value={filters.due} onChange={e => set({ due: e.target.value })}>
          {DUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {departments.length > 1 && (
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={filters.department_id} onChange={e => set({ department_id: e.target.value })}>
            <option value="">{t('All departments')}</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <select className="form-select form-select-sm" style={{ width: 'auto', maxWidth: 190 }} value={filters.assignee_id} onChange={e => set({ assignee_id: e.target.value })}>
          <option value="">{t('Anyone')}</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}{p.department?.name ? ` · ${p.department.name}` : ''}</option>)}
        </select>

        {/* Saved views */}
        <div className="dropdown">
          <button type="button" className="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Bookmark size={13} /> {t('Views')}{views.length > 0 && ` (${views.length})`}
          </button>
          <ul className="dropdown-menu dropdown-menu-end" style={{ minWidth: 230 }}>
            {views.length === 0 && <li><span className="dropdown-item-text" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('No saved views yet')}</span></li>}
            {views.map(v => (
              <li key={v.id}>
                <button type="button" className="dropdown-item d-flex align-items-center justify-content-between gap-2" style={{ fontSize: 13 }} onClick={() => applyView(v)}>
                  <span>{v.name}</span>
                  <span role="button" title={t("Delete view")} onClick={(e) => deleteView(e, v)} style={{ color: 'var(--danger)', display: 'inline-flex' }}><Trash2 size={13} /></span>
                </button>
              </li>
            ))}
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button type="button" className="dropdown-item" style={{ fontSize: 13 }} disabled={active === 0} onClick={() => setSaving(true)}>
                <BookmarkPlus size={13} /> {t('Save current filters…')}
              </button>
            </li>
          </ul>
        </div>

        {active > 0 && (
          <button type="button" className="btn btn-sm btn-link" style={{ fontSize: 12 }} onClick={() => onChange(EMPTY_FILTERS)}>
            {t('Clear all')}
          </button>
        )}
      </div>

      {saving && (
        <form onSubmit={saveView} className="d-flex gap-2 mt-2" style={{ maxWidth: 360 }}>
          <input autoFocus className="form-control form-control-sm" placeholder={t("Name this view (e.g. My overdue)")} maxLength={60} value={viewName} onChange={e => setViewName(e.target.value)} />
          <button className="btn btn-sm btn-primary" type="submit" disabled={!viewName.trim()}>{t('Save')}</button>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => { setSaving(false); setViewName(''); }}>{t('Cancel')}</button>
        </form>
      )}

      {chips.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mt-2">
          {chips.map(c => (
            <span key={c.key} style={{ fontSize: 12, background: 'var(--accent-light)', color: 'var(--accent-ink)', borderRadius: 20, padding: '3px 6px 3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              {c.label}
              <button type="button" onClick={() => clearOne(c.key)} title={t("Remove filter")} style={{ background: 'none', border: 'none', color: 'inherit', display: 'inline-flex', padding: 0, cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
