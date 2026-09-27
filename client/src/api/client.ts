import type {
  AdminStats, FlaggedRequest, HelpRequest, Locations, Paginated, RequestDetail, RequestInput, Summary, User, Volunteer,
} from './types';

/** Mirrors the server error shape: { error: { code, message, fields? } } */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${res.status}).`, err?.fields);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type ListParams = Partial<{
  status: string;
  priority: string;
  category: string;
  city: string;
  area: string;
  lat: number;
  lng: number;
  radiusKm: number;
  mine: boolean;
  assignedToMe: boolean;
  q: string;
  sort: 'priority' | 'newest' | 'distance';
  page: number;
  limit: number;
}>;

export function toQuery(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // auth
  me: () => request<{ user: User }>('GET', '/auth/me'),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/auth/login', { email, password }),
  register: (data: Record<string, unknown>) => request<{ user: User }>('POST', '/auth/register', data),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  // requests
  listRequests: (params: ListParams) => request<Paginated<HelpRequest>>('GET', `/requests${toQuery(params)}`),
  getRequest: (id: string, coords?: { lat: number; lng: number } | null) =>
    request<{ request: RequestDetail }>('GET', `/requests/${id}${toQuery(coords ?? {})}`),
  createRequest: (data: RequestInput) => request<{ request: HelpRequest }>('POST', '/requests', data),
  updateRequest: (id: string, data: Partial<RequestInput>) => request<{ request: HelpRequest }>('PATCH', `/requests/${id}`, data),
  transition: (id: string, action: 'accept' | 'start' | 'fulfil' | 'release' | 'cancel', note?: string) =>
    request<{ request: HelpRequest }>('POST', `/requests/${id}/${action}`, note ? { note } : {}),
  flag: (id: string, reason: string) => request<unknown>('POST', `/requests/${id}/flag`, { reason }),

  // admin
  volunteers: (status?: string) => request<{ volunteers: Volunteer[] }>('GET', `/admin/volunteers${toQuery({ status })}`),
  approve: (id: string, note?: string) => request<{ volunteer: User }>('POST', `/admin/volunteers/${id}/approve`, note ? { note } : {}),
  reject: (id: string, note: string) => request<{ volunteer: User }>('POST', `/admin/volunteers/${id}/reject`, { note }),
  stats: () => request<AdminStats>('GET', '/admin/stats'),
  flags: () => request<{ flagged: FlaggedRequest[] }>('GET', '/admin/flags'),
  dismissFlags: (requestId: string) => request<unknown>('POST', `/admin/flags/${requestId}/dismiss`),

  // meta
  locations: () => request<Locations>('GET', '/meta/locations'),
  summary: () => request<Summary>('GET', '/meta/summary'),
};
