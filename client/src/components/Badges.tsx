import { AlertOctagon } from 'lucide-react';
import type { Category, Priority, Status } from '../api/types';
import { CATEGORY_META, PRIORITY_META, STATUS_META } from '../lib/constants';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${m.badge}`}>
      {priority === 'CRITICAL' && <AlertOctagon className="h-3.5 w-3.5" aria-hidden />}
      {m.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${m.pill}`}>
      <span className="sr-only">Status: </span>
      {m.label}
    </span>
  );
}

export function CategoryIcon({ category, size = 'md' }: { category: Category; size?: 'sm' | 'md' | 'lg' }) {
  const m = CATEGORY_META[category];
  const Icon = m.icon;
  const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${m.tint} ${box}`} title={m.label}>
      <Icon className={icon} aria-hidden />
      <span className="sr-only">{m.label}</span>
    </span>
  );
}
