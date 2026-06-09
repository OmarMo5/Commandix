import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard', section: 'Main', managerOnly: true },
  { path: '/tasks', icon: '✅', label: 'My Tasks', section: 'Main' },
  { path: '/notifications', icon: '🔔', label: 'Notifications', section: 'Main' },
  { path: '/departments', icon: '🏢', label: 'Departments', section: 'Management' },
  { path: '/users', icon: '👥', label: 'Users', section: 'Management', adminOnly: true },
  { path: '/roles', icon: '🛡️', label: 'Roles', section: 'Management', adminOnly: true },
  { path: '/files', icon: '📁', label: 'Files', section: 'System' },
  { path: '/activity', icon: '🧾', label: 'Activity Log', section: 'System', adminOnly: true },
  { path: '/profile', icon: '👤', label: 'Profile', section: 'Account' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { isAdmin, isManager } = useAuth();
  const sections = [...new Set(navItems.map(i => i.section))];

  const isVisible = (item) => {
    if (item.adminOnly && !isAdmin()) return false;
    if (item.managerOnly && !isAdmin() && !isManager()) return false;
    return true;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">⚡</div>
        {!collapsed && <span className="brand-name">PortalTask</span>}
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => {
          const items = navItems.filter(i => i.section === section && isVisible(i));
          if (!items.length) return null;
          return (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          onClick={onToggle}
          className="nav-item"
          style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
        >
          <span className="nav-icon">{collapsed ? '→' : '←'}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
