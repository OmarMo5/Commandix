import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Download, TrendingUp, Building2 } from 'lucide-react';
import api from '../../api/axios';
import { useTheme } from '../../context/ThemeContext';
import { t, isRTL } from '../../i18n';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ department_id: '', from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const { dark } = useTheme();

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get('/reports/performance', { params: filters });
      setData(res);
    } catch {
      toast.error(t('Failed to load report'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchPerformance(); }, [filters]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/reports/export', { params: filters, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `task-performance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('Report exported'));
    } catch {
      toast.error(t('Failed to export report'));
    } finally {
      setExporting(false);
    }
  };

  const chartTextColor = dark ? '#94a3b8' : '#64748b';
  const chartGridColor = dark ? 'rgba(30,42,58,0.8)' : 'rgba(226,232,240,0.8)';

  const departmentChartData = {
    labels: data?.departments?.map(d => d.name) || [],
    datasets: [{
      label: t('Completion Rate (%)'),
      data: data?.departments?.map(d => d.completion_rate) || [],
      backgroundColor: '#6366f1',
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  const barOptions = {
    plugins: {
      legend: { display: false, rtl: isRTL },
      tooltip: {
        rtl: isRTL, textDirection: isRTL ? 'rtl' : 'ltr',
        backgroundColor: dark ? '#1a2234' : '#fff', titleColor: chartTextColor, bodyColor: chartTextColor,
        borderColor: dark ? '#1e2a3a' : '#e2e8f0', borderWidth: 1,
        callbacks: { label: (ctx) => t('{n}% completed', { n: ctx.parsed.y }) },
      },
    },
    scales: {
      x: { reverse: isRTL, grid: { display: false }, ticks: { color: chartTextColor, font: { size: 12 } }, border: { display: false } },
      y: { position: isRTL ? 'right' : 'left', beginAtZero: true, max: 100, grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 12 }, callback: (v) => v + '%' }, border: { display: false } },
    },
    maintainAspectRatio: true,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Reports')}</h1>
          <p className="page-subtitle">{t('Team performance and completion rates')}</p>
        </div>
        <button className="btn-accent" onClick={handleExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? t('Exporting...') : t('Export CSV')}
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: 16 }}>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">{t('Department')}</label>
            <select className="form-select" value={filters.department_id} onChange={e => setFilters(f => ({ ...f, department_id: e.target.value }))}>
              <option value="">{t('All Departments')}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('From')}</label>
            <input type="date" className="form-control" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="col-md-4">
            <label className="form-label">{t('To')}</label>
            <input type="date" className="form-control" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading report...')}</div>
      ) : (
        <>
          {/* Department completion chart */}
          <div className="chart-card mb-4">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">{t('Completion Rate by Department')}</div>
                <div className="chart-card-subtitle">{t('Percentage of tasks completed')}</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={16} color="var(--accent)" />
              </div>
            </div>
            <div className="chart-card-body" style={{ maxHeight: 300 }}>
              {data?.departments?.length > 0
                ? <Bar data={departmentChartData} options={barOptions} />
                : <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t('No task data yet')}</div>}
            </div>
          </div>

          {/* Employee performance table */}
          <div className="table-card">
            <div className="table-card-header">
              <span className="table-card-title">
                <TrendingUp size={15} style={{ marginInlineEnd: 6, verticalAlign: -2 }} />
                {t('Employee Performance')}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>{t('Employee')}</th>
                    <th>{t('Department')}</th>
                    <th>{t('Assigned')}</th>
                    <th>{t('Completed')}</th>
                    <th>{t('Completion Rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data?.employees || data.employees.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                        {t('No assigned tasks in this range')}
                      </td>
                    </tr>
                  )}
                  {data?.employees?.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.department}</td>
                      <td style={{ fontSize: 13 }}>{e.assigned}</td>
                      <td style={{ fontSize: 13 }}>{e.completed}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-primary)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${e.completion_rate}%`, background: 'var(--accent-gradient)' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'end' }}>{e.completion_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
