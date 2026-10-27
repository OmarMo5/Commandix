import { useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, Bell, LogOut, User, ChevronDown, Languages } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLive } from '../../context/LiveContext';
import { t, isRTL, toggleLang } from '../../i18n';

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const { unread_count: unread } = useLive();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-icon-btn" onClick={onToggleSidebar} title={t("Toggle sidebar")}>
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
          title={dark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Language */}
        <button
          className="topbar-icon-btn topbar-lang-btn"
          onClick={toggleLang}
          title={isRTL ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          <Languages size={16} />
          <span>{isRTL ? 'EN' : 'عربي'}</span>
        </button>

        {/* Notifications */}
        <button
          className="topbar-icon-btn"
          onClick={() => navigate('/notifications')}
          title={t("Notifications")}
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
              <div className="topbar-user-role">{t(user?.role?.display_name) || t('User')}</div>
            </div>
            <div className="d-none d-md-flex flex-column" style={{ textAlign: 'start', minWidth: 0 }}>
              <div className="topbar-user-name">{user?.name}</div>
              <div className="topbar-user-role">{t(user?.role?.display_name) || t('User')}</div>
            </div>
            <ChevronDown size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          </button>

          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <button className="dropdown-item" onClick={() => navigate('/profile')}>
                <User size={14} />
                {t('My Profile')}
              </button>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item text-danger" onClick={handleLogout}>
                <LogOut size={14} />
                {t('Sign Out')}
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
