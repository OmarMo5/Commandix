import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/axios';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/notifications');
        setUnread(data.unread_count);
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="topbar">
      <div className="d-flex align-items-center gap-3">
        <button
          onClick={onToggleSidebar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)' }}
        >
          ☰
        </button>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <button
          onClick={toggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
          title={dark ? 'Light Mode' : 'Dark Mode'}
        >
          {dark ? '☀️' : '🌙'}
        </button>

        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/notifications')}>
          <span style={{ fontSize: 20 }}>🔔</span>
          {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
        </div>

        <div className="dropdown">
          <button
            className="d-flex align-items-center gap-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            data-bs-toggle="dropdown"
          >
            <div className="avatar" style={{ width: 34, height: 34 }}>
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user?.role?.display_name || 'User'}</div>
            </div>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li><button className="dropdown-item" onClick={() => navigate('/profile')}>👤 Profile</button></li>
            <li><hr className="dropdown-divider" /></li>
            <li><button className="dropdown-item text-danger" onClick={handleLogout}>🚪 Logout</button></li>
          </ul>
        </div>
      </div>
    </header>
  );
}
