import { Bus, Droplets, Home, Package, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { Category, Priority, Status } from '../api/types';

export const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const STATUSES: Status[] = ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'];
export const CATEGORIES: Category[] = ['WATER', 'FOOD', 'TRANSPORT', 'SHELTER', 'OTHER_ESSENTIALS'];
export const ACTIVE_STATUSES = 'OPEN,ACCEPTED,IN_PROGRESS';

export const PRIORITY_META: Record<Priority, { label: string; badge: string; dot: string; chart: string }> = {
  CRITICAL: { label: 'Critical', badge: 'bg-red-600 text-white', dot: 'bg-red-600', chart: '#dc2626' },
  HIGH: { label: 'High', badge: 'bg-orange-500 text-white', dot: 'bg-orange-500', chart: '#f97316' },
  MEDIUM: { label: 'Medium', badge: 'bg-amber-300 text-amber-950', dot: 'bg-amber-400', chart: '#f59e0b' },
  LOW: { label: 'Low', badge: 'bg-slate-200 text-slate-800', dot: 'bg-slate-400', chart: '#64748b' },
};

export const STATUS_META: Record<Status, { label: string; pill: string; chart: string }> = {
  OPEN: { label: 'Open', pill: 'bg-sky-50 text-sky-800 ring-sky-200', chart: '#0284c7' },
  ACCEPTED: { label: 'Accepted', pill: 'bg-violet-50 text-violet-800 ring-violet-200', chart: '#7c3aed' },
  IN_PROGRESS: { label: 'In progress', pill: 'bg-amber-50 text-amber-900 ring-amber-200', chart: '#d97706' },
  FULFILLED: { label: 'Fulfilled', pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200', chart: '#059669' },
  CANCELLED: { label: 'Cancelled', pill: 'bg-slate-100 text-slate-600 ring-slate-200', chart: '#94a3b8' },
};

export const CATEGORY_META: Record<Category, { label: string; icon: LucideIcon; tint: string }> = {
  WATER: { label: 'Water', icon: Droplets, tint: 'bg-sky-100 text-sky-700' },
  FOOD: { label: 'Food', icon: UtensilsCrossed, tint: 'bg-orange-100 text-orange-700' },
  TRANSPORT: { label: 'Transport', icon: Bus, tint: 'bg-indigo-100 text-indigo-700' },
  SHELTER: { label: 'Shelter', icon: Home, tint: 'bg-emerald-100 text-emerald-700' },
  OTHER_ESSENTIALS: { label: 'Other essentials', icon: Package, tint: 'bg-stone-100 text-stone-700' },
};

export const DEMO_ACCOUNTS = [
  { role: 'Requester', email: 'requester@relay.demo', password: 'Demo@123', hint: 'Posts needs' },
  { role: 'Volunteer (approved)', email: 'volunteer@relay.demo', password: 'Demo@123', hint: 'Accepts & fulfils' },
  { role: 'Volunteer (pending)', email: 'pending@relay.demo', password: 'Demo@123', hint: 'Awaiting verification' },
  { role: 'Admin', email: 'admin@relay.demo', password: 'Admin@123', hint: 'Verifies & moderates' },
];
