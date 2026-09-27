import type { Prisma, Request as RequestRow, User } from '@prisma/client';
import { prisma } from './prisma';
import { AppError, conflict, forbidden, notFound } from './errors';
import { PRIORITY_RANK, type Status } from './constants';

export type Action = 'accept' | 'start' | 'fulfil' | 'release' | 'cancel';

type RequestWithPeople = RequestRow & {
  requester?: Pick<User, 'id' | 'name' | 'phone'> | null;
  volunteer?: Pick<User, 'id' | 'name' | 'phone'> | null;
};

/**
 * The state machine. Every allowed transition is listed here; anything else is a 409.
 */
export const TRANSITIONS: Record<Action, { from: Status[]; to: Status; verb: string }> = {
  accept: { from: ['OPEN'], to: 'ACCEPTED', verb: 'accept' },
  start: { from: ['ACCEPTED'], to: 'IN_PROGRESS', verb: 'start' },
  fulfil: { from: ['IN_PROGRESS'], to: 'FULFILLED', verb: 'mark as fulfilled' },
  release: { from: ['ACCEPTED'], to: 'OPEN', verb: 'release' },
  cancel: { from: ['OPEN', 'ACCEPTED'], to: 'CANCELLED', verb: 'cancel' },
};

const isOwner = (r: RequestRow, u?: User) => !!u && r.requesterId === u.id;
const isAssigned = (r: RequestRow, u?: User) => !!u && !!r.volunteerId && r.volunteerId === u.id;
const isAdmin = (u?: User) => u?.role === 'ADMIN';
const isApprovedVolunteer = (u?: User) => u?.role === 'VOLUNTEER' && u.verificationStatus === 'APPROVED';

/** Who may perform an action, ignoring the current status. */
function isAuthorized(action: Action, r: RequestRow, u?: User): boolean {
  switch (action) {
    case 'accept':
      return isApprovedVolunteer(u);
    case 'start':
    case 'release':
      return isAssigned(r, u);
    case 'fulfil':
      return isAssigned(r, u) || isOwner(r, u);
    case 'cancel':
      return isOwner(r, u) || isAdmin(u);
  }
}

/** Actions the viewer can take right now. The UI shows buttons only for these. */
export function allowedActions(r: RequestRow, u?: User) {
  const actions: string[] = [];
  (Object.keys(TRANSITIONS) as Action[]).forEach((a) => {
    if (TRANSITIONS[a].from.includes(r.status as Status) && isAuthorized(a, r, u)) actions.push(a);
  });
  if (r.status === 'OPEN' && isOwner(r, u)) actions.push('edit');
  const finished = r.status === 'FULFILLED' || r.status === 'CANCELLED';
  if (u && !finished && !isOwner(r, u) && !isAssigned(r, u) && !isAdmin(u)) actions.push('flag');
  return actions;
}

/** Exact address and phone numbers are shown only to people involved in the request. */
export function canSeeContact(r: RequestRow, u?: User) {
  return isOwner(r, u) || isAssigned(r, u) || isAdmin(u);
}

export function serializeRequest(r: RequestWithPeople, viewer?: User, distanceKm?: number) {
  const privileged = canSeeContact(r, viewer);
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    quantity: r.quantity,
    peopleAffected: r.peopleAffected,
    priority: r.priority,
    status: r.status,
    city: r.city,
    area: r.area,
    addressLine: privileged ? r.addressLine : null,
    // Uninvolved viewers get coordinates rounded to ~100 m (distance is computed from exact values).
    lat: r.lat == null ? null : privileged ? r.lat : Math.round(r.lat * 1000) / 1000,
    lng: r.lng == null ? null : privileged ? r.lng : Math.round(r.lng * 1000) / 1000,
    contactPhone: privileged ? r.contactPhone : null,
    requesterId: r.requesterId,
    volunteerId: r.volunteerId,
    requester: r.requester ? { id: r.requester.id, name: r.requester.name, phone: privileged ? r.requester.phone : undefined } : undefined,
    volunteer: r.volunteer ? { id: r.volunteer.id, name: r.volunteer.name, phone: privileged ? r.volunteer.phone : undefined } : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    fulfilledAt: r.fulfilledAt,
    distanceKm: distanceKm === undefined ? undefined : Math.round(distanceKm * 10) / 10,
    contactVisible: privileged,
    allowedActions: allowedActions(r, viewer),
  };
}

/**
 * Default sort: priority (CRITICAL first), then oldest first so nobody waits forever.
 * Within the same priority, requests still waiting for a volunteer (OPEN) come
 * before ones that already have someone on them.
 */
export function comparePriorityThenOldest(a: RequestRow, b: RequestRow) {
  const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
  if (p !== 0) return p;
  const needsHelp = (r: RequestRow) => (r.status === 'OPEN' ? 0 : 1);
  const n = needsHelp(a) - needsHelp(b);
  if (n !== 0) return n;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Applies a status transition atomically.
 * The UPDATE is conditional on the status (and assignee) we read, so if two
 * volunteers accept at the same moment only one UPDATE matches a row; the
 * other gets a 409. The history row is written in the same transaction.
 */
export async function transitionRequest(id: string, action: Action, actor: User, note?: string) {
  const rule = TRANSITIONS[action];
  const current = await prisma.request.findUnique({ where: { id } });
  if (!current) throw notFound('Request not found.');

  if (!rule.from.includes(current.status as Status)) {
    const hint =
      action === 'accept' && current.status !== 'OPEN'
        ? current.status === 'ACCEPTED' || current.status === 'IN_PROGRESS'
          ? ' Another volunteer has already accepted it.'
          : ''
        : '';
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot ${rule.verb} a request that is ${current.status}. Allowed only from ${rule.from.join(' or ')}.${hint}`,
    );
  }
  if (!isAuthorized(action, current, actor)) {
    const messages: Record<Action, string> = {
      accept: 'Only approved volunteers can accept requests.',
      start: 'Only the volunteer assigned to this request can start it.',
      release: 'Only the volunteer assigned to this request can release it.',
      fulfil: 'Only the assigned volunteer or the requester can mark this as fulfilled.',
      cancel: 'Only the requester who posted this or an admin can cancel it.',
    };
    throw forbidden(messages[action]);
  }

  const data: Prisma.RequestUpdateManyMutationInput & { volunteerId?: string | null } = { status: rule.to };
  if (action === 'accept') data.volunteerId = actor.id;
  if (action === 'release') data.volunteerId = null;
  if (action === 'fulfil') data.fulfilledAt = new Date();

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.request.updateMany({
      where: { id, status: current.status, volunteerId: current.volunteerId },
      data,
    });
    if (count === 0) {
      throw conflict(
        action === 'accept'
          ? 'Someone else accepted this request a moment ago.'
          : 'This request was just updated by someone else. Please refresh and try again.',
        'CONCURRENT_UPDATE',
      );
    }
    await tx.statusHistory.create({
      data: { requestId: id, fromStatus: current.status, toStatus: rule.to, changedById: actor.id, note: note || null },
    });
    if (action === 'cancel' && isAdmin(actor)) {
      // Admin cancelling (e.g. a fake request) resolves any open reports on it.
      await tx.flag.updateMany({ where: { requestId: id, resolved: false }, data: { resolved: true } });
    }
    return tx.request.findUniqueOrThrow({
      where: { id },
      include: { requester: { select: { id: true, name: true, phone: true } }, volunteer: { select: { id: true, name: true, phone: true } } },
    });
  });
}
