import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function SuperAdminRoute() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin() ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
