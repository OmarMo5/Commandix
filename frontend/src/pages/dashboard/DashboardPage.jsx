import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js';
import {
  ClipboardList, Clock, Zap, CheckCircle2,
  Users, Building2, Plus, TrendingUp, Activity, UserX, AlertTriangle, AlarmClock
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { t, isRTL, formatDate, formatDateTime } from '../../i18n';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// Validated for both light & dark chart surfaces (dataviz skill validator) — do not
// swap in --accent (indigo) here, it sits too close to purple/blue for CVD separation.
const ROLE_COLORS = { super_admin: '#a855f7', admin: '#ef4444', manager: '#3b82f6', employee: '#059669' };

const STAT_DEFS = (stats, isAdminUser, isSuperAdminUser) => [
  {
    label: t('Total Tasks'),
    value: stats.tasks.total,
    icon: ClipboardList,
    color: '#6366f1',
    bg: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))',
    border: 'rgba(99,102,241,0.25)',
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  },
  {
    label: t('Pending'),
    value: stats.tasks.pending,
    icon: Clock,
    color: '#f59e0b',
    bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))',
    border: 'rgba(245,158,11,0.2)',
    gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
  },
  {
    label: t('In Progress'),
    value: stats.tasks.in_progress,
    icon: Zap,
    color: '#3b82f6',
    bg: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(96,165,250,0.06))',
    border: 'rgba(59,130,246,0.2)',
    gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
  },
  {
    label: t('Completed'),
    value: stats.tasks.completed,
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(52,211,153,0.06))',
    border: 'rgba(16,185,129,0.2)',
    gradient: 'linear-gradient(135deg,#10b981,#34d399)',
  },
  {
    label: t('Overdue'),
    value: stats.tasks.overdue ?? 0,
    icon: AlarmClock,
    color: '#ef4444',
    bg: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(248,113,113,0.06))',
    border: 'rgba(239,68,68,0.2)',
    gradient: 'linear-gradient(135deg,#ef4444,#f87171)',
    badgeText: (stats.tasks.overdue ?? 0) > 0 ? t('Review') : t('Clear'),
    badgeIcon: (stats.tasks.overdue ?? 0) > 0 ? AlertTriangle : CheckCircle2,
  },
  ...(isAdminUser ? [
    {
      label: t('Total Users'),
      value: stats.users_count,
      icon: Users,
      color: '#a855f7',
      bg: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(196,132,252,0.06))',
      border: 'rgba(168,85,247,0.2)',
      gradient: 'linear-gradient(135deg,#a855f7,#c084fc)',
    },
    {
      label: t('Departments'),
      value: stats.departments_count,
      icon: Building2,
      color: '#06b6d4',
      bg: 'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(34,211,238,0.06))',
      border: 'rgba(6,182,212,0.2)',
      gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)',
    },
  ] : []),
  ...(isSuperAdminUser ? [
    {
      label: t('Inactive Accounts'),
      value: stats.inactive_users_count,
      icon: UserX,
      color: '#ef4444',
      bg: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(248,113,113,0.06))',
      border: 'rgba(239,68,68,0.2)',
      gradient: 'linear-gradient(135deg,#ef4444,#f87171)',
      badgeText: stats.inactive_users_count > 0 ? t('Review') : t('Clear'),
      badgeIcon: AlertTriangle,
    },
    {
      label: t('Depts. w/o Manager'),
      value: stats.unmanaged_departments_count,
      icon: AlertTriangle,
      color: '#f59e0b',
      bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))',
      border: 'rgba(245,158,11,0.2)',
      gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
      badgeText: stats.unmanaged_departments_count > 0 ? t('Review') : t('Clear'),
      badgeIcon: AlertTriangle,
    },
  ] : []),
];

