import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, CheckCircle2, Flag, Hand, MapPin, Package, Pencil, Phone, PlayCircle, RotateCcw, ShieldAlert, User as UserIcon, Users, XCircle,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { RequestDetail } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { CategoryIcon, PriorityBadge, StatusPill } from '../components/Badges';
import { NoteDialog } from '../components/Modal';
import { ErrorState, PageSpinner, Spinner } from '../components/States';
import { StatusStepper, Timeline } from '../components/Timeline';
import { VerificationBanner } from '../components/VerificationBanner';
import { CATEGORY_META } from '../lib/constants';
import { formatDateTime, formatDistance, timeAgo } from '../lib/format';
import { useGeolocation } from '../lib/useGeolocation';
import { REFRESH_MS } from '../lib/useBoard';

type TransitionAction = 'accept' | 'start' | 'fulfil' | 'release' | 'cancel';
type DialogKind = 'release' | 'cancel' | 'flag' | 'fulfil' | null;

const SUCCESS: Record<TransitionAction, string> = {
  accept: "You've accepted this request. The requester's contact details are now visible.",
  start: 'Marked as in progress.',
  fulfil: 'Marked as fulfilled. Thank you!',
  release: 'Request released back to the board.',
  cancel: 'Request cancelled.',
};

export default function RequestDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { coords } = useGeolocation();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const query = useQuery({
    queryKey: ['request', id, coords],
    queryFn: () => api.getRequest(id, coords).then((r) => r.request),
    refetchInterval: REFRESH_MS,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['request', id] });
    qc.invalidateQueries({ queryKey: ['requests'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['flags'] });
  };

  const transition = useMutation({
    mutationFn: ({ action, note }: { action: TransitionAction; note?: string }) => api.transition(id, action, note),
    onSuccess: (_d, { action }) => {
      toast.success(SUCCESS[action]);
      setDialog(null);
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDialog(null);
      invalidate(); // state probably changed underneath us (e.g. someone else accepted)
    },
  });

  const flag = useMutation({
    mutationFn: (reason: string) => api.flag(id, reason),
    onSuccess: () => {
      toast.success('Thanks. An admin will review this request.');
      setDialog(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (query.isPending) return <PageSpinner label="Loading request…" />;
  if (query.isError && !query.data) {
    const err = query.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">Request not found</h1>
          <p className="mt-2 text-slate-600">It may have been removed.</p>
          <Link to="/board" className="btn-primary mt-6">Back to the board</Link>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorState message={(err as Error).message} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const r = query.data as RequestDetail;
  const can = (a: string) => r.allowedActions.includes(a as never);
  const busy = transition.isPending;
  const pendingAction = transition.variables?.action;
  const isUnverifiedVolunteer = user?.role === 'VOLUNTEER' && user.verificationStatus !== 'APPROVED';
  const distance = formatDistance(r.distanceKm);
  const isOwner = user?.id === r.requesterId;
  const isAssigned = user?.id === r.volunteerId;

  const actionButtons = (
    <div className="grid gap-2">
      {can('accept') && (
        <button className="btn-primary min-h-[52px] text-base" disabled={busy} onClick={() => transition.mutate({ action: 'accept' })}>
          {busy && pendingAction === 'accept' ? <Spinner className="h-5 w-5" /> : <Hand className="h-5 w-5" aria-hidden />}
          Accept this request
        </button>
      )}
      {isUnverifiedVolunteer && r.status === 'OPEN' && (
        <button className="btn-primary min-h-[52px] text-base" disabled aria-describedby="accept-blocked">
          <Hand className="h-5 w-5" aria-hidden /> Accept this request
        </button>
      )}
      {isUnverifiedVolunteer && r.status === 'OPEN' && (
        <p id="accept-blocked" className="text-sm text-amber-900">
          {user!.verificationStatus === 'PENDING'
            ? 'You can accept requests once an admin verifies your account.'
            : 'Your verification was rejected, so you cannot accept requests.'}
        </p>
      )}
      {can('start') && (
        <button className="btn-primary min-h-[52px] text-base" disabled={busy} onClick={() => transition.mutate({ action: 'start' })}>
          {busy && pendingAction === 'start' ? <Spinner className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" aria-hidden />}
          Start - I'm on my way
        </button>
      )}
      {can('fulfil') && (
        <button className="btn min-h-[52px] bg-emerald-600 text-base text-white hover:bg-emerald-700" disabled={busy} onClick={() => setDialog('fulfil')}>
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {isOwner ? 'Confirm I received help' : 'Mark as fulfilled'}
        </button>
      )}
      {can('edit') && (
        <Link to={`/requests/${r.id}/edit`} className="btn-secondary">
          <Pencil className="h-4 w-4" aria-hidden /> Edit request
        </Link>
      )}
      {can('release') && (
        <button className="btn-secondary" disabled={busy} onClick={() => setDialog('release')}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Release (I can't do this)
        </button>
      )}
      {can('cancel') && (
        <button className="btn-secondary border-red-300 text-red-700 hover:bg-red-50" disabled={busy} onClick={() => setDialog('cancel')}>
          <XCircle className="h-4 w-4" aria-hidden /> {user?.role === 'ADMIN' ? 'Cancel (moderation)' : 'Cancel request'}
        </button>
      )}
      {can('flag') && (
        r.viewerHasFlagged ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Flag className="h-4 w-4" aria-hidden /> You reported this request.
          </p>
        ) : (
          <button className="btn-ghost justify-start text-slate-500" onClick={() => setDialog('flag')}>
            <Flag className="h-4 w-4" aria-hidden /> Report as fake or inappropriate
          </button>
        )
      )}
      {r.allowedActions.filter((a) => a !== 'flag').length === 0 && !(isUnverifiedVolunteer && r.status === 'OPEN') && (
        <p className="text-sm text-slate-500">
          {r.status === 'FULFILLED'
            ? 'This request has been fulfilled.'
            : r.status === 'CANCELLED'
              ? 'This request was cancelled.'
              : r.volunteer && !isAssigned
                ? `${r.volunteer.name} is handling this request.`
                : 'No actions available for you right now.'}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/board'))} className="btn-ghost -ml-3 mb-2 px-3">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      {user && isUnverifiedVolunteer && (
        <div className="mb-4">
          <VerificationBanner user={user} />
        </div>
      )}
      {r.openFlagCount ? (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="status">
          <ShieldAlert className="h-5 w-5" aria-hidden /> This request has {r.openFlagCount} open report{r.openFlagCount > 1 ? 's' : ''}. Review it in the{' '}
          <Link to="/admin#flags" className="font-semibold underline">admin dashboard</Link>.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <article className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={r.priority} />
              <StatusPill status={r.status} />
              <span className="text-sm text-slate-500">Posted {timeAgo(r.createdAt)}</span>
            </div>
            <div className="mt-4 flex gap-4">
              <CategoryIcon category={r.category} size="lg" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">{r.title}</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">{CATEGORY_META[r.category].label}</p>
              </div>
            </div>
            <div className="mt-5">
              <StatusStepper status={r.status} />
            </div>
            <p className="mt-5 whitespace-pre-line text-slate-700">{r.description}</p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <Package className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Quantity</dt>
                  <dd className="font-semibold">{r.quantity}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Users className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">People affected</dt>
                  <dd className="font-semibold">{r.peopleAffected}</dd>
                </div>
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <MapPin className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Location</dt>
                  <dd className="font-semibold">
                    {r.area}, {r.city}
                    {distance && <span className="ml-2 text-sm font-medium text-brand-700">· {distance}</span>}
                  </dd>
                  <dd className="text-sm text-slate-600">
                    {r.addressLine ?? <span className="italic">Exact address is shared with the volunteer who accepts.</span>}
                  </dd>
                  {r.contactVisible && r.lat != null && r.lng != null && (
                    <dd className="mt-1">
                      <a
                        className="text-sm font-semibold text-brand-700 underline"
                        href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=17/${r.lat}/${r.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in map ↗
                      </a>
                    </dd>
                  )}
                </div>
              </div>
            </dl>
          </article>

          <section className="card p-5 sm:p-6" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="text-lg font-bold">Timeline</h2>
            <div className="mt-4">
              <Timeline history={r.history} />
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="card p-5" aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Actions</h2>
            {actionButtons}
          </section>

          <section className="card space-y-4 p-5" aria-labelledby="people-heading">
            <h2 id="people-heading" className="text-sm font-bold uppercase tracking-wide text-slate-500">People</h2>
            <div className="flex gap-3">
              <UserIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Requester</p>
                <p className="font-semibold">{r.requester?.name}{isOwner && ' (you)'}</p>
                {r.contactPhone && (
                  <a href={`tel:${r.contactPhone.replace(/\s/g, '')}`} className="mt-1 inline-flex min-h-[44px] items-center gap-2 font-semibold text-brand-700">
                    <Phone className="h-4 w-4" aria-hidden /> {r.contactPhone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Hand className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">Volunteer</p>
                {r.volunteer ? (
                  <>
                    <p className="font-semibold">{r.volunteer.name}{isAssigned && ' (you)'}</p>
                    {r.volunteer.phone && !isAssigned && (
                      <a href={`tel:${r.volunteer.phone.replace(/\s/g, '')}`} className="mt-1 inline-flex min-h-[44px] items-center gap-2 font-semibold text-brand-700">
                        <Phone className="h-4 w-4" aria-hidden /> {r.volunteer.phone}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Not yet assigned</p>
                )}
              </div>
            </div>
            {!r.contactVisible && (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Phone numbers and exact address are only visible to the requester, the assigned volunteer and admins.
              </p>
            )}
            <p className="text-xs text-slate-400">Last updated {formatDateTime(r.updatedAt)}</p>
          </section>
        </aside>
      </div>

      <NoteDialog
        open={dialog === 'fulfil'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => transition.mutate({ action: 'fulfil', note })}
        title={isOwner ? 'Confirm you received help?' : 'Mark as fulfilled?'}
        description="This closes the request. Add a short note for the timeline if you like."
        confirmLabel="Yes, fulfilled"
        busy={busy}
      />
      <NoteDialog
        open={dialog === 'release'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => transition.mutate({ action: 'release', note })}
        title="Release this request?"
        description="It will go back on the board as OPEN so another volunteer can pick it up."
        noteLabel="Reason (helps the requester)"
        confirmLabel="Release request"
        busy={busy}
      />
      <NoteDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={(note) => transition.mutate({ action: 'cancel', note })}
        title="Cancel this request?"
        description="Volunteers will no longer see it as open. This can't be undone."
        noteLabel={user?.role === 'ADMIN' ? 'Moderation reason' : 'Reason (optional)'}
        noteRequired={user?.role === 'ADMIN'}
        confirmLabel="Cancel request"
        danger
        busy={busy}
      />
      <NoteDialog
        open={dialog === 'flag'}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => flag.mutate(reason)}
        title="Report this request"
        description="Tell the admins why this looks fake, spam, or inappropriate."
        noteLabel="Reason"
        noteRequired
        minLength={5}
        confirmLabel="Send report"
        danger
        busy={flag.isPending}
      />
    </div>
  );
}
