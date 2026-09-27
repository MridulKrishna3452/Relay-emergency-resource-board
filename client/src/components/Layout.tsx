import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { homeFor, useAuth } from '../auth/AuthContext';
import type { User } from '../api/types';
import { OfflineBanner } from './OfflineBanner';
import { ErrorBoundary } from './ErrorBoundary';

function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand-800">
      <img src="/icon.svg" alt="" className="h-8 w-8" />
      Relay
    </span>
  );
}

const ROLE_BADGE: Record<string, string> = {
  REQUESTER: 'bg-sky-100 text-sky-800',
  VOLUNTEER: 'bg-emerald-100 text-emerald-800',
  ADMIN: 'bg-violet-100 text-violet-800',
};

function badgeClass(u: User) {
  if (u.role === 'VOLUNTEER' && u.verificationStatus === 'PENDING') return 'bg-amber-100 text-amber-900';
  if (u.role === 'VOLUNTEER' && u.verificationStatus === 'REJECTED') return 'bg-red-100 text-red-800';
  return ROLE_BADGE[u.role];
}

function roleLabel(u: User) {
  if (u.role === 'VOLUNTEER' && u.verificationStatus !== 'APPROVED') {
    return `Volunteer · ${u.verificationStatus.toLowerCase()}`;
  }
  if (u.role === 'VOLUNTEER') return 'Volunteer · verified';
  return u.role.charAt(0) + u.role.slice(1).toLowerCase();
}

function navLinks(u: User | null) {
  if (!u) return [];
  const links = [{ to: '/board', label: 'Board' }, { to: '/map', label: 'Map' }];
  if (u.role === 'REQUESTER') links.push({ to: '/my-requests', label: 'My requests' });
  if (u.role === 'VOLUNTEER') links.push({ to: '/volunteer', label: 'My dashboard' });
  if (u.role === 'ADMIN') links.push({ to: '/admin', label: 'Admin' });
  return links;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const onLogout = async () => {
    // Leave protected pages first so the route guard doesn't bounce us to /login.
    navigate('/');
    await logout();
    toast.success('Logged out');
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4" aria-label="Main">
          <Link to={user ? homeFor(user) : '/'} aria-label="Relay home">
            <Logo />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks(user).map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls}>
                {l.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                {user.role === 'REQUESTER' && (
                  <Link to="/requests/new" className="btn-primary">
                    <Plus className="h-4 w-4" aria-hidden /> I need help
                  </Link>
                )}
                <div className="text-right leading-tight">
                  <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(user)}`}>{roleLabel(user)}</span>
                </div>
                <button className="btn-ghost px-3" onClick={onLogout} aria-label="Log out">
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </div>

          <button
            className="btn-ghost px-3 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {open && (
          <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 pb-4 pt-2 md:hidden">
            {user && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass(user)}`}>{roleLabel(user)}</span>
              </div>
            )}
            <div className="flex flex-col">
              {navLinks(user).map((l) => (
                <NavLink key={l.to} to={l.to} className={(s) => `${linkCls(s)} py-3 text-base`}>
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              {user ? (
                <>
                  {user.role === 'REQUESTER' && (
                    <Link to="/requests/new" className="btn-primary">
                      <Plus className="h-4 w-4" aria-hidden /> I need help
                    </Link>
                  )}
                  <button className="btn-secondary" onClick={onLogout}>
                    <LogOut className="h-4 w-4" aria-hidden /> Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-secondary">
                    Log in
                  </Link>
                  <Link to="/register" className="btn-primary">
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <OfflineBanner />

      <main id="main" className="flex-1">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        Relay is for <strong>non-medical</strong> support. In a medical emergency call <strong>108</strong>. Police: <strong>100</strong>. Disaster helpline: <strong>1070</strong>.
      </footer>
    </div>
  );
}