function StatCard({ stat }) {
  const Icon = stat.icon;
  const BadgeIcon = stat.badgeIcon;
  return (
    <div
      className="stat-card"
      style={{ '--stat-color': stat.gradient, cursor: 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div
            className="stat-icon-wrap"
            style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
          >
            <Icon size={20} color={stat.color} strokeWidth={2} />
          </div>
          <div className="stat-number">{stat.value}</div>
          <div className="stat-label">{stat.label}</div>
        </div>
        {stat.badgeText && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: stat.color,
            background: stat.bg, border: `1px solid ${stat.border}`,
            padding: '3px 8px', borderRadius: 20, marginTop: 4,
            display: 'flex', alignItems: 'center', gap: 3,
            whiteSpace: 'nowrap',
          }}>
            {BadgeIcon && <BadgeIcon size={11} />}
            {stat.badgeText}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdminOrAbove, isManager, isSuperAdmin } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isAdminOrAbove() && !isManager()) {
      navigate('/tasks', { replace: true });
      return;
    }
    api.get('/dashboard/stats').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  // Two rows so neither ever has an orphan: the 5 task cards always sit on one row
  // (equal width), and the admin-only cards (2 for Admin, 4 for Super Admin) fill a row of their own.
  const allStats = STAT_DEFS(stats, isAdminOrAbove(), isSuperAdmin());
  const taskStats = allStats.slice(0, 5);
  const adminStats = allStats.slice(5);
  const adminCols = adminStats.length === 2 ? 'col-12 col-sm-6' : 'col-6 col-lg-3';

  const chartTextColor = dark ? '#94a3b8' : '#64748b';
  const chartGridColor = dark ? 'rgba(30,42,58,0.8)' : 'rgba(226,232,240,0.8)';

  const taskStatusData = {
    labels: [t('Pending'), t('In Progress'), t('Completed')],
    datasets: [{
      data: [stats.tasks.pending, stats.tasks.in_progress, stats.tasks.completed],
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const priorityData = {
    labels: [t('Low'), t('Medium'), t('High')],
    datasets: [{
      label: t('Tasks'),
      data: [stats.tasks_by_priority.low, stats.tasks_by_priority.medium, stats.tasks_by_priority.high],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  const roleDistribution = isSuperAdmin() ? (stats.role_distribution || []) : [];
  const roleData = {
    labels: roleDistribution.map(r => r.role),
    datasets: [{
      data: roleDistribution.map(r => r.count),
      backgroundColor: roleDistribution.map(r => ROLE_COLORS[r.slug] || '#94a3b8'),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const doughnutOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        rtl: isRTL,
        textDirection: isRTL ? 'rtl' : 'ltr',
        labels: { color: chartTextColor, font: { size: 12 }, padding: 16, boxWidth: 10, boxHeight: 10 },
      },
      tooltip: { rtl: isRTL, textDirection: isRTL ? 'rtl' : 'ltr', backgroundColor: dark ? '#1a2234' : '#fff', titleColor: chartTextColor, bodyColor: chartTextColor, borderColor: dark ? '#1e2a3a' : '#e2e8f0', borderWidth: 1 },
    },
    cutout: '68%',
    maintainAspectRatio: true,
  };

  const barOptions = {
    plugins: {
      legend: { display: false, rtl: isRTL },
      tooltip: { rtl: isRTL, textDirection: isRTL ? 'rtl' : 'ltr', backgroundColor: dark ? '#1a2234' : '#fff', titleColor: chartTextColor, bodyColor: chartTextColor, borderColor: dark ? '#1e2a3a' : '#e2e8f0', borderWidth: 1 },
    },
    scales: {
      x: { reverse: isRTL, grid: { display: false }, ticks: { color: chartTextColor, font: { size: 12 } }, border: { display: false } },
      y: { position: isRTL ? 'right' : 'left', beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 12 } }, border: { display: false } },
    },
    maintainAspectRatio: true,
  };

  const statusBadgeMap = {
    pending: { cls: 'badge-pending', label: t('Pending') },
    in_progress: { cls: 'badge-in_progress', label: t('In Progress') },
    completed: { cls: 'badge-completed', label: t('Completed') },
    review: { cls: 'badge-review', label: t('Review') },
  };
  const priorityBadgeMap = {
    low: { cls: 'badge-low', label: t('Low') },
    medium: { cls: 'badge-medium', label: t('Medium') },
    high: { cls: 'badge-high', label: t('High') },
    critical: { cls: 'badge-critical', label: t('Critical') },
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('Dashboard')}</h1>
          <p className="page-subtitle">
            {t('Welcome back,')} <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong> {t("— here's what's happening today")}
          </p>
        </div>
        <button className="btn-accent" onClick={() => navigate('/tasks')}>
          <Plus size={16} />
          {t('New Task')}
        </button>
      </div>

      {/* Stat Cards */}
      <div className={`row g-3 ${adminStats.length > 0 ? 'mb-3' : 'mb-4'}`}>
        {taskStats.map((s, i) => (
          <div key={i} className="col-6 col-md-4 col-lg stat-col">
            <StatCard stat={s} />
          </div>
        ))}
      </div>
      {adminStats.length > 0 && (
        <div className="row g-3 mb-4">
          {adminStats.map((s, i) => (
            <div key={i} className={adminCols}>
              <StatCard stat={s} />
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="row g-3 mb-4">
        <div className={isSuperAdmin() ? 'col-md-4' : 'col-md-5'}>
          <div className="chart-card h-100">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">{t('Tasks by Status')}</div>
                <div className="chart-card-subtitle">{t('Distribution overview')}</div>
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={16} color="var(--accent)" />
              </div>
            </div>
            <div className="chart-card-body" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: 280 }}>
              {stats.tasks.total > 0
                ? <Doughnut data={taskStatusData} options={doughnutOptions} />
                : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('No tasks yet')}</div>}
            </div>
          </div>
        </div>

        <div className={isSuperAdmin() ? 'col-md-4' : 'col-md-7'}>
          <div className="chart-card h-100">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">{t('Tasks by Priority')}</div>
                <div className="chart-card-subtitle">{t('Priority breakdown')}</div>
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--warning-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={16} color="var(--warning)" />
              </div>
            </div>
            <div className="chart-card-body" style={{ maxHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stats.tasks.total > 0
                ? <Bar data={priorityData} options={barOptions} />
                : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('No tasks yet')}</div>}
            </div>
          </div>
        </div>

        {isSuperAdmin() && (
          <div className="col-md-4">
            <div className="chart-card h-100">
              <div className="chart-card-header">
                <div>
                  <div className="chart-card-title">{t('Team by Role')}</div>
                  <div className="chart-card-subtitle">{t('Who has access to what')}</div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--purple-light)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Users size={16} color="var(--purple)" />
                </div>
              </div>
              <div className="chart-card-body" style={{ display: 'flex', justifyContent: 'center', maxHeight: 280 }}>
                {roleDistribution.length > 0
                  ? <Doughnut data={roleData} options={doughnutOptions} />
                  : <div style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>{t('No data yet')}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Tasks + Activity */}
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="table-card h-100">
            <div className="table-card-header">
              <span className="table-card-title">{t('Recent Tasks')}</span>
              <button
                className="btn-ghost"
                style={{ padding: '5px 14px', fontSize: 12 }}
                onClick={() => navigate('/tasks')}
              >
                {t('View all')}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>{t('Task')}</th>
                    <th>{t('Priority')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Due')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_tasks.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                        {t('No tasks yet')}
                      </td>
                    </tr>
                  )}
                  {stats.recent_tasks.map(task => {
                    const s = statusBadgeMap[task.status] || { cls: '', label: task.status };
                    const p = priorityBadgeMap[task.priority] || { cls: '', label: task.priority };
                    return (
                      <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{task.title}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {t('by')} {task.creator?.name}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${p.cls}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                            {p.label}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${s.cls}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {task.due_date || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="table-card h-100">
            <div className="table-card-header">
              <span className="table-card-title">{t('Recent Activity')}</span>
            </div>
            <div className="timeline" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {stats.recent_activity.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                  {t('No activity yet')}
                </div>
              )}
              {stats.recent_activity.map(log => {
                const initials = log.user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
                return (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-avatar">{initials}</div>
                    <div className="timeline-content">
                      <div className="timeline-text">
                        <strong>{log.user?.name || t('System')}</strong>{' '}
                        <span className="action">{t(log.action.replace(/_/g, ' '))}</span>
                      </div>
                      <div className="timeline-time">
                        {formatDateTime(log.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="skeleton" style={{ width: 140, height: 26, marginBottom: 10, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 220, height: 14, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ width: 110, height: 38, borderRadius: 8 }} />
      </div>
      <div className="row g-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-6 col-md-3">
            <div className="stat-card">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 14 }} />
              <div className="skeleton" style={{ width: 56, height: 30, marginBottom: 8, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 90, height: 13, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
      <div className="row g-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className={i === 0 ? 'col-md-5' : 'col-md-7'}>
            <div className="chart-card">
              <div className="chart-card-header">
                <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 4 }} />
              </div>
              <div className="chart-card-body">
                <div className="skeleton" style={{ width: '100%', height: 220, borderRadius: 8 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
