import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CloudOff, LocateFixed, Send, X } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Category, Priority, RequestInput } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field, fieldProps } from '../components/Field';
import { ErrorState, PageSpinner, Spinner } from '../components/States';
import { CATEGORIES, CATEGORY_META, PRIORITIES, PRIORITY_META } from '../lib/constants';
import { enqueueRequest, useOnlineStatus } from '../lib/offlineQueue';
import { useGeolocation } from '../lib/useGeolocation';
import { validateRequestForm, type Errors } from '../lib/validation';

const PRIORITY_HELP: Record<Priority, string> = {
  CRITICAL: 'Risk to safety right now (stranded, no water at all)',
  HIGH: 'Needed within a few hours',
  MEDIUM: 'Needed today',
  LOW: 'Helpful, not urgent',
};

interface FormState {
  title: string; category: Category | ''; description: string; quantity: string; peopleAffected: string;
  priority: Priority | ''; city: string; area: string; addressLine: string; contactPhone: string;
  lat: number | null; lng: number | null;
}

export default function RequestForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const geo = useGeolocation();
  const locations = useQuery({ queryKey: ['locations'], queryFn: api.locations, staleTime: 5 * 60_000 });
  const existing = useQuery({ queryKey: ['request', id, 'edit'], queryFn: () => api.getRequest(id!).then((r) => r.request), enabled: isEdit });

  const [form, setForm] = useState<FormState>({
    title: '', category: '', description: '', quantity: '1', peopleAffected: '1', priority: '',
    city: user?.city ?? '', area: user?.area ?? '', addressLine: '', contactPhone: user?.phone ?? '', lat: null, lng: null,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const r = existing.data;
    if (!r) return;
    setForm({
      title: r.title, category: r.category, description: r.description, quantity: String(r.quantity),
      peopleAffected: String(r.peopleAffected), priority: r.priority, city: r.city, area: r.area,
      addressLine: r.addressLine ?? '', contactPhone: r.contactPhone ?? '', lat: r.lat, lng: r.lng,
    });
  }, [existing.data]);

  if (isEdit && existing.isPending) return <PageSpinner />;
  if (isEdit && existing.isError && !existing.data) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorState message={(existing.error as Error).message} /></div>;
  if (isEdit && existing.data && !existing.data.allowedActions.includes('edit')) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">This request can't be edited</h1>
        <p className="mt-2 text-slate-600">Requests can only be edited by their owner while they are still OPEN.</p>
        <Link to={`/requests/${id}`} className="btn-primary mt-6">View request</Link>
      </div>
    );
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const fillLocation = async () => {
    const c = await geo.locate();
    if (c) {
      setForm((f) => ({ ...f, lat: c.lat, lng: c.lng }));
      toast.success('Location added.');
    } else {
      toast.error(`${geo.error ?? 'Could not get your location.'} We'll use the approximate centre of your area instead.`);
    }
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const errs = validateRequestForm({ ...form, category: form.category, priority: form.priority });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.');
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }
    setFormError(null);
    const payload: RequestInput = {
      title: form.title.trim(), category: form.category as Category, description: form.description.trim(),
      quantity: Number(form.quantity), peopleAffected: Number(form.peopleAffected), priority: form.priority as Priority,
      city: form.city.trim(), area: form.area.trim(), addressLine: form.addressLine.trim(), contactPhone: form.contactPhone.trim(),
      ...(form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : {}),
    };

    // Offline: queue it and sync later (new requests only).
    if (!isEdit && !navigator.onLine) {
      enqueueRequest(user!.id, payload);
      toast.success("You're offline. Your request is saved and will be posted automatically when you reconnect.", { duration: 6000 });
      navigate('/my-requests');
      return;
    }

    setBusy(true);
    try {
      const res = isEdit ? await api.updateRequest(id!, payload) : await api.createRequest(payload);
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['request', res.request.id] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      toast.success(isEdit ? 'Request updated.' : 'Request posted! Volunteers nearby can now see it.');
      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR' && !isEdit) {
        enqueueRequest(user!.id, payload);
        toast.success('Connection lost. Your request is queued and will be sent when you are back online.', { duration: 6000 });
        navigate('/my-requests');
      } else if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setErrors(err.fields);
      } else setFormError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const cityAreas = locations.data?.cities.find((c) => c.city.toLowerCase() === form.city.trim().toLowerCase())?.areas ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit request' : 'Ask for help'}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {isEdit ? 'You can edit until a volunteer accepts it.' : 'Be specific so the right volunteer can respond quickly. For medical emergencies call 108.'}
      </p>
      {!online && !isEdit && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          <CloudOff className="h-5 w-5 shrink-0" aria-hidden />
          You're offline. You can still submit. We'll queue the request and post it as soon as you reconnect.
        </div>
      )}

      <form className="mt-6 space-y-6" onSubmit={onSubmit} noValidate>
        {formError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
            {formError}
          </div>
        )}

        <section className="card space-y-4 p-5 sm:p-6">
          <fieldset>
            <legend className="label">What do you need? <span className="text-red-600">*</span></legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-describedby={errors.category ? 'category-error' : undefined}>
              {CATEGORIES.map((c) => {
                const m = CATEGORY_META[c];
                const selected = form.category === c;
                return (
                  <label key={c} className={`flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center text-sm font-semibold transition focus-within:ring-2 focus-within:ring-brand-600 ${selected ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="category" value={c} checked={selected} onChange={() => set('category', c)} className="sr-only" id={c === CATEGORIES[0] ? 'category' : undefined} />
                    <m.icon className="h-6 w-6" aria-hidden />
                    {m.label}
                  </label>
                );
              })}
            </div>
            {errors.category && <p id="category-error" className="mt-1 text-sm font-medium text-red-700" role="alert">{errors.category}</p>}
          </fieldset>

          <fieldset>
            <legend className="label">How urgent is it? <span className="text-red-600">*</span></legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {PRIORITIES.map((p) => {
                const selected = form.priority === p;
                return (
                  <label key={p} className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition focus-within:ring-2 focus-within:ring-brand-600 ${selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input type="radio" name="priority" value={p} checked={selected} onChange={() => set('priority', p)} className="sr-only" id={p === 'CRITICAL' ? 'priority' : undefined} />
                    <span className={`h-4 w-4 shrink-0 rounded-full ${PRIORITY_META[p].dot} ${selected ? 'ring-4 ring-offset-1 ring-slate-300' : ''}`} aria-hidden />
                    <span>
                      <span className="block text-sm font-bold">{PRIORITY_META[p].label}</span>
                      <span className="block text-xs text-slate-600">{PRIORITY_HELP[p]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.priority && <p className="mt-1 text-sm font-medium text-red-700" role="alert">{errors.priority}</p>}
          </fieldset>

          <Field id="title" label="Short title" error={errors.title} hint="e.g. Food packets for 10 people" required>
            <input {...fieldProps('title', errors.title)} className="input" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100} />
          </Field>
          <Field id="description" label="Details" error={errors.description} hint={`${form.description.length}/1000. Who needs it, any special needs, how to reach you.`} required>
            <textarea {...fieldProps('description', errors.description)} className="input min-h-[120px]" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="quantity" label="Quantity" error={errors.quantity} hint="Packets, cans, trips…" required>
              <input {...fieldProps('quantity', errors.quantity)} className="input" type="number" inputMode="numeric" min={1} step={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </Field>
            <Field id="peopleAffected" label="People affected" error={errors.peopleAffected} required>
              <input {...fieldProps('peopleAffected', errors.peopleAffected)} className="input" type="number" inputMode="numeric" min={1} step={1} value={form.peopleAffected} onChange={(e) => set('peopleAffected', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Where and how to reach you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="city" label="City" error={errors.city} required>
              <input {...fieldProps('city', errors.city)} className="input" list="form-city-list" value={form.city} onChange={(e) => set('city', e.target.value)} />
              <datalist id="form-city-list">{locations.data?.cities.map((c) => <option key={c.city} value={c.city} />)}</datalist>
            </Field>
            <Field id="area" label="Area" error={errors.area} required>
              <input {...fieldProps('area', errors.area)} className="input" list="form-area-list" value={form.area} onChange={(e) => set('area', e.target.value)} />
              <datalist id="form-area-list">{cityAreas.map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
          </div>
          <Field id="addressLine" label="Street / landmark" error={errors.addressLine} hint="Only shown to the volunteer who accepts." required>
            <input {...fieldProps('addressLine', errors.addressLine)} className="input" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} maxLength={200} />
          </Field>
          <Field id="contactPhone" label="Contact phone" error={errors.contactPhone} hint="Only shown to the volunteer who accepts." required>
            <input {...fieldProps('contactPhone', errors.contactPhone)} className="input" type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={fillLocation}>
              {geo.status === 'locating' ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" aria-hidden />}
              Use my current location
            </button>
            {form.lat != null && form.lng != null ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800">
                📍 {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                <button type="button" onClick={() => setForm((f) => ({ ...f, lat: null, lng: null }))} aria-label="Remove location" className="rounded-full p-1 hover:bg-emerald-100">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-xs text-slate-500">Optional. Without it we use the approximate centre of your area.</span>
            )}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link to={isEdit ? `/requests/${id}` : '/board'} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary min-h-[52px] px-6 text-base" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" aria-hidden />}
            {isEdit ? 'Save changes' : online ? 'Post request' : 'Save & post when online'}
          </button>
        </div>
      </form>
    </div>
  );
}
