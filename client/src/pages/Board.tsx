import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Map as MapIcon, Plus, SearchX } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { FilterBar } from '../components/FilterBar';
import { RequestCard } from '../components/RequestCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { VerificationBanner } from '../components/VerificationBanner';
import { buildListParams, useBoardFilters, useLiveRequests, useNearOrigin, useSecondsSince } from '../lib/useBoard';

const PAGE_SIZE = 24;

export function LiveIndicator({ updatedAt, fetching, stale }: { updatedAt: number; fetching: boolean; stale?: boolean }) {
  const secs = useSecondsSince(updatedAt);
  const ago = secs === null ? '' : secs < 5 ? 'just now' : secs < 120 ? `${secs}s ago` : `${Math.round(secs / 60)} min ago`;
  if (stale && !fetching) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-amber-800" aria-live="polite">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        Saved copy from {ago || 'earlier'} - couldn't refresh
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500" aria-live="off">
      <span className={`h-2 w-2 rounded-full ${fetching ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
      {fetching ? 'Refreshing…' : `Live · updated ${ago || 'just now'}`}
    </span>
  );
}

export default function Board() {
  const { user } = useAuth();
  const { filters, page, update } = useBoardFilters();
  const near = useNearOrigin(filters, update);
  const waitingForLocation = filters.near && !near.origin;
  const params = buildListParams(filters, near.origin?.coords ?? null, page, PAGE_SIZE);
  const query = useLiveRequests(params, !waitingForLocation);

  const data = query.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Request board</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Most urgent first, then longest waiting.</span>
            {data && <LiveIndicator updatedAt={query.dataUpdatedAt} fetching={query.isFetching} stale={query.isError} />}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/map${window.location.search}`} className="btn-secondary">
            <MapIcon className="h-4 w-4" aria-hidden /> Map view
          </Link>
          {user?.role === 'REQUESTER' && (
            <Link to="/requests/new" className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> New request
            </Link>
          )}
        </div>
      </div>

      {user && user.role === 'VOLUNTEER' && user.verificationStatus !== 'APPROVED' && (
        <div className="mb-4">
          <VerificationBanner user={user} />
        </div>
      )}

      <FilterBar filters={filters} onChange={update} locating={near.locating} nearLabel={near.label} />

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600" aria-live="polite">
        {data && (
          <span>
            <strong className="text-slate-900">{data.total}</strong> request{data.total === 1 ? '' : 's'}
            {filters.near && near.origin && <> within {filters.radius} km</>}
          </span>
        )}
      </div>

      <div className="mt-3">
        {query.isError && !query.data ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
        ) : !data || waitingForLocation ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState title="No requests match these filters" icon={<SearchX className="h-10 w-10 text-slate-400" aria-hidden />}>
            {filters.near ? 'Try a larger radius, or turn off "Near me".' : 'Try clearing some filters or searching for something else.'}
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((r) => (
                <li key={r.id}>
                  <RequestCard request={r} />
                </li>
              ))}
            </ul>
            {data.totalPages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {page} of {data.totalPages}
                </span>
                <button className="btn-secondary" disabled={page >= data.totalPages} onClick={() => update({ page: page + 1 })}>
                  Next <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
