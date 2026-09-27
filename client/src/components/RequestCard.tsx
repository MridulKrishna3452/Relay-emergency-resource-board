import { Link } from 'react-router-dom';
import { Clock, MapPin, Navigation, Users } from 'lucide-react';
import type { HelpRequest } from '../api/types';
import { CategoryIcon, PriorityBadge, StatusPill } from './Badges';
import { CATEGORY_META } from '../lib/constants';
import { formatDistance, timeAgo } from '../lib/format';

const BORDER: Record<string, string> = {
  CRITICAL: 'border-l-red-600',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-amber-400',
  LOW: 'border-l-slate-300',
};

export function RequestCard({ request: r }: { request: HelpRequest }) {
  const distance = formatDistance(r.distanceKm);
  return (
    <Link
      to={`/requests/${r.id}`}
      className={`card group flex h-full flex-col border-l-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${BORDER[r.priority]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={r.priority} />
        <StatusPill status={r.status} />
        {Date.now() - new Date(r.createdAt).getTime() < 30 * 60_000 && (
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">New</span>
        )}
        {r.volunteer && r.status !== 'OPEN' && (
          <span className="truncate text-xs text-slate-500">by {r.volunteer.name}</span>
        )}
      </div>
      <div className="mt-3 flex gap-3">
        <CategoryIcon category={r.category} />
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-800">{r.title}</h3>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">{CATEGORY_META[r.category].label}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{r.description}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
          {r.area}, {r.city}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          {r.peopleAffected} people
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-4 w-4 text-slate-400" aria-hidden />
          <time dateTime={r.createdAt}>{timeAgo(r.createdAt)}</time>
        </span>
        {distance && (
          <span className="inline-flex items-center gap-1 font-medium text-brand-700">
            <Navigation className="h-4 w-4" aria-hidden />
            {distance}
          </span>
        )}
      </div>
    </Link>
  );
}
