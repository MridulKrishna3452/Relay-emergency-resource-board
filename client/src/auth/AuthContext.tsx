import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api.me()).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  const afterAuth = useCallback(
    (user: User | null) => {
      // Drop every cached query so no data from the previous user leaks through.
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      qc.setQueryData(['me'], user);
    },
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await api.login(email, password);
      afterAuth(user);
      return user;
    },
    [afterAuth],
  );

  const register = useCallback(
    async (data: Record<string, unknown>) => {
      const { user } = await api.register(data);
      afterAuth(user);
      return user;
    },
    [afterAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      afterAuth(null);
      // Don't leave the previous user's offline copy of the board on a shared phone.
      if ('caches' in window) void caches.delete('relay-api').catch(() => undefined);
    }
  }, [afterAuth]);

  return (
    <AuthContext.Provider
      value={{ user: me.data ?? null, loading: me.isPending, login, register, logout, refresh: () => me.refetch() }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Where each role lands after logging in. */
export function homeFor(user: User | null) {
  if (!user) return '/';
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'VOLUNTEER') return '/volunteer';
  return '/board';
}
