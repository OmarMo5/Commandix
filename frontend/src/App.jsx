import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import SuperAdminRoute from './components/common/SuperAdminRoute';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import TasksPage from './pages/tasks/TasksPage';
import DepartmentsPage from './pages/departments/DepartmentsPage';
import UsersPage from './pages/users/UsersPage';
import RolesPage from './pages/roles/RolesPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import FilesPage from './pages/files/FilesPage';
import ActivityPage from './pages/activity/ActivityPage';
import ProfilePage from './pages/profile/ProfilePage';
import BrandingPage from './pages/settings/BrandingPage';
import ReportsPage from './pages/reports/ReportsPage';
import GroupsPage from './pages/groups/GroupsPage';

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/home" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
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
          </BrowserRouter>
          <ToastContainer position="top-right" theme="colored" autoClose={3000} />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
