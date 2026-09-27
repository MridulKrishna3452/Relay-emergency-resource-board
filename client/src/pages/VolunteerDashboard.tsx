import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, CheckCircle2, ClipboardList, LocateFixed, MapPin } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { RequestCard } from '../components/RequestCard';
import { CardSkeleton, EmptyState, ErrorState, Spinner } from '../components/States';
import { VerificationBanner } from '../components/VerificationBanner';
import { useGeolocation } from '../lib/useGeolocation';
import { REFRESH_MS } from '../lib/useBoard';

const RADII = [3, 5, 10, 25];

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const geo = useGeolocation();
  const [radius, setRadius] = useState(10);
  const origin = geo.coords ?? (user?.lat != null && user?.lng != null ? { lat: user.lat, lng: user.lng } : null);

  const assigned = useQuery({
    queryKey: ['requests', { assignedToMe: true }],
    queryFn: () => api.listRequests({ assignedToMe: true, status: 'ACCEPTED,IN_PROGRESS', limit: 50 }),
    refetchInterval: REFRESH_MS,
  });
  const completed = useQuery({
    queryKey: ['requests', { assignedToMe: true, status: 'FULFILLED' }],
    queryFn: () => api.listRequests({ assignedToMe: true, status: 'FULFILLED', limit: 1 }),
  });
  const nearby = useQuery({
    queryKey: ['requests', { nearby: true, origin, radius, city: user?.city }],
    queryFn: () =>
      api.listRequests(
        origin
          ? { status: 'OPEN', lat: origin.lat, lng: origin.lng, radiusKm: radius, limit: 12 }
          : { status: 'OPEN', city: user?.city, limit: 12 },
      ),
    refetchInterval: REFRESH_MS,
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold">Hi {user.name.split(' ')[0]} 👋</h1>
      <p className="mt-1 text-sm text-slate-600">Thank you for volunteering. Here's what needs you.</p>

      <div className="mt-4">
        <VerificationBanner user={user} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <ClipboardList className="h-5 w-5 text-violet-600" aria-hidden />
          <div className="mt-2 text-2xl font-bold tabular-nums">{assigned.data?.total ?? '-'}</div>
          <div className="text-sm text-slate-600">Active assignments</div>
        </div>
        <div className="card p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          <div className="mt-2 text-2xl font-bold tabular-nums">{completed.data?.total ?? '-'}</div>
          <div className="text-sm text-slate-600">Fulfilled by you</div>
        </div>
        <div className="card col-span-2 p-4 sm:col-span-1">
          <MapPin className="h-5 w-5 text-brand-700" aria-hidden />
          <div className="mt-2 font-semibold">{user.area}, {user.city}</div>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            {user.hasVehicle && <><Car className="h-4 w-4" aria-hidden /> Has vehicle · </>}
            {user.skills ?? 'No skills listed'}
          </div>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="assigned-heading">
        <h2 id="assigned-heading" className="text-lg font-bold">Assigned to me</h2>
        <div className="mt-3">
          {assigned.isError && !assigned.data ? (
            <ErrorState message={(assigned.error as Error).message} onRetry={() => assigned.refetch()} />
          ) : assigned.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><CardSkeleton /><CardSkeleton /></div>
          ) : assigned.data!.items.length === 0 ? (
            <EmptyState title="Nothing assigned right now">
              {user.verificationStatus === 'APPROVED' ? 'Pick an open request below to get started.' : 'Once verified, requests you accept will appear here.'}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assigned.data!.items.map((r) => <li key={r.id}><RequestCard request={r} /></li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="nearby-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="nearby-heading" className="text-lg font-bold">Nearby open requests</h2>
            <p className="text-sm text-slate-600">
              {geo.coords
                ? `Within ${radius} km of your current location`
                : origin
                  ? `Within ${radius} km of ${user.area} (your saved area)`
                  : `In ${user.city}`}
              , most urgent first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!geo.coords && (
              <button className="btn-secondary" onClick={() => geo.locate()}>
                {geo.status === 'locating' ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" aria-hidden />}
                Use my location
              </button>
            )}
            {origin && (
              <div className="flex rounded-xl border border-slate-300 bg-white p-1" role="group" aria-label="Radius">
                {RADII.map((r) => (
                  <button
                    key={r}
                    className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold ${radius === r ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    onClick={() => setRadius(r)}
                    aria-pressed={radius === r}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3">
          {nearby.isError && !nearby.data ? (
            <ErrorState message={(nearby.error as Error).message} onRetry={() => nearby.refetch()} />
          ) : nearby.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
          ) : nearby.data!.items.length === 0 ? (
            <EmptyState title="No open requests nearby">Try a larger radius, or check the full board.</EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.data!.items.map((r) => <li key={r.id}><RequestCard request={r} /></li>)}
            </ul>
          )}
        </div>
        <div className="mt-4 text-center">
          <Link to="/board?status=OPEN" className="font-semibold text-brand-700 underline">See all open requests on the board →</Link>
        </div>
      </section>
    </div>
  );
}
