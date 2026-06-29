import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Bell, Building2,
  Users, ShieldCheck, FolderOpen, Activity,
  User, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'Main', managerOnly: true },
  { path: '/tasks', icon: CheckSquare, label: 'My Tasks', section: 'Main' },
  { path: '/notifications', icon: Bell, label: 'Notifications', section: 'Main' },
  { path: '/departments', icon: Building2, label: 'Departments', section: 'Management' },
  { path: '/users', icon: Users, label: 'Users', section: 'Management', adminOnly: true },
  { path: '/roles', icon: ShieldCheck, label: 'Roles', section: 'Management', adminOnly: true },
  { path: '/files', icon: FolderOpen, label: 'Files', section: 'System' },
  { path: '/activity', icon: Activity, label: 'Activity Log', section: 'System', adminOnly: true },
  { path: '/profile', icon: User, label: 'Profile', section: 'Account' },
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
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Zap size={20} color="#fff" strokeWidth={2.5} />
        </div>
        {!collapsed && <span className="brand-name">Commandix</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {sections.map(section => {
          const items = navItems.filter(i => i.section === section && isVisible(i));
          if (!items.length) return null;
          return (
            <div key={section}>
              {!collapsed && <div className="nav-section">{section}</div>}
              {items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon-wrap">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer / Collapse button */}
      <div className="sidebar-footer">
        <button className="sidebar-collapse-btn" onClick={onToggle}>
          <span className="nav-icon-wrap">
            {collapsed ? <ChevronRight size={18} strokeWidth={1.8} /> : <ChevronLeft size={18} strokeWidth={1.8} />}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
