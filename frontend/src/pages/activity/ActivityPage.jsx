import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { t, formatDate, formatDateTime } from '../../i18n';

const actionColors = {
  created: 'var(--accent-ink)',
  updated: 'var(--info)',
  deleted: 'var(--danger)',
  login: 'var(--text-primary)',
  logout: 'var(--text-muted)',
  default: 'var(--warning)',
};

const getColor = (action) => {
  for (const [key, color] of Object.entries(actionColors)) {
    if (action.includes(key)) return color;
  }
  return actionColors.default;
};

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/activity-logs', { params: { page } });
      setLogs(data.data);
      setMeta(data);
    } catch { toast.error(t('Failed to load activity logs')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [page]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Activity Log')}</h1>
          <p className="page-subtitle">{meta?.total || 0} {t('records')}</p>
        </div>
      </div>

      <div className="card p-0" style={{ overflow: 'hidden' }}>
        {loading && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading...')}</div>
        )}
        {!loading && logs.length === 0 && (
          <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('No activity logs')}</div>
        )}
        <table className="table mb-0">
          <thead>
            <tr>
              <th>{t('User')}</th>
              <th>{t('Action')}</th>
              <th>{t('Model')}</th>
              <th>{t('IP')}</th>
              <th>{t('Time')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                      {log.user?.name?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <span style={{ fontSize: 13 }}>{log.user?.name || t('System')}</span>
                  </div>
                </td>
                <td>
                  <span style={{
                    fontSize: 12, padding: '2px 10px', borderRadius: 20,
                    background: `color-mix(in srgb, ${getColor(log.action)} 15%, transparent)`,
                    color: getColor(log.action),
                    fontWeight: 500,
                  }}>
                    {t(log.action.replace(/_/g, ' '))}
                  </span>
                </td>
                <td style={{ fontSize: 13 }}>
                  {log.model_type ? `${t(log.model_type)} #${log.model_id}` : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.ip_address || '—'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatDateTime(log.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && meta.last_page > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('Showing')} {(page - 1) * 25 + 1}–{Math.min(page * 25, meta.total)} {t('of')} {meta.total} {t('records')}
            </span>
            <div className="d-flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: '5px 12px', border: '1px solid var(--border-color)', borderRadius: 9999, color: 'var(--text-primary)', background: 'none', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}
              >
                {t('← Prev')}
              </button>

              {/* Smart page numbers: show first, last, current±1, with ... */}
              {(() => {
                const total = meta.last_page;
                const pages = new Set([1, total, page, page - 1, page + 1].filter(p => p >= 1 && p <= total));
                const sorted = [...pages].sort((a, b) => a - b);
                const result = [];
                let prev = 0;
                for (const p of sorted) {
                  if (p - prev > 1) result.push('...');
                  result.push(p);
                  prev = p;
                }
                return result.map((p, i) =>
                  p === '...'
                    ? <span key={`dots-${i}`} style={{ padding: '5px 4px', fontSize: 13, color: 'var(--text-secondary)' }}>…</span>
                    : <button key={p} onClick={() => setPage(p)}
                        style={{ padding: '5px 11px', border: '1px solid var(--border-color)', borderRadius: 9999, background: page === p ? 'var(--accent)' : 'none', color: page === p ? 'var(--on-accent)' : 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: page === p ? 700 : 400 }}>
                        {p}
                      </button>
                );
              })()}

              <button
                onClick={() => setPage(p => Math.min(meta.last_page, p + 1))}
                disabled={page === meta.last_page}
                style={{ padding: '5px 12px', border: '1px solid var(--border-color)', borderRadius: 9999, color: 'var(--text-primary)', background: 'none', cursor: page === meta.last_page ? 'not-allowed' : 'pointer', opacity: page === meta.last_page ? 0.4 : 1, fontSize: 13 }}
              >
                {t('Next →')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
