import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const typeIcon = (type) => {
  if (type?.includes('image')) return '🖼️';
  if (type?.includes('pdf')) return '📄';
  if (type?.includes('word') || type?.includes('document')) return '📝';
  if (type?.includes('excel') || type?.includes('spreadsheet')) return '📊';
  return '📎';
};

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const { isAdmin } = useAuth();

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/files', { params: { search, page } });
      setFiles(data.data);
      setMeta(data);
    } catch { toast.error('Failed to load files'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search, page]);

  const deleteFile = async (id) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.delete(`/files/${id}`);
      toast.success('File deleted');
      fetch();
    } catch { toast.error('Failed to delete'); }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">File Manager</h1>
          <p className="page-subtitle">{meta?.total || 0} files</p>
        </div>
      </div>

      <div className="mb-4">
        <input
          className="form-control"
          style={{ maxWidth: 320 }}
          placeholder="Search files..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="table-card">
        <table className="table mb-0">
          <thead>
            <tr>
              <th>File</th>
              <th>Task</th>
              <th>Uploaded By</th>
              <th>Size</th>
              <th>Date</th>
              {isAdmin() && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>Loading...</td></tr>
            )}
            {!loading && files.length === 0 && (
              <tr><td colSpan={6} className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>No files found</td></tr>
            )}
            {files.map(file => (
              <tr key={file.id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: 22 }}>{typeIcon(file.file_type)}</span>
                    <div>
                      <a href={file.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--accent)', fontSize: 13 }}>
                        {file.file_name}
                      </a>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{file.file_type}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>{file.task?.title || '—'}</td>
                <td style={{ fontSize: 13 }}>{file.user?.name || '—'}</td>
                <td style={{ fontSize: 13 }}>{formatSize(file.file_size)}</td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(file.created_at).toLocaleDateString()}
                </td>
                {isAdmin() && (
                  <td>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => deleteFile(file.id)}>🗑️</button>
                  </td>
                )}
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
    </div>
  );
}
