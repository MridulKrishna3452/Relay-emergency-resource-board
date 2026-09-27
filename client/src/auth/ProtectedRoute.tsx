import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { Role } from '../api/types';
import { PageSpinner } from '../components/States';

export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-orange-500" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">This page isn't available for your role</h1>
        <p className="mt-2 text-slate-600">
          You're signed in as a <strong>{user.role.toLowerCase()}</strong>. This page is for{' '}
          {roles.map((r) => r.toLowerCase() + 's').join(' / ')}.
        </p>
        <Link to="/board" className="btn-primary mt-6">
          Go to the board
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
