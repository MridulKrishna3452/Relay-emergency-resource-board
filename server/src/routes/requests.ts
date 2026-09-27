import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler, conflict, forbidden, notFound } from '../lib/errors';
import { createRequestSchema, flagSchema, listQuerySchema, noteSchema, updateRequestSchema } from '../lib/validation';
import { requireApprovedVolunteer, requireAuth, requireRole } from '../middleware/auth';
import { boundingBox, haversineKm } from '../lib/geo';
import { comparePriorityThenOldest, serializeRequest, transitionRequest, type Action } from '../lib/requestService';

export const requestsRouter = Router();

const peopleInclude = {
  requester: { select: { id: true, name: true, phone: true } },
  volunteer: { select: { id: true, name: true, phone: true } },
} as const;

requestsRouter.use(requireAuth);

/**
 * If a requester can't share GPS, approximate the location as the centre of
 * known points in the same city + area so "near me" search still finds it.
 */
async function approximateAreaCoords(city: string, area: string) {
  const where = { lat: { not: null }, lng: { not: null } };
  const select = { city: true, area: true, lat: true, lng: true };
  const [reqs, users] = await Promise.all([
    prisma.request.findMany({ where, select }),
    prisma.user.findMany({ where, select }),
  ]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const points = [...reqs, ...users].filter((p) => same(p.city, city) && same(p.area, area));
  if (!points.length) return null;
  const avg = (k: 'lat' | 'lng') => Number((points.reduce((s, p) => s + (p[k] ?? 0), 0) / points.length).toFixed(6));
  return { lat: avg('lat'), lng: avg('lng') };
}

/**
 * GET /api/requests
 * Enum/ownership filters and the radius bounding box run in the DB; the exact
 * Haversine distance, case-insensitive city/area/text matching, sorting and
 * pagination run in memory (fine for a city-scale board; see README).
 */
requestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const user = req.user!;

    const where: Prisma.RequestWhereInput = {};
    if (q.status) where.status = { in: q.status };
    if (q.priority) where.priority = { in: q.priority };
    if (q.category) where.category = { in: q.category };
    if (q.mine) where.requesterId = user.id;
    if (q.assignedToMe) where.volunteerId = user.id;

    const hasPoint = q.lat !== undefined && q.lng !== undefined;
    if (hasPoint && q.radiusKm !== undefined) {
      const box = boundingBox(q.lat!, q.lng!, q.radiusKm);
      where.lat = { gte: box.minLat, lte: box.maxLat };
      where.lng = { gte: box.minLng, lte: box.maxLng };
    }

    const rows = await prisma.request.findMany({ where, include: peopleInclude });

    const city = q.city?.toLowerCase();
    const area = q.area?.toLowerCase();
    const text = q.q?.toLowerCase();

    let items = rows
      .filter((r) => !city || r.city.toLowerCase() === city)
      .filter((r) => !area || r.area.toLowerCase() === area)
      .filter(
        (r) =>
          !text ||
          [r.title, r.description, r.area, r.city, r.addressLine].some((f) => f.toLowerCase().includes(text)),
      )
      .map((r) => ({
        row: r,
        distance: hasPoint && r.lat != null && r.lng != null ? haversineKm(q.lat!, q.lng!, r.lat, r.lng) : undefined,
      }));

    if (hasPoint && q.radiusKm !== undefined) {
      items = items.filter((i) => i.distance !== undefined && i.distance <= q.radiusKm!);
    }

    const sort = q.sort ?? 'priority';
    items.sort((a, b) => {
      if (sort === 'newest') return b.row.createdAt.getTime() - a.row.createdAt.getTime();
      if (sort === 'distance' && a.distance !== undefined && b.distance !== undefined && a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return comparePriorityThenOldest(a.row, b.row);
    });

    const total = items.length;
    const start = (q.page - 1) * q.limit;
    const page = items.slice(start, start + q.limit);

    res.json({
      items: page.map((i) => serializeRequest(i.row, user, i.distance)),
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    });
  }),
);

requestsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const r = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: {
        ...peopleInclude,
        history: {
          orderBy: { createdAt: 'asc' },
          include: { changedBy: { select: { id: true, name: true, role: true } } },
        },
        flags: { select: { reportedById: true, resolved: true } },
      },
    });
    if (!r) throw notFound('Request not found.');
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const distance =
      lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && r.lat != null && r.lng != null
        ? haversineKm(lat, lng, r.lat, r.lng)
        : undefined;

    res.json({
      request: {
        ...serializeRequest(r, user, distance),
        history: r.history.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          note: h.note,
          createdAt: h.createdAt,
          changedBy: h.changedBy,
        })),
        viewerHasFlagged: r.flags.some((f) => f.reportedById === user.id),
        openFlagCount: user.role === 'ADMIN' ? r.flags.filter((f) => !f.resolved).length : undefined,
      },
    });
  }),
);

requestsRouter.post(
  '/',
  requireRole('REQUESTER'),
  asyncHandler(async (req, res) => {
    const data = createRequestSchema.parse(req.body);
    const user = req.user!;
    const coords = data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : await approximateAreaCoords(data.city, data.area);
    const created = await prisma.request.create({
      data: {
        ...data,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        status: 'OPEN',
        requesterId: user.id,
        history: { create: { fromStatus: null, toStatus: 'OPEN', changedById: user.id } },
      },
      include: peopleInclude,
    });
    res.status(201).json({ request: serializeRequest(created, user) });
  }),
);

requestsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = updateRequestSchema.parse(req.body);
    const user = req.user!;
    const existing = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Request not found.');
    if (existing.requesterId !== user.id) throw forbidden('Only the requester who posted this can edit it.');
    if (existing.status !== 'OPEN') {
      throw new AppError(409, 'NOT_EDITABLE', `Requests can only be edited while OPEN. This one is ${existing.status}.`);
    }
    // Conditional update so an edit can't race with a volunteer accepting.
    const { count } = await prisma.request.updateMany({
      where: { id: existing.id, status: 'OPEN', requesterId: user.id },
      data,
    });
    if (count === 0) throw conflict('This request was accepted while you were editing it, so it can no longer be changed.', 'NOT_EDITABLE');
    const updated = await prisma.request.findUniqueOrThrow({ where: { id: existing.id }, include: peopleInclude });
    res.json({ request: serializeRequest(updated, user) });
  }),
);

const transitionRoute = (action: Action) =>
  asyncHandler(async (req, res) => {
    const { note } = noteSchema.parse(req.body ?? {});
    const updated = await transitionRequest(req.params.id, action, req.user!, note);
    res.json({ request: serializeRequest(updated, req.user!) });
  });

requestsRouter.post('/:id/accept', requireApprovedVolunteer, transitionRoute('accept'));
requestsRouter.post('/:id/start', requireRole('VOLUNTEER'), transitionRoute('start'));
requestsRouter.post('/:id/fulfil', requireRole('VOLUNTEER', 'REQUESTER'), transitionRoute('fulfil'));
requestsRouter.post('/:id/release', requireRole('VOLUNTEER'), transitionRoute('release'));
requestsRouter.post('/:id/cancel', requireRole('REQUESTER', 'ADMIN'), transitionRoute('cancel'));

requestsRouter.post(
  '/:id/flag',
  asyncHandler(async (req, res) => {
    const { reason } = flagSchema.parse(req.body);
    const user = req.user!;
    const r = await prisma.request.findUnique({ where: { id: req.params.id } });
    if (!r) throw notFound('Request not found.');
    if (r.requesterId === user.id) throw forbidden('You cannot report your own request.');
    if (user.role === 'ADMIN') throw forbidden('Admins can cancel requests directly instead of reporting them.');
    const existing = await prisma.flag.findUnique({ where: { requestId_reportedById: { requestId: r.id, reportedById: user.id } } });
    if (existing) throw conflict('You have already reported this request.', 'ALREADY_FLAGGED');
    const flag = await prisma.flag.create({ data: { requestId: r.id, reportedById: user.id, reason } });
    res.status(201).json({ flag });
  }),
);
