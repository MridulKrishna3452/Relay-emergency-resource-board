import { Ban, CheckCircle2, CircleDot, PlayCircle, RotateCcw, UserCheck } from 'lucide-react';
import type { HistoryEntry, Status } from '../api/types';
import { formatDateTime, timeAgo } from '../lib/format';

const ICONS: Record<Status, { icon: typeof CircleDot; cls: string }> = {
  OPEN: { icon: CircleDot, cls: 'bg-sky-100 text-sky-700' },
  ACCEPTED: { icon: UserCheck, cls: 'bg-violet-100 text-violet-700' },
  IN_PROGRESS: { icon: PlayCircle, cls: 'bg-amber-100 text-amber-700' },
  FULFILLED: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { icon: Ban, cls: 'bg-slate-200 text-slate-600' },
};

function describe(h: HistoryEntry) {
  const who = h.changedBy.name;
  if (!h.fromStatus) return `${who} posted the request`;
  if (h.fromStatus === 'ACCEPTED' && h.toStatus === 'OPEN') return `${who} released it so another volunteer can help`;
  switch (h.toStatus) {
    case 'ACCEPTED':
      return `${who} accepted the request`;
    case 'IN_PROGRESS':
      return `${who} started working on it`;
    case 'FULFILLED':
      return h.changedBy.role === 'REQUESTER' ? `${who} confirmed help was received` : `${who} marked it as fulfilled`;
    case 'CANCELLED':
      return h.changedBy.role === 'ADMIN' ? `An admin (${who}) cancelled it` : `${who} cancelled the request`;
    default:
      return `${who} changed status to ${h.toStatus}`;
  }
}

export function Timeline({ history }: { history: HistoryEntry[] }) {
  return (
    <ol className="relative space-y-5">
      {history.map((h, i) => {
        const released = h.fromStatus === 'ACCEPTED' && h.toStatus === 'OPEN';
        const meta = ICONS[h.toStatus];
        const Icon = released ? RotateCcw : meta.icon;
        return (
          <li key={h.id} className="relative flex gap-3">
            {i < history.length - 1 && <span className="absolute left-[17px] top-9 h-[calc(100%-12px)] w-0.5 bg-slate-200" aria-hidden />}
            <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${released ? 'bg-orange-100 text-orange-700' : meta.cls}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm font-semibold text-slate-900">{describe(h)}</p>
              <p className="text-xs text-slate-500">
                <time dateTime={h.createdAt}>{formatDateTime(h.createdAt)}</time> · {timeAgo(h.createdAt)}
              </p>
              {h.note && <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">“{h.note}”</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STEPS: Status[] = ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'FULFILLED'];
const STEP_LABEL: Record<string, string> = { OPEN: 'Posted', ACCEPTED: 'Accepted', IN_PROGRESS: 'In progress', FULFILLED: 'Fulfilled' };

/** Compact progress indicator across the main lifecycle. */
export function StatusStepper({ status }: { status: Status }) {
  if (status === 'CANCELLED') {
    return (
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
        <Ban className="mr-2 inline h-4 w-4" aria-hidden />
        This request was cancelled.
      </div>
    );
  }
  const current = STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} className="flex flex-col gap-1.5" aria-current={i === current ? 'step' : undefined}>
            <span className={`h-2 rounded-full ${done ? (status === 'FULFILLED' ? 'bg-emerald-500' : 'bg-brand-600') : 'bg-slate-200'}`} />
            <span className={`text-[11px] font-semibold sm:text-xs ${i === current ? 'text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'}`}>
              {STEP_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
