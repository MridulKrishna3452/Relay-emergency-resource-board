import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, type ListParams } from '../api/client';
import type { HelpRequest } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { DEFAULT_FILTERS, type BoardFilters } from '../components/FilterBar';
import { ACTIVE_STATUSES } from './constants';
import { useGeolocation, type Coords } from './useGeolocation';

export const REFRESH_MS = 15_000;

/** Board filters are stored in the URL so a filtered view can be shared or bookmarked. */
export function useBoardFilters() {
  const [params, setParams] = useSearchParams();
  const filters: BoardFilters = {
    status: params.get('status') ?? DEFAULT_FILTERS.status,
    priority: params.get('priority') ?? '',
    category: params.get('category') ?? '',
    city: params.get('city') ?? '',
    area: params.get('area') ?? '',
    q: params.get('q') ?? '',
    near: params.get('near') === '1',
    radius: Number(params.get('radius') ?? DEFAULT_FILTERS.radius) || DEFAULT_FILTERS.radius,
    sort: (params.get('sort') as BoardFilters['sort']) ?? DEFAULT_FILTERS.sort,
  };
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const update = (patch: Partial<BoardFilters> & { page?: number }) => {
    const next = { ...filters, page: 1, ...patch };
    const sp = new URLSearchParams();
    if (next.status !== DEFAULT_FILTERS.status) sp.set('status', next.status);
    (['priority', 'category', 'city', 'area', 'q'] as const).forEach((k) => next[k] && sp.set(k, next[k]));
    if (next.near) {
      sp.set('near', '1');
      sp.set('radius', String(next.radius));
    }
    if (next.sort !== DEFAULT_FILTERS.sort) sp.set('sort', next.sort);
    if (next.page > 1) sp.set('page', String(next.page));
    setParams(sp, { replace: true });
  };

  return { filters, page, update };
}

/**
 * Resolves the "near me" origin: live GPS if allowed, else the user's saved
 * location; if neither exists, falls back to filtering by the user's city.
 */
export function useNearOrigin(filters: BoardFilters, update: (p: Partial<BoardFilters>) => void) {
  const { user } = useAuth();
  const geo = useGeolocation();
  const [origin, setOrigin] = useState<{ coords: Coords; source: 'gps' | 'saved' } | null>(
    geo.coords ? { coords: geo.coords, source: 'gps' } : null,
  );
  const asked = useRef(false);

  useEffect(() => {
    if (!filters.near || origin || asked.current) return;
    asked.current = true;
    void geo.locate().then((c) => {
      asked.current = false;
      if (c) return setOrigin({ coords: c, source: 'gps' });
      if (user?.lat != null && user?.lng != null) {
        setOrigin({ coords: { lat: user.lat, lng: user.lng }, source: 'saved' });
        toast(`Location unavailable, so we're using your saved area (${user.area}).`, { icon: '📍' });
      } else if (user) {
        toast(`Location unavailable, so we're showing requests in ${user.city}.`, { icon: '📍' });
        update({ near: false, city: user.city, sort: 'priority' });
      }
    });
  }, [filters.near]); // eslint-disable-line react-hooks/exhaustive-deps

  const label = origin
    ? origin.source === 'gps'
      ? 'Using your current location'
      : `Using your saved area: ${user?.area}`
    : null;
  return { origin: filters.near ? origin : null, locating: geo.status === 'locating', label };
}

export function buildListParams(filters: BoardFilters, origin: Coords | null, page: number, limit: number): ListParams {
  return {
    status: filters.status === 'active' ? ACTIVE_STATUSES : filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority || undefined,
    category: filters.category || undefined,
    city: filters.city || undefined,
    area: filters.area || undefined,
    q: filters.q || undefined,
    ...(origin ? { lat: origin.lat, lng: origin.lng, radiusKm: filters.radius } : {}),
    sort: filters.sort === 'distance' && !origin ? 'priority' : filters.sort,
    page,
    limit,
  };
}

/** Polls the board and toasts when a new CRITICAL request appears. */
export function useLiveRequests(params: ListParams, enabled = true) {
  const query = useQuery({
    queryKey: ['requests', params],
    queryFn: () => api.listRequests(params),
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
    enabled,
  });

  const seen = useRef<Set<string> | null>(null);
  const items = query.data?.items;
  useEffect(() => {
    if (!items) return;
    const critical = items.filter((i: HelpRequest) => i.priority === 'CRITICAL' && i.status === 'OPEN');
    if (seen.current) {
      critical
        .filter((i) => !seen.current!.has(i.id))
        .forEach((i) => toast(`New critical request: ${i.title} (${i.area})`, { icon: '🚨', duration: 6000 }));
    }
    seen.current = new Set([...(seen.current ?? []), ...critical.map((i) => i.id)]);
  }, [items]);

  return query;
}

export function useSecondsSince(ts: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  return ts ? Math.max(0, Math.round((now - ts) / 1000)) : null;
}
