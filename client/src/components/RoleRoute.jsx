/**
 * RoleRoute
 * Wraps routes that require specific roles.
 * Must be nested inside ProtectedRoute — assumes user is already authenticated.
 * Redirects to /dashboard if the user's role is not in allowedRoles.
 *
 * Usage:
 *   <RoleRoute allowedRoles={['admin', 'doctor']}>
 *     <AdminPanel />
 *   </RoleRoute>
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
