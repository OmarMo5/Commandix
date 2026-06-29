import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, Bell, LogOut, User, ChevronDown } from 'lucide-react';
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

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-icon-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          <Menu size={18} />
        </button>
        <div className="topbar-greeting" style={{ display: 'none' }}>
          {/* hidden on small screens via CSS if needed */}
        </div>
      </div>

      <div className="topbar-right">
        {/* Theme toggle */}
        <button
          className="topbar-icon-btn"
          onClick={toggle}
          title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <button
          className="topbar-icon-btn"
          onClick={() => navigate('/notifications')}
          title="Notifications"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border-color)', margin: '0 4px' }} />

        {/* User dropdown */}
        <div className="dropdown">
          <button className="topbar-user-btn" data-bs-toggle="dropdown">
            <div
              className="avatar"
              style={{ width: 32, height: 32, fontSize: 12, fontWeight: 700 }}
            >
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div className="topbar-user-info" style={{ display: 'none' }}>
              <div className="topbar-user-name">{user?.name}</div>
              <div className="topbar-user-role">{user?.role?.display_name || 'User'}</div>
            </div>
            <div className="d-none d-md-flex flex-column" style={{ textAlign: 'left', minWidth: 0 }}>
              <div className="topbar-user-name">{user?.name}</div>
              <div className="topbar-user-role">{user?.role?.display_name || 'User'}</div>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          </button>

          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <button className="dropdown-item" onClick={() => navigate('/profile')}>
                <User size={14} />
                My Profile
              </button>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item text-danger" onClick={handleLogout}>
                <LogOut size={14} />
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
