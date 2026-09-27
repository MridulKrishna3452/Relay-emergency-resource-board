import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, asyncHandler, notFound } from '../lib/errors';
import { noteSchema, rejectSchema, volunteersQuerySchema } from '../lib/validation';
import { publicUser, requireRole } from '../middleware/auth';
import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants';

export const adminRouter = Router();
adminRouter.use(requireRole('ADMIN'));

adminRouter.get(
  '/volunteers',
  asyncHandler(async (req, res) => {
    const { status } = volunteersQuerySchema.parse(req.query);
    const volunteers = await prisma.user.findMany({
      where: { role: 'VOLUNTEER', ...(status ? { verificationStatus: status } : {}) },
      orderBy: { createdAt: 'asc' }, // oldest applications first
      include: { _count: { select: { assigned: true } } },
    });
    res.json({
      volunteers: volunteers.map(({ _count, ...v }) => ({ ...publicUser(v), assignedCount: _count.assigned })),
    });
  }),
);

async function setVerification(id: string, status: 'APPROVED' | 'REJECTED', note: string | undefined) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'VOLUNTEER') throw notFound('Volunteer not found.');
  if (user.verificationStatus === status) {
    throw new AppError(409, 'ALREADY_' + status, `This volunteer is already ${status.toLowerCase()}.`);
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { verificationStatus: status, verificationNote: note || null, verifiedAt: new Date() },
  });
  return publicUser(updated);
}

adminRouter.post(
  '/volunteers/:id/approve',
  asyncHandler(async (req, res) => {
    const { note } = noteSchema.parse(req.body ?? {});
    res.json({ volunteer: await setVerification(req.params.id, 'APPROVED', note) });
  }),
);

adminRouter.post(
  '/volunteers/:id/reject',
  asyncHandler(async (req, res) => {
    const { note } = rejectSchema.parse(req.body ?? {});
    res.json({ volunteer: await setVerification(req.params.id, 'REJECTED', note) });
  }),
);

const toCounts = <K extends string>(keys: readonly K[], rows: { key: string; count: number }[]) => {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;
  rows.forEach((r) => (out[r.key] = r.count));
  return out;
};

adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [byStatus, byPriority, byCategory, byCity, pending, approved, rejected, openFlagRows, fulfilled, openCritical, total] =
      await Promise.all([
        prisma.request.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.request.groupBy({ by: ['priority'], _count: { _all: true } }),
        prisma.request.groupBy({ by: ['category'], _count: { _all: true } }),
        prisma.request.groupBy({ by: ['city'], _count: { _all: true } }),
        prisma.user.count({ where: { role: 'VOLUNTEER', verificationStatus: 'PENDING' } }),
        prisma.user.count({ where: { role: 'VOLUNTEER', verificationStatus: 'APPROVED' } }),
        prisma.user.count({ where: { role: 'VOLUNTEER', verificationStatus: 'REJECTED' } }),
        prisma.flag.groupBy({ by: ['requestId'], where: { resolved: false } }),
        prisma.request.findMany({ where: { status: 'FULFILLED', fulfilledAt: { not: null } }, select: { createdAt: true, fulfilledAt: true } }),
        prisma.request.count({ where: { status: 'OPEN', priority: 'CRITICAL' } }),
        prisma.request.count(),
      ]);

    const avgFulfilHours = fulfilled.length
      ? fulfilled.reduce((sum, r) => sum + (r.fulfilledAt!.getTime() - r.createdAt.getTime()), 0) / fulfilled.length / 3_600_000
      : null;

    res.json({
      totalRequests: total,
      byStatus: toCounts(STATUSES, byStatus.map((r) => ({ key: r.status, count: r._count._all }))),
      byPriority: toCounts(PRIORITIES, byPriority.map((r) => ({ key: r.priority, count: r._count._all }))),
      byCategory: toCounts(CATEGORIES, byCategory.map((r) => ({ key: r.category, count: r._count._all }))),
      byCity: Object.fromEntries(byCity.sort((a, b) => b._count._all - a._count._all).map((r) => [r.city, r._count._all])),
      openCritical,
      volunteers: { pending, approved, rejected },
      pendingVerifications: pending,
      flaggedRequests: openFlagRows.length,
      avgFulfilHours: avgFulfilHours === null ? null : Math.round(avgFulfilHours * 10) / 10,
    });
  }),
);

/** Requests with unresolved reports, most-reported first. */
adminRouter.get(
  '/flags',
  asyncHandler(async (_req, res) => {
    const flags = await prisma.flag.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'asc' },
      include: {
        reportedBy: { select: { id: true, name: true, role: true } },
        request: { select: { id: true, title: true, status: true, priority: true, category: true, area: true, city: true, createdAt: true, requester: { select: { id: true, name: true } } } },
      },
    });
    const grouped = new Map<string, { request: (typeof flags)[number]['request']; reports: { id: string; reason: string; createdAt: Date; reportedBy: (typeof flags)[number]['reportedBy'] }[] }>();
    for (const f of flags) {
      const g = grouped.get(f.requestId) ?? { request: f.request, reports: [] };
      g.reports.push({ id: f.id, reason: f.reason, createdAt: f.createdAt, reportedBy: f.reportedBy });
      grouped.set(f.requestId, g);
    }
    res.json({ flagged: [...grouped.values()].sort((a, b) => b.reports.length - a.reports.length) });
  }),
);

/** Dismiss reports on a request that turned out to be genuine. */
adminRouter.post(
  '/flags/:requestId/dismiss',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.flag.updateMany({ where: { requestId: req.params.requestId, resolved: false }, data: { resolved: true } });
    if (count === 0) throw notFound('No open reports for this request.');
    res.json({ dismissed: count });
  }),
);
