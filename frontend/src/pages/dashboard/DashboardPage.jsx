import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const statusColors = { pending: '#f59e0b', in_progress: '#3b82f6', completed: '#10b981' };
const priorityColors = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  // Employees go directly to their tasks — no dashboard for them
  useEffect(() => {
    if (user && !isAdmin() && !isManager()) {
      navigate('/tasks', { replace: true });
      return;
    }
    api.get('/dashboard/stats').then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonDashboard />;

  const taskStatusData = {
    labels: ['Pending', 'In Progress', 'Completed'],
    datasets: [{
      data: [stats.tasks.pending, stats.tasks.in_progress, stats.tasks.completed],
      backgroundColor: [statusColors.pending, statusColors.in_progress, statusColors.completed],
      borderWidth: 0,
    }],
  };

  const priorityData = {
    labels: ['Low', 'Medium', 'High'],
    datasets: [{
      label: 'Tasks',
      data: [stats.tasks_by_priority.low, stats.tasks_by_priority.medium, stats.tasks_by_priority.high],
      backgroundColor: [priorityColors.low, priorityColors.medium, priorityColors.high],
      borderRadius: 6,
    }],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.name}</p>
        </div>
        <button className="btn-accent" onClick={() => navigate('/tasks')}>+ New Task</button>
      </div>

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Tasks', value: stats.tasks.total, icon: '📋', color: '#6366f1' },
          { label: 'Pending', value: stats.tasks.pending, icon: '⏳', color: '#f59e0b' },
          { label: 'In Progress', value: stats.tasks.in_progress, icon: '🔄', color: '#3b82f6' },
          { label: 'Completed', value: stats.tasks.completed, icon: '✅', color: '#10b981' },
          ...(isAdmin() ? [
            { label: 'Total Users', value: stats.users_count, icon: '👥', color: '#8b5cf6' },
            { label: 'Departments', value: stats.departments_count, icon: '🏢', color: '#06b6d4' },
          ] : []),
        ].map((s, i) => (
          <div key={i} className={isAdmin() ? 'col-6 col-md-4 col-lg-2' : 'col-6 col-md-3'}>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-number" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
                <span style={{ fontSize: 28 }}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="row g-3 mb-4">
        <div className="col-md-5">
          <div className="card">
            <h6 style={{ fontWeight: 600, marginBottom: 20 }}>Tasks by Status</h6>
            <Doughnut data={taskStatusData} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '65%' }} />
          </div>
        </div>
        <div className="col-md-7">
          <div className="card">
            <h6 style={{ fontWeight: 600, marginBottom: 20 }}>Tasks by Priority</h6>
            <Bar data={priorityData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
              Recent Tasks
            </div>
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
                  <tr><td colSpan={4} className="text-center" style={{ color: 'var(--text-secondary)', padding: 24 }}>No tasks yet</td></tr>
                )}
                {stats.recent_tasks.map(task => (
                  <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>by {task.creator?.name}</div>
                    </td>
                    <td><span className={`badge badge-${task.priority}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>{task.priority}</span></td>
                    <td><span className={`badge badge-${task.status}`} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11 }}>{task.status.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.due_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
              Recent Activity
            </div>
            <div style={{ padding: '8px 0' }}>
              {stats.recent_activity.length === 0 && (
                <div className="text-center p-4" style={{ color: 'var(--text-secondary)' }}>No activity yet</div>
              )}
              {stats.recent_activity.map(log => (
                <div key={log.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12 }}>
                  <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                    {log.user?.name?.slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13 }}>
                      <strong>{log.user?.name || 'System'}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{log.action.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
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
          <div className="skeleton" style={{ width: 140, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 200, height: 16 }} />
        </div>
      </div>
      <div className="row g-3 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="col-6 col-md-3">
            <div className="stat-card">
              <div className="skeleton" style={{ width: 60, height: 36, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: 80, height: 14 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
