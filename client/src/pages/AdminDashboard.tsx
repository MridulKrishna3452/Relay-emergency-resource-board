import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, BadgeCheck, Car, CheckCircle2, Clock3, Flag, ShieldCheck, Timer, UserCheck, UserX, XCircle } from 'lucide-react';
import { api } from '../api/client';
import type { Volunteer, VerificationStatus } from '../api/types';
import { NoteDialog } from '../components/Modal';
import { EmptyState, ErrorState, PageSpinner } from '../components/States';
import { PriorityBadge, StatusPill } from '../components/Badges';
import { CATEGORIES, CATEGORY_META, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from '../lib/constants';
import { formatDateTime, timeAgo } from '../lib/format';
import { REFRESH_MS } from '../lib/useBoard';

const BRAND = '#1f786d';

function StatCard({ icon: Icon, label, value, tone, sub }: { icon: typeof Clock3; label: string; value: string | number; tone: string; sub?: string }) {
  return (
    <div className="card p-4">
      <Icon className={`h-5 w-5 ${tone}`} aria-hidden />
      <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, data, colors, height = 220 }: { title: string; data: { name: string; value: number }[]; colors?: string[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 text-sm font-bold text-slate-700">{title}</figcaption>
      <div style={{ height }} role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              formatter={(v: number) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, 'Requests']}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {data.map((d, i) => <Cell key={d.name} fill={colors?.[i] ?? BRAND} />)}
              <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function AdminDashboard() {
  const qc = useQueryClient();
  const [volFilter, setVolFilter] = useState<VerificationStatus>('PENDING');
  const [dialog, setDialog] = useState<{ kind: 'approve' | 'reject'; v: Volunteer } | { kind: 'cancel'; requestId: string; title: string } | null>(null);

  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: REFRESH_MS });
  const vols = useQuery({ queryKey: ['volunteers', volFilter], queryFn: () => api.volunteers(volFilter) });
  const flags = useQuery({ queryKey: ['flags'], queryFn: api.flags, refetchInterval: REFRESH_MS });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['volunteers'] });
    qc.invalidateQueries({ queryKey: ['flags'] });
    qc.invalidateQueries({ queryKey: ['requests'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
  };

  const verify = useMutation({
    mutationFn: ({ kind, id, note }: { kind: 'approve' | 'reject'; id: string; note: string }) =>
      kind === 'approve' ? api.approve(id, note || undefined) : api.reject(id, note),
    onSuccess: (res, { kind }) => {
      toast.success(`${res.volunteer.name} ${kind === 'approve' ? 'approved, and can now accept requests' : 'rejected'}.`);
      setDialog(null);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.transition(id, 'cancel', note),
    onSuccess: () => {
      toast.success('Request cancelled and reports resolved.');
      setDialog(null);
      refreshAll();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDialog(null);
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api.dismissFlags(id),
    onSuccess: () => {
      toast.success('Reports dismissed.');
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (stats.isPending) return <PageSpinner label="Loading dashboard…" />;
  if (stats.isError && !stats.data) return <div className="mx-auto max-w-3xl px-4 py-8"><ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} /></div>;
  const s = stats.data!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Verify volunteers, moderate requests, and watch the response.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Clock3} label="Pending verifications" value={s.pendingVerifications} tone="text-amber-600" />
        <StatCard icon={AlertOctagon} label="Critical & open" value={s.openCritical} tone="text-red-600" />
        <StatCard icon={ShieldCheck} label="Verified volunteers" value={s.volunteers.approved} tone="text-emerald-600" />
        <StatCard icon={CheckCircle2} label="Fulfilled" value={s.byStatus.FULFILLED} tone="text-emerald-600" sub={`of ${s.totalRequests} total`} />
        <StatCard icon={Timer} label="Avg. time to fulfil" value={s.avgFulfilHours === null ? '-' : `${s.avgFulfilHours} h`} tone="text-brand-700" />
        <StatCard icon={Flag} label="Flagged requests" value={s.flaggedRequests} tone="text-red-600" />
      </div>

      {/* Verification queue */}
      <section className="mt-8" aria-labelledby="verify-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="verify-heading" className="text-lg font-bold">Volunteer verification</h2>
          <div className="flex flex-wrap rounded-xl border border-slate-300 bg-white p-1" role="group" aria-label="Filter volunteers">
            {(['PENDING', 'APPROVED', 'REJECTED'] as VerificationStatus[]).map((st) => (
              <button
                key={st}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${volFilter === st ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setVolFilter(st)}
                aria-pressed={volFilter === st}
              >
                {st.charAt(0) + st.slice(1).toLowerCase()}
                {st === 'PENDING' && s.pendingVerifications > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-xs text-amber-950">{s.pendingVerifications}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          {vols.isError && !vols.data ? (
            <ErrorState message={(vols.error as Error).message} onRetry={() => vols.refetch()} />
          ) : vols.isPending ? (
            <PageSpinner />
          ) : vols.data!.volunteers.length === 0 ? (
            <EmptyState title={volFilter === 'PENDING' ? 'No one is waiting for verification' : `No ${volFilter.toLowerCase()} volunteers`} icon={<BadgeCheck className="h-10 w-10 text-emerald-500" aria-hidden />}>
              {volFilter === 'PENDING' && 'New volunteer sign-ups will appear here.'}
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {vols.data!.volunteers.map((v) => (
                <li key={v.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{v.name}</p>
                      <p className="truncate text-sm text-slate-600">{v.email} · {v.phone}</p>
                      <p className="text-sm text-slate-600">{v.area}, {v.city} · signed up {timeAgo(v.createdAt)}</p>
                    </div>
                    {v.hasVehicle && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800"><Car className="h-3.5 w-3.5" aria-hidden /> Vehicle</span>}
                  </div>
                  <dl className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
                    <div><dt className="inline font-semibold">ID proof: </dt><dd className="inline">{v.idProofText || '-'}</dd></div>
                    <div><dt className="inline font-semibold">Skills: </dt><dd className="inline">{v.skills || '-'}</dd></div>
                    {v.verificationNote && <div><dt className="inline font-semibold">Admin note: </dt><dd className="inline">{v.verificationNote}</dd></div>}
                    {v.verifiedAt && <div className="text-xs text-slate-500">Reviewed {formatDateTime(v.verifiedAt)} · {v.assignedCount} request(s) handled</div>}
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {v.verificationStatus !== 'APPROVED' && (
                      <button className="btn min-h-[44px] bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialog({ kind: 'approve', v })}>
                        <UserCheck className="h-4 w-4" aria-hidden /> Approve
                      </button>
                    )}
                    {v.verificationStatus !== 'REJECTED' && (
                      <button className="btn-secondary border-red-300 text-red-700 hover:bg-red-50" onClick={() => setDialog({ kind: 'reject', v })}>
                        <UserX className="h-4 w-4" aria-hidden /> {v.verificationStatus === 'APPROVED' ? 'Revoke' : 'Reject'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Charts */}
      <section className="mt-8" aria-labelledby="charts-heading">
        <h2 id="charts-heading" className="text-lg font-bold">Requests at a glance</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <ChartCard title="By status" data={STATUSES.map((k) => ({ name: STATUS_META[k].label, value: s.byStatus[k] }))} colors={STATUSES.map((k) => STATUS_META[k].chart)} />
          <ChartCard title="By priority" data={PRIORITIES.map((k) => ({ name: PRIORITY_META[k].label, value: s.byPriority[k] }))} colors={PRIORITIES.map((k) => PRIORITY_META[k].chart)} height={180} />
          <ChartCard title="By category" data={CATEGORIES.map((k) => ({ name: CATEGORY_META[k].label, value: s.byCategory[k] }))} />
          <ChartCard title="By city" data={Object.entries(s.byCity).map(([name, value]) => ({ name, value }))} height={Math.max(140, Object.keys(s.byCity).length * 40)} />
        </div>
      </section>

      {/* Flags */}
      <section id="flags" className="mt-8 scroll-mt-20" aria-labelledby="flags-heading">
        <h2 id="flags-heading" className="text-lg font-bold">Reported requests</h2>
        <div className="mt-3">
          {flags.isError && !flags.data ? (
            <ErrorState message={(flags.error as Error).message} onRetry={() => flags.refetch()} />
          ) : flags.isPending ? (
            <PageSpinner />
          ) : flags.data!.flagged.length === 0 ? (
            <EmptyState title="No open reports" icon={<ShieldCheck className="h-10 w-10 text-emerald-500" aria-hidden />}>Reports from users about fake or inappropriate requests appear here.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {flags.data!.flagged.map((f) => {
                const cancellable = f.request.status === 'OPEN' || f.request.status === 'ACCEPTED';
                return (
                  <li key={f.request.id} className="card border-l-4 border-l-red-500 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={f.request.priority} />
                      <StatusPill status={f.request.status} />
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{f.reports.length} report{f.reports.length > 1 ? 's' : ''}</span>
                    </div>
                    <Link to={`/requests/${f.request.id}`} className="mt-2 block font-semibold text-slate-900 underline-offset-2 hover:underline">{f.request.title}</Link>
                    <p className="text-sm text-slate-600">by {f.request.requester.name} · {f.request.area}, {f.request.city} · {timeAgo(f.request.createdAt)}</p>
                    <ul className="mt-2 space-y-1">
                      {f.reports.map((r) => (
                        <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          “{r.reason}” <span className="text-slate-500">- {r.reportedBy.name} ({r.reportedBy.role.toLowerCase()})</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cancellable && (
                        <button className="btn-danger" onClick={() => setDialog({ kind: 'cancel', requestId: f.request.id, title: f.request.title })}>
                          <XCircle className="h-4 w-4" aria-hidden /> Cancel request
                        </button>
                      )}
                      <button className="btn-secondary" onClick={() => dismiss.mutate(f.request.id)} disabled={dismiss.isPending}>
                        Dismiss reports (genuine)
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <NoteDialog
        open={dialog?.kind === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => dialog?.kind === 'approve' && verify.mutate({ kind: 'approve', id: dialog.v.id, note })}
        title={dialog?.kind === 'approve' ? `Approve ${dialog.v.name}?` : ''}
        description="They will be able to accept requests immediately."
        noteLabel="Verification note (optional)"
        confirmLabel="Approve volunteer"
        busy={verify.isPending}
      />
      <NoteDialog
        open={dialog?.kind === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => dialog?.kind === 'reject' && verify.mutate({ kind: 'reject', id: dialog.v.id, note })}
        title={dialog?.kind === 'reject' ? `Reject ${dialog.v.name}?` : ''}
        description="The volunteer will see this note on their dashboard."
        noteLabel="Reason"
        noteRequired
        confirmLabel="Reject volunteer"
        danger
        busy={verify.isPending}
      />
      <NoteDialog
        open={dialog?.kind === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => dialog?.kind === 'cancel' && cancel.mutate({ id: dialog.requestId, note })}
        title="Cancel reported request?"
        description={dialog?.kind === 'cancel' ? `“${dialog.title}” will be cancelled and its reports marked resolved.` : ''}
        noteLabel="Moderation reason"
        noteRequired
        confirmLabel="Cancel request"
        danger
        busy={cancel.isPending}
      />
    </div>
  );
}
