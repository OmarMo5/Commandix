import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { LiveProvider } from './context/LiveContext';
import { isRTL } from './i18n';
import ProtectedRoute from './components/common/ProtectedRoute';
import SuperAdminRoute from './components/common/SuperAdminRoute';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/auth/LoginPage';
import { t } from './i18n';
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const DepartmentsPage = lazy(() => import('./pages/departments/DepartmentsPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const RolesPage = lazy(() => import('./pages/roles/RolesPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const FilesPage = lazy(() => import('./pages/files/FilesPage'));
const ActivityPage = lazy(() => import('./pages/activity/ActivityPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const BrandingPage = lazy(() => import('./pages/settings/BrandingPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage'));
const MessagesPage = lazy(() => import('./pages/messages/MessagesPage'));

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <LiveProvider>
            <Suspense fallback={<div className="text-center p-5" style={{ color: 'var(--text-secondary)' }}>{t('Loading...')}</div>}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/home" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/messages" element={<MessagesPage />} />
                  <Route path="/messages/:id" element={<MessagesPage />} />
                  <Route path="/departments" element={<DepartmentsPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route element={<SuperAdminRoute />}>
                    <Route path="/roles" element={<RolesPage />} />
                    <Route path="/settings/branding" element={<BrandingPage />} />
                  </Route>
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/files" element={<FilesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />

            </Routes>
            </Suspense>
            </LiveProvider>
          </BrowserRouter>
          <ToastContainer position={isRTL ? 'top-left' : 'top-right'} rtl={isRTL} theme="colored" autoClose={3000} />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
