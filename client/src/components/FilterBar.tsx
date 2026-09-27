import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api/client';
import { CATEGORIES, CATEGORY_META, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { Spinner } from './States';

export interface BoardFilters {
  status: string; // 'active' | 'all' | a Status
  priority: string;
  category: string;
  city: string;
  area: string;
  q: string;
  near: boolean;
  radius: number;
  sort: 'priority' | 'newest' | 'distance';
}

export const DEFAULT_FILTERS: BoardFilters = {
  status: 'active', priority: '', category: '', city: '', area: '', q: '', near: false, radius: 5, sort: 'priority',
};

export function countActiveFilters(f: BoardFilters) {
  return (
    (f.status !== 'active' ? 1 : 0) + (f.priority ? 1 : 0) + (f.category ? 1 : 0) + (f.city ? 1 : 0) + (f.area ? 1 : 0) + (f.q ? 1 : 0) + (f.near ? 1 : 0)
  );
}

export function FilterBar({
  filters,
  onChange,
  locating,
  nearLabel,
}: {
  filters: BoardFilters;
  onChange: (patch: Partial<BoardFilters>) => void;
  locating: boolean;
  nearLabel?: string | null;
}) {
  const locations = useQuery({ queryKey: ['locations'], queryFn: api.locations, staleTime: 5 * 60_000 });
  const [search, setSearch] = useState(filters.q);
  const [radius, setRadius] = useState(filters.radius);
  const [openMobile, setOpenMobile] = useState(false);

  // Keep local inputs in sync if the URL changes (e.g. "Clear all").
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => setRadius(filters.radius), [filters.radius]);

  // Debounce the text search and radius slider so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && onChange({ q: search }), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => radius !== filters.radius && onChange({ radius }), 300);
    return () => clearTimeout(t);
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = filters.city
    ? locations.data?.cities.find((c) => c.city === filters.city)?.areas ?? []
    : [...new Set(locations.data?.cities.flatMap((c) => c.areas) ?? [])].sort();
  const active = countActiveFilters(filters);

  const selectCls = 'input pr-8';

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="search" className="sr-only">
            Search requests
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="search"
            type="search"
            className="input pl-10"
            placeholder="Search title, description, area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`btn min-w-[44px] border px-3 ${filters.near ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
          onClick={() => onChange({ near: !filters.near, sort: !filters.near ? 'distance' : filters.sort === 'distance' ? 'priority' : filters.sort })}
          aria-pressed={filters.near}
        >
          {locating ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-5 w-5" aria-hidden />}
          <span className="hidden sm:inline">Near me</span>
        </button>
        <button
          type="button"
          className="btn-secondary px-3 md:hidden"
          onClick={() => setOpenMobile((o) => !o)}
          aria-expanded={openMobile}
          aria-controls="filter-panel"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
          <span className="sr-only">Filters</span>
          {active > 0 && <span className="rounded-full bg-brand-700 px-1.5 text-xs text-white">{active}</span>}
        </button>
      </div>

      {filters.near && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-brand-50 p-3 sm:flex-row sm:items-center">
          <label htmlFor="radius" className="text-sm font-semibold text-brand-900">
            Within <span className="tabular-nums">{radius}</span> km
          </label>
          <input
            id="radius"
            type="range"
            min={1}
            max={50}
            step={1}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="h-11 flex-1 accent-brand-700"
          />
          {nearLabel && <span className="text-xs text-brand-900">{nearLabel}</span>}
        </div>
      )}

      <div id="filter-panel" className={`${openMobile ? 'grid' : 'hidden'} mt-3 grid-cols-2 gap-2 md:grid md:grid-cols-3 lg:grid-cols-6`}>
        <div>
          <label htmlFor="f-city" className="sr-only">City</label>
          <select id="f-city" className={selectCls} value={filters.city} onChange={(e) => onChange({ city: e.target.value, area: '' })}>
            <option value="">All cities</option>
            {locations.data?.cities.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-area" className="sr-only">Area</label>
          <select id="f-area" className={selectCls} value={filters.area} onChange={(e) => onChange({ area: e.target.value })}>
            <option value="">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-category" className="sr-only">Category</label>
          <select id="f-category" className={selectCls} value={filters.category} onChange={(e) => onChange({ category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-priority" className="sr-only">Priority</label>
          <select id="f-priority" className={selectCls} value={filters.priority} onChange={(e) => onChange({ priority: e.target.value })}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="sr-only">Status</label>
          <select id="f-status" className={selectCls} value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
            <option value="active">Active</option>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className="sr-only">Sort</label>
          <select id="f-sort" className={selectCls} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as BoardFilters['sort'] })}>
            <option value="priority">Urgent first</option>
            <option value="newest">Newest</option>
            <option value="distance" disabled={!filters.near}>Nearest</option>
          </select>
        </div>
      </div>

      {active > 0 && (
        <div className="mt-3 flex justify-end">
          <button type="button" className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
            <X className="h-4 w-4" aria-hidden /> Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
