import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CloudOff, Plus } from 'lucide-react';
import { api } from '../api/client';
import type { HelpRequest, Status } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { RequestCard } from '../components/RequestCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { STATUS_META } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { useOutbox } from '../lib/offlineQueue';
import { REFRESH_MS } from '../lib/useBoard';

const GROUPS: { status: Status; help: string }[] = [
  { status: 'OPEN', help: 'Waiting for a volunteer to accept.' },
  { status: 'ACCEPTED', help: 'A volunteer has accepted and will start soon.' },
  { status: 'IN_PROGRESS', help: 'A volunteer is on the way.' },
  { status: 'FULFILLED', help: 'Completed. Thank you for using Relay.' },
  { status: 'CANCELLED', help: '' },
];

export default function RequesterDashboard() {
  const { user } = useAuth();
  const outbox = useOutbox().filter((o) => o.userId === user?.id);
  const query = useQuery({
    queryKey: ['requests', { mine: true }],
    queryFn: () => api.listRequests({ mine: true, limit: 100, sort: 'newest' }),
    refetchInterval: REFRESH_MS,
  });

  const byStatus = (s: Status) => (query.data?.items ?? []).filter((r: HelpRequest) => r.status === s);
  const activeCount = (['OPEN', 'ACCEPTED', 'IN_PROGRESS'] as Status[]).reduce((n, s) => n + byStatus(s).length, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            {query.data ? `${activeCount} active · ${byStatus('FULFILLED').length} fulfilled` : 'Loading…'}
          </p>
        </div>
        <Link to="/requests/new" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> New request
        </Link>
      </div>

      {outbox.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-labelledby="queued-heading">
          <h2 id="queued-heading" className="flex items-center gap-2 font-semibold text-amber-950">
            <CloudOff className="h-5 w-5" aria-hidden /> Waiting to be posted ({outbox.length})
          </h2>
          <p className="text-sm text-amber-900">Saved while offline. These will post automatically when you're back online.</p>
          <ul className="mt-3 space-y-2">
            {outbox.map((o) => (
              <li key={o.tempId} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                <span className="font-semibold">{o.data.title}</span> · {o.data.priority.toLowerCase()} · {o.data.area} · queued {timeAgo(o.queuedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 space-y-8">
        {query.isError && !query.data ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
        ) : query.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
        ) : query.data!.total === 0 && outbox.length === 0 ? (
          <EmptyState title="You haven't posted any requests yet">
            <p>When you need water, food, transport or shelter, post a request and verified volunteers nearby will see it.</p>
            <Link to="/requests/new" className="btn-primary mt-4">Post your first request</Link>
          </EmptyState>
        ) : (
          GROUPS.map((g) => {
            const items = byStatus(g.status);
            if (!items.length) return null;
            return (
              <section key={g.status} aria-labelledby={`g-${g.status}`}>
                <h2 id={`g-${g.status}`} className="flex items-baseline gap-2 text-lg font-bold">
                  {STATUS_META[g.status].label}
                  <span className="text-sm font-medium text-slate-500">({items.length})</span>
                </h2>
                {g.help && <p className="text-sm text-slate-600">{g.help}</p>}
                <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((r) => <li key={r.id}><RequestCard request={r} /></li>)}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
