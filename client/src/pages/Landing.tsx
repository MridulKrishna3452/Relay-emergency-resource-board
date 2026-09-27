import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, HandHeart, LifeBuoy, ListChecks, MapPin, ShieldCheck, WifiOff } from 'lucide-react';
import { InstallButton } from '../components/InstallButton';
import { api } from '../api/client';
import { homeFor, useAuth } from '../auth/AuthContext';
import { CATEGORIES, CATEGORY_META } from '../lib/constants';

function Counter({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="card p-4 text-center sm:p-5">
      <div className={`text-3xl font-extrabold tabular-nums sm:text-4xl ${tone}`} aria-live="polite">
        {value ?? <span className="inline-block h-9 w-12 animate-pulse rounded bg-slate-200 align-middle" />}
      </div>
      <div className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{label}</div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary, refetchInterval: 15_000 });

  const needHelpHref = user ? (user.role === 'REQUESTER' ? '/requests/new' : homeFor(user)) : '/register?role=REQUESTER';
  const volunteerHref = user ? homeFor(user) : '/register?role=VOLUNTEER';

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-800 shadow-sm ring-1 ring-brand-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
              </span>
              Live community board · Chennai region
            </span>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              When the water rises, <span className="text-brand-700">neighbours relay help.</span>
            </h1>
            <p className="mt-4 text-base text-slate-700 sm:text-lg">
              Relay connects people who urgently need water, food, transport or a dry place to stay during floods, cyclones
              and outages with <strong>verified local volunteers</strong> who can deliver it.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to={needHelpHref} className="btn-primary min-h-[52px] px-6 text-base">
                <LifeBuoy className="h-5 w-5" aria-hidden /> I need help
              </Link>
              <Link to={volunteerHref} className="btn-secondary min-h-[52px] px-6 text-base">
                <HandHeart className="h-5 w-5" aria-hidden /> I want to volunteer
              </Link>
            </div>
            <div className="mt-3">
              <InstallButton className="btn-ghost -ml-3 text-brand-800" />
            </div>
            {!user && (
              <p className="mt-1 text-sm text-slate-600">
                Judging or exploring?{' '}
                <Link to="/login" className="font-semibold text-brand-700 underline">
                  Use a one-click demo login
                </Link>
                .
              </p>
            )}
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            <Counter label="Open requests" value={summary.data?.openRequests} tone="text-sky-700" />
            <Counter label="Critical & open" value={summary.data?.criticalOpen} tone="text-red-600" />
            <Counter label="Verified volunteers" value={summary.data?.verifiedVolunteers} tone="text-emerald-700" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-bold sm:text-2xl">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: ListChecks, title: '1. Post a need', text: 'Say what you need, how many people, and where. Mark how urgent it is from Critical to Low.' },
            { icon: BadgeCheck, title: '2. A verified volunteer accepts', text: 'Only volunteers whose ID has been checked by an admin can accept. One volunteer per request, no duplicates.' },
            { icon: MapPin, title: '3. Track it to delivery', text: 'Follow every step from Accepted to In progress to Fulfilled on a timeline, and confirm when help arrives.' },
          ].map((s) => (
            <li key={s.title} className="card p-5">
              <s.icon className="h-8 w-8 text-brand-700" aria-hidden />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="card mt-6 flex gap-4 border-sky-200 bg-sky-50 p-5">
          <WifiOff className="h-8 w-8 shrink-0 text-sky-700" aria-hidden />
          <div>
            <h3 className="font-semibold text-sky-950">Built for patchy networks</h3>
            <p className="mt-1 text-sm text-sky-900">
              Install Relay on your phone like an app. The board you last loaded stays readable offline, and requests you
              post without signal are saved and sent automatically when you reconnect.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-semibold">What you can ask for</h3>
            <ul className="mt-3 grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => {
                const Icon = CATEGORY_META[c].icon;
                return (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${CATEGORY_META[c].tint}`}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {CATEGORY_META[c].label}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card flex gap-4 border-amber-200 bg-amber-50 p-5">
            <ShieldCheck className="h-8 w-8 shrink-0 text-amber-700" aria-hidden />
            <div>
              <h3 className="font-semibold text-amber-950">Non-medical support only</h3>
              <p className="mt-1 text-sm text-amber-900">
                Relay is for essentials like water, food, transport and shelter. For medical emergencies call <strong>108</strong>.
                Exact addresses and phone numbers are only shared with the volunteer who accepts your request.
              </p>
              {!user && (
                <Link to="/register" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-800 underline">
                  Create an account <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
