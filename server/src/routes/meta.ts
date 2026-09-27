import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/errors';

export const metaRouter = Router();

metaRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/** Distinct cities and their areas (from requests and users) for filter dropdowns. */
metaRouter.get(
  '/meta/locations',
  asyncHandler(async (_req, res) => {
    const [reqLocs, userLocs] = await Promise.all([
      prisma.request.findMany({ distinct: ['city', 'area'], select: { city: true, area: true } }),
      prisma.user.findMany({ distinct: ['city', 'area'], select: { city: true, area: true } }),
    ]);
    const map = new Map<string, Set<string>>();
    for (const { city, area } of [...reqLocs, ...userLocs]) {
      if (!map.has(city)) map.set(city, new Set());
      map.get(city)!.add(area);
    }
    const cities = [...map.entries()]
      .map(([city, areas]) => ({ city, areas: [...areas].sort() }))
      .sort((a, b) => a.city.localeCompare(b.city));
    res.json({ cities });
  }),
);

/** Public counters for the landing page. */
metaRouter.get(
  '/meta/summary',
  asyncHandler(async (_req, res) => {
    const [openRequests, criticalOpen, verifiedVolunteers, fulfilled] = await Promise.all([
      prisma.request.count({ where: { status: 'OPEN' } }),
      prisma.request.count({ where: { status: 'OPEN', priority: 'CRITICAL' } }),
      prisma.user.count({ where: { role: 'VOLUNTEER', verificationStatus: 'APPROVED' } }),
      prisma.request.count({ where: { status: 'FULFILLED' } }),
    ]);
    res.json({ openRequests, criticalOpen, verifiedVolunteers, fulfilled });
  }),
);
