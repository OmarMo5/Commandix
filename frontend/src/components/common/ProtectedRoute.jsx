import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  // Remember where they were headed so the sign-in page can send them back there.
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
}
