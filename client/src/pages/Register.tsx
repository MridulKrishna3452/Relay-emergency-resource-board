import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { HandHeart, LifeBuoy, LocateFixed } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { homeFor, useAuth } from '../auth/AuthContext';
import { Field, fieldProps } from '../components/Field';
import { Spinner } from '../components/States';
import { isEmail, isPhone, type Errors } from '../lib/validation';
import { useGeolocation } from '../lib/useGeolocation';

type Role = 'REQUESTER' | 'VOLUNTEER';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const locations = useQuery({ queryKey: ['locations'], queryFn: api.locations, staleTime: 5 * 60_000 });
  const geo = useGeolocation();

  const [role, setRole] = useState<Role>(params.get('role') === 'VOLUNTEER' ? 'VOLUNTEER' : 'REQUESTER');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', city: 'Chennai', area: '', idProofText: '', skills: '', hasVehicle: false,
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={homeFor(user)} replace />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: '' }));
  };

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (!isEmail(form.email)) e.email = 'Enter a valid email address.';
    if (!isPhone(form.phone)) e.phone = 'Enter a valid phone number (10-13 digits).';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) e.password = 'Password must include a letter and a number.';
    if (form.city.trim().length < 2) e.city = 'City is required.';
    if (form.area.trim().length < 2) e.area = 'Area is required.';
    if (role === 'VOLUNTEER' && form.idProofText.trim().length < 3) e.idProofText = 'Describe an ID proof (e.g. college ID / NGO name).';
    return e;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name, email: form.email, phone: form.phone, password: form.password, role, city: form.city, area: form.area,
        ...(coords ?? {}),
      };
      if (role === 'VOLUNTEER') Object.assign(payload, { idProofText: form.idProofText, skills: form.skills || undefined, hasVehicle: form.hasVehicle });
      const u = await register(payload);
      toast.success(role === 'VOLUNTEER' ? 'Account created! An admin will verify you shortly.' : 'Account created!');
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setErrors(err.fields);
      } else setFormError('Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cityAreas = locations.data?.cities.find((c) => c.city.toLowerCase() === form.city.trim().toLowerCase())?.areas ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
      <h1 className="text-2xl font-bold">Create your Relay account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already have one?{' '}
        <Link to="/login" className="font-semibold text-brand-700 underline">
          Log in
        </Link>
      </p>

      <fieldset className="mt-6">
        <legend className="label">I want to…</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            { value: 'REQUESTER', icon: LifeBuoy, title: 'Get help', text: 'Post needs for my family or community.' },
            { value: 'VOLUNTEER', icon: HandHeart, title: 'Volunteer', text: 'Deliver help. Requires ID verification.' },
          ] as const).map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-white p-4 transition focus-within:ring-2 focus-within:ring-brand-600 ${role === o.value ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input type="radio" name="role" value={o.value} checked={role === o.value} onChange={() => setRole(o.value)} className="sr-only" />
              <o.icon className={`h-7 w-7 shrink-0 ${role === o.value ? 'text-brand-700' : 'text-slate-400'}`} aria-hidden />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-slate-600">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <form className="card mt-6 space-y-4 p-5 sm:p-6" onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
            {formError}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Full name" error={errors.name} required>
            <input {...fieldProps('name', errors.name)} className="input" autoComplete="name" value={form.name} onChange={set('name')} />
          </Field>
          <Field id="phone" label="Phone" error={errors.phone} hint="Shared only with people on your requests." required>
            <input {...fieldProps('phone', errors.phone)} className="input" type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field id="email" label="Email" error={errors.email} required>
            <input {...fieldProps('email', errors.email)} className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field id="password" label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number." required>
            <input {...fieldProps('password', errors.password)} className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
          </Field>
          <Field id="city" label="City" error={errors.city} required>
            <input {...fieldProps('city', errors.city)} className="input" list="city-list" value={form.city} onChange={set('city')} />
            <datalist id="city-list">
              {locations.data?.cities.map((c) => <option key={c.city} value={c.city} />)}
            </datalist>
          </Field>
          <Field id="area" label="Area / neighbourhood" error={errors.area} required>
            <input {...fieldProps('area', errors.area)} className="input" list="area-list" value={form.area} onChange={set('area')} placeholder="e.g. Velachery" />
            <datalist id="area-list">
              {cityAreas.map((a) => <option key={a} value={a} />)}
            </datalist>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              const c = await geo.locate();
              if (c) {
                setCoords(c);
                toast.success('Location saved for "near me" results.');
              } else toast.error(geo.error ?? 'Could not get location. You can skip this.');
            }}
          >
            {geo.status === 'locating' ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" aria-hidden />}
            {coords ? 'Location saved ✓' : 'Save my location (optional)'}
          </button>
          <span className="text-xs text-slate-500">Used to show nearby requests. Never shown publicly.</span>
        </div>

        {role === 'VOLUNTEER' && (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-sm text-emerald-900">
              <strong>Volunteer verification:</strong> an admin will review these details before you can accept requests.
            </p>
            <Field id="idProofText" label="ID proof" error={errors.idProofText} hint='e.g. "Anna University student ID" or "Bhumi NGO volunteer card"' required>
              <input {...fieldProps('idProofText', errors.idProofText)} className="input" value={form.idProofText} onChange={set('idProofText')} maxLength={200} />
            </Field>
            <Field id="skills" label="Skills or resources" error={errors.skills} hint="e.g. can cook for 50, first-aid trained, can carry supplies">
              <textarea {...fieldProps('skills', errors.skills)} className="input min-h-[72px]" value={form.skills} onChange={set('skills')} maxLength={300} />
            </Field>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-700 focus:ring-brand-600" checked={form.hasVehicle} onChange={set('hasVehicle')} />
              <span className="text-sm font-medium">I have a vehicle I can use for deliveries or transport</span>
            </label>
          </div>
        )}

        <button type="submit" className="btn-primary w-full min-h-[52px] text-base" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {role === 'VOLUNTEER' ? 'Sign up to volunteer' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
