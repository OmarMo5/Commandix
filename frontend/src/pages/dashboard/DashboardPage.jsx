import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js';
import {
  ClipboardList, Clock, Zap, CheckCircle2,
  Users, Building2, Plus, TrendingUp, Activity
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const STAT_DEFS = (stats, isAdminUser) => [
  {
    label: 'Total Tasks',
    value: stats.tasks.total,
    icon: ClipboardList,
    color: '#6366f1',
    bg: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.08))',
    border: 'rgba(99,102,241,0.25)',
    gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  },
  {
    label: 'Pending',
    value: stats.tasks.pending,
    icon: Clock,
    color: '#f59e0b',
    bg: 'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.06))',
    border: 'rgba(245,158,11,0.2)',
    gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
  },
  {
    label: 'In Progress',
    value: stats.tasks.in_progress,
    icon: Zap,
    color: '#3b82f6',
    bg: 'linear-gradient(135deg,rgba(59,130,246,0.12),rgba(96,165,250,0.06))',
    border: 'rgba(59,130,246,0.2)',
    gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
  },
  {
    label: 'Completed',
    value: stats.tasks.completed,
    icon: CheckCircle2,
    color: '#10b981',
    bg: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(52,211,153,0.06))',
    border: 'rgba(16,185,129,0.2)',
    gradient: 'linear-gradient(135deg,#10b981,#34d399)',
  },
  ...(isAdminUser ? [
    {
      label: 'Total Users',
      value: stats.users_count,
      icon: Users,
      color: '#a855f7',
      bg: 'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(196,132,252,0.06))',
      border: 'rgba(168,85,247,0.2)',
      gradient: 'linear-gradient(135deg,#a855f7,#c084fc)',
    },
    {
      label: 'Departments',
      value: stats.departments_count,
      icon: Building2,
      color: '#06b6d4',
      bg: 'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(34,211,238,0.06))',
      border: 'rgba(6,182,212,0.2)',
      gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)',
    },
  ] : []),
];

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <div
      className="stat-card"
      style={{ '--stat-color': stat.gradient, cursor: 'default' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
        <div style={{
          fontSize: 11, fontWeight: 600, color: stat.color,
          background: stat.bg, border: `1px solid ${stat.border}`,
          padding: '3px 8px', borderRadius: 20, marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 3,
          whiteSpace: 'nowrap',
        }}>
          <TrendingUp size={11} />
          Active
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin, isManager } = useAuth();
  const { dark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isAdmin() && !isManager()) {
      navigate('/tasks', { replace: true });
      return;
    }
    api.get('/dashboard/stats').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const gridCols = isAdmin() ? 'col-6 col-md-4 col-lg-2' : 'col-6 col-md-3';
  const statDefs = STAT_DEFS(stats, isAdmin());

  const chartTextColor = dark ? '#94a3b8' : '#64748b';
  const chartGridColor = dark ? 'rgba(30,42,58,0.8)' : 'rgba(226,232,240,0.8)';

  const taskStatusData = {
    labels: ['Pending', 'In Progress', 'Completed'],
    datasets: [{
      data: [stats.tasks.pending, stats.tasks.in_progress, stats.tasks.completed],
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const priorityData = {
    labels: ['Low', 'Medium', 'High'],
    datasets: [{
      label: 'Tasks',
      data: [stats.tasks_by_priority.low, stats.tasks_by_priority.medium, stats.tasks_by_priority.high],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  const doughnutOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: chartTextColor, font: { size: 12 }, padding: 16, boxWidth: 10, boxHeight: 10 },
      },
      tooltip: { backgroundColor: dark ? '#1a2234' : '#fff', titleColor: chartTextColor, bodyColor: chartTextColor, borderColor: dark ? '#1e2a3a' : '#e2e8f0', borderWidth: 1 },
    },
    cutout: '68%',
    maintainAspectRatio: true,
  };

  const barOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: dark ? '#1a2234' : '#fff', titleColor: chartTextColor, bodyColor: chartTextColor, borderColor: dark ? '#1e2a3a' : '#e2e8f0', borderWidth: 1 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: chartTextColor, font: { size: 12 } }, border: { display: false } },
      y: { beginAtZero: true, grid: { color: chartGridColor }, ticks: { color: chartTextColor, font: { size: 12 } }, border: { display: false } },
    },
    maintainAspectRatio: true,
  };

  const statusBadgeMap = {
    pending: { cls: 'badge-pending', label: 'Pending' },
    in_progress: { cls: 'badge-in_progress', label: 'In Progress' },
    completed: { cls: 'badge-completed', label: 'Completed' },
    review: { cls: 'badge-review', label: 'Review' },
  };
  const priorityBadgeMap = {
    low: { cls: 'badge-low', label: 'Low' },
    medium: { cls: 'badge-medium', label: 'Medium' },
    high: { cls: 'badge-high', label: 'High' },
    critical: { cls: 'badge-critical', label: 'Critical' },
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong> — here's what's happening today
          </p>
        </div>
        <button className="btn-accent" onClick={() => navigate('/tasks')}>
          <Plus size={16} />
          New Task
        </button>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {statDefs.map((s, i) => (
          <div key={i} className={gridCols}>
            <StatCard stat={s} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="row g-3 mb-4">
        <div className="col-md-5">
          <div className="chart-card h-100">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">Tasks by Status</div>
                <div className="chart-card-subtitle">Distribution overview</div>
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={16} color="var(--accent)" />
              </div>
            </div>
            <div className="chart-card-body" style={{ display: 'flex', justifyContent: 'center', maxHeight: 280 }}>
              <Doughnut data={taskStatusData} options={doughnutOptions} />
            </div>
          </div>
        </div>

        <div className="col-md-7">
          <div className="chart-card h-100">
            <div className="chart-card-header">
              <div>
                <div className="chart-card-title">Tasks by Priority</div>
                <div className="chart-card-subtitle">Priority breakdown</div>
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--warning-light)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={16} color="var(--warning)" />
              </div>
            </div>
            <div className="chart-card-body" style={{ maxHeight: 280 }}>
              <Bar data={priorityData} options={barOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tasks + Activity */}
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="table-card">
            <div className="table-card-header">
              <span className="table-card-title">Recent Tasks</span>
              <button
                className="btn-ghost"
                style={{ padding: '5px 14px', fontSize: 12 }}
                onClick={() => navigate('/tasks')}
              >
                View all
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_tasks.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                        No tasks yet
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
                            by {task.creator?.name}
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
              <span className="table-card-title">Recent Activity</span>
            </div>
            <div className="timeline">
              {stats.recent_activity.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                  No activity yet
                </div>
              )}
              {stats.recent_activity.map(log => {
                const initials = log.user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
                return (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-avatar">{initials}</div>
                    <div className="timeline-content">
                      <div className="timeline-text">
                        <strong>{log.user?.name || 'System'}</strong>{' '}
                        <span className="action">{log.action.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="timeline-time">
                        {new Date(log.created_at).toLocaleString()}
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
