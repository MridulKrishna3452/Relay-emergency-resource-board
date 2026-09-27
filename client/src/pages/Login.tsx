import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Zap } from 'lucide-react';
import { ApiError } from '../api/client';
import { homeFor, useAuth } from '../auth/AuthContext';
import { Field, fieldProps } from '../components/Field';
import { Spinner } from '../components/States';
import { DEMO_ACCOUNTS } from '../lib/constants';
import { isEmail, type Errors } from '../lib/validation';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (user && !busy) return <Navigate to={next || homeFor(user)} replace />;

  const doLogin = async (e: string, p: string, key: string) => {
    setBusy(key);
    setFormError(null);
    try {
      const u = await login(e, p);
      toast.success(`Welcome, ${u.name.split(' ')[0]}!`);
      navigate(next && next.startsWith('/') ? next : homeFor(u), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setErrors(err.fields);
      } else setFormError('Could not log in. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    const errs: Errors = {};
    if (!isEmail(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    void doLogin(email, password, 'form');
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-2 md:py-14">
      <section className="card p-6">
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="mt-1 text-sm text-slate-600">
          New here?{' '}
          <Link to="/register" className="font-semibold text-brand-700 underline">
            Create an account
          </Link>
        </p>
        {formError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
            {formError}
          </div>
        )}
        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          <Field id="email" label="Email" error={errors.email} required>
            <input {...fieldProps('email', errors.email)} type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field id="password" label="Password" error={errors.password} required>
            <input {...fieldProps('password', errors.password)} type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={!!busy}>
            {busy === 'form' ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" aria-hidden />} Log in
          </button>
        </form>
      </section>

      <section className="card border-brand-200 bg-brand-50/60 p-6" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="flex items-center gap-2 text-lg font-bold text-brand-900">
          <Zap className="h-5 w-5" aria-hidden /> One-click demo login
        </h2>
        <p className="mt-1 text-sm text-slate-700">Try each role with the seeded demo data.</p>
        <ul className="mt-4 grid gap-3">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white px-4 py-3 text-left transition hover:border-brand-400 hover:shadow-sm disabled:opacity-60"
                onClick={() => doLogin(a.email, a.password, a.email)}
                disabled={!!busy}
              >
                <span>
                  <span className="block font-semibold text-slate-900">{a.role}</span>
                  <span className="block text-xs text-slate-500">
                    {a.email} · {a.password}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-brand-700">
                  {busy === a.email ? <Spinner className="h-4 w-4" /> : 'Log in →'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-600">
          Other seeded accounts (password <code>Demo@123</code>): irfan@, kavitha@, suresh@, anitha@ (requesters), divya@,
          arjun@ (approved), rahul@ (pending), vignesh@ (rejected) - all <code>@relay.demo</code>.
        </p>
      </section>
    </div>
  );
}
