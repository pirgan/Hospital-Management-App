/**
 * ProtectedRoute
 * Wraps any route that requires authentication.
 * While auth state is rehydrating (loading=true) it shows nothing to avoid
 * a flash-redirect. Once ready, redirects to /login if no user is present.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // wait for localStorage rehydration
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
