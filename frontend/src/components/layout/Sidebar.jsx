import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Bell, Building2,
  Users, ShieldCheck, FolderOpen, Activity,
  User, ChevronLeft, ChevronRight, Zap, Palette, BarChart3, Lock, MessageSquare, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useLive } from '../../context/LiveContext';
import api from '../../api/axios';
import Avatar from '../common/Avatar';
import { VIEW_PRESETS } from '../../utils/taskFilters';
import { t } from '../../i18n';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: t('Dashboard'), section: 'Main', managerOnly: true },
  { path: '/tasks', icon: CheckSquare, label: t('My Tasks'), section: 'Main' },
  { path: '/tasks', view: 'assigned', label: t('Assigned to me'), section: 'Main', sub: true },
  { path: '/tasks', view: 'attention', label: t('Today & Overdue'), section: 'Main', sub: true },
  { path: '/groups', icon: Lock, label: t('Private Groups'), section: 'Main' },
  { path: '/messages', icon: MessageSquare, label: t('Messages'), section: 'Main', exact: true },
  { path: '/notifications', icon: Bell, label: t('Notifications'), section: 'Main' },
  { path: '/departments', icon: Building2, label: t('Departments'), section: 'Management' },
  { path: '/users', icon: Users, label: t('Users'), section: 'Management', adminOnly: true },
  { path: '/roles', icon: ShieldCheck, label: t('Roles & Permissions'), section: 'Management', superAdminOnly: true },
  { path: '/files', icon: FolderOpen, label: t('Files'), section: 'System' },
  { path: '/reports', icon: BarChart3, label: t('Reports'), section: 'System', adminOnly: true },
  { path: '/activity', icon: Activity, label: t('Activity Log'), section: 'System', adminOnly: true },
  { path: '/settings/branding', icon: Palette, label: t('Branding'), section: 'System', superAdminOnly: true },
  { path: '/profile', icon: User, label: t('Profile'), section: 'Account' },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, isAdminOrAbove, isSuperAdmin, isManager } = useAuth();
  const { appName, logoUrl } = useSettings();
  const { groupsUnreadTotal, dmUnreadTotal, dm_unread: dmUnread } = useLive();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const currentView = new URLSearchParams(search).get('view');
  const [dms, setDms] = useState([]);
  const [dmTick, setDmTick] = useState(0);
  const dmSignature = JSON.stringify(dmUnread || {});

  // Recent conversations: refetch when an unread count changes or the Messages page says something changed.
  useEffect(() => {
    if (!user) return;
    api.get('/dm').then((r) => setDms(r.data.slice(0, 6))).catch(() => {});
  }, [user?.id, dmSignature, dmTick]);
  useEffect(() => {
    const bump = () => setDmTick((n) => n + 1);
    window.addEventListener('dm:changed', bump);
    return () => window.removeEventListener('dm:changed', bump);
  }, []);
  const sections = [...new Set(navItems.map(i => i.section))];

  const isVisible = (item) => {
    if (item.superAdminOnly && !isSuperAdmin()) return false;
    if (item.adminOnly && !isAdminOrAbove()) return false;
    if (item.managerOnly && !isAdminOrAbove() && !isManager()) return false;
    return true;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          {logoUrl
            ? <img src={logoUrl} alt={appName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            : <Zap size={20} color="var(--on-accent)" strokeWidth={2.5} />}
        </div>
        {!collapsed && <span className="brand-name">{appName}</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {sections.map(section => {
          const items = navItems.filter(i => i.section === section && isVisible(i));
          if (!items.length) return null;
          return (
            <div key={section}>
              {!collapsed && <div className="nav-section">{t(section)}</div>}
              {items.map(item => {
                const Icon = item.icon;
                // The three /tasks links share a path, so "active" also has to look at ?view=.
                const sharesTasksPath = item.path === '/tasks';
                const activeFor = (routerActive) => (sharesTasksPath
                  ? /^\/tasks(\/|$)/.test(pathname) && (item.view ? currentView === item.view : !VIEW_PRESETS[currentView])
                  : routerActive);
                if (item.sub) {
                  return (
                    <NavLink
                      key={`${item.path}?${item.view}`}
                      to={`${item.path}?view=${item.view}`}
                      className={({ isActive }) => `nav-item nav-sub ${activeFor(isActive) ? 'active' : ''}`}
                    >
                      <span>{item.label}</span>
                    </NavLink>
                  );
                }
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) => `nav-item ${activeFor(isActive) ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="nav-icon-wrap">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                    {item.path === '/messages' && dmUnreadTotal > 0 && (
                      <span className="nav-badge" title={t('{n} unread message(s)', { n: dmUnreadTotal })}>
                        {collapsed ? '' : dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}
                      </span>
                    )}
                    {item.path === '/groups' && groupsUnreadTotal > 0 && (
                      <span className="nav-badge" title={t('{n} unread group message(s)', { n: groupsUnreadTotal })}>
                        {collapsed ? '' : groupsUnreadTotal > 99 ? '99+' : groupsUnreadTotal}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}

        {/* Direct messages — recent conversations, one click to open */}
        {!collapsed && (
          <div>
            <div className="nav-section">{t('Direct Messages')}</div>
            {dms.map((c) => (
              <NavLink
                key={c.id}
                to={`/messages/${c.id}`}
                className={({ isActive }) => `nav-item dm-nav-item ${isActive ? 'active' : ''}`}
                title={c.user?.name}
              >
                <Avatar user={c.user} size={22} />
                <span className="dm-nav-name">{c.user?.name}</span>
                {c.unread > 0 && <span className="nav-badge">{c.unread > 99 ? '99+' : c.unread}</span>}
              </NavLink>
            ))}
            <button type="button" className="nav-item dm-nav-item dm-nav-new" onClick={() => navigate('/messages?new=1')}>
              <span className="nav-icon-wrap"><Plus size={16} strokeWidth={1.8} /></span>
              <span>{t('New message')}</span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer / Collapse button */}
      <div className="sidebar-footer">
        <button className="sidebar-collapse-btn" onClick={onToggle}>
          <span className="nav-icon-wrap">
            {collapsed ? <ChevronRight size={18} strokeWidth={1.8} className="flip-rtl" /> : <ChevronLeft size={18} strokeWidth={1.8} className="flip-rtl" />}
          </span>
          {!collapsed && <span>{t('Collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}
