import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { seedDatabase } from '../prisma/seed';

let app: Express;

async function login(email: string, password = 'Demo@123') {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}

const validRequest = {
  title: 'Food packets for 10 people',
  category: 'FOOD',
  description: 'Ten people stuck on the first floor, need dinner packets.',
  quantity: 10,
  peopleAffected: 10,
  priority: 'CRITICAL',
  city: 'Chennai',
  area: 'Velachery',
  addressLine: '4th Cross St, Vijaya Nagar',
  lat: 12.9815,
  lng: 80.218,
  contactPhone: '+91 90000 00011',
};

async function createOpenRequest(overrides: Partial<typeof validRequest> = {}) {
  const requester = await login('requester@relay.demo');
  const res = await requester.post('/api/requests').send({ ...validRequest, ...overrides });
  expect(res.status).toBe(201);
  return { requester, id: res.body.request.id as string };
}

beforeAll(() => {
  app = createApp();
});

beforeEach(async () => {
  await seedDatabase(prisma, { quiet: true });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth', () => {
  it('registers requesters as NOT_REQUIRED and volunteers as PENDING', async () => {
    const r = await request(app).post('/api/auth/register').send({
      name: 'New Requester', email: 'newreq@test.dev', phone: '9876543210', password: 'secret123',
      role: 'REQUESTER', city: 'Chennai', area: 'Adyar',
    });
    expect(r.status).toBe(201);
    expect(r.body.user.verificationStatus).toBe('NOT_REQUIRED');
    expect(r.body.user.passwordHash).toBeUndefined();

    const v = await request(app).post('/api/auth/register').send({
      name: 'New Vol', email: 'newvol@test.dev', phone: '9876543211', password: 'secret123',
      role: 'VOLUNTEER', city: 'Chennai', area: 'Adyar', idProofText: 'NSS volunteer ID',
    });
    expect(v.status).toBe(201);
    expect(v.body.user.verificationStatus).toBe('PENDING');
  });

  it('refuses self-registration as ADMIN and duplicate emails', async () => {
    const base = { name: 'X Person', phone: '9876543210', password: 'secret123', city: 'Chennai', area: 'Adyar' };
    const admin = await request(app).post('/api/auth/register').send({ ...base, email: 'a@test.dev', role: 'ADMIN' });
    expect(admin.status).toBe(400);
    expect(admin.body.error.fields.role).toBeDefined();

    const dup = await request(app).post('/api/auth/register').send({ ...base, email: 'requester@relay.demo', role: 'REQUESTER' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('requires an ID proof for volunteers', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'No Proof', email: 'np@test.dev', phone: '9876543210', password: 'secret123', role: 'VOLUNTEER', city: 'Chennai', area: 'Adyar',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.idProofText).toMatch(/ID proof/);
  });

  it('rejects bad credentials and anonymous access', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'requester@relay.demo', password: 'wrong' });
    expect(bad.status).toBe(401);
    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(401);
    const list = await request(app).get('/api/requests');
    expect(list.status).toBe(401);
  });

  it('accepts a Bearer token as well as the cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@relay.demo', password: 'Admin@123' });
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('ADMIN');
  });
});

describe('validation & errors', () => {
  it('returns field errors in the standard format', async () => {
    const requester = await login('requester@relay.demo');
    const res = await requester.post('/api/requests').send({ ...validRequest, quantity: 0, priority: 'URGENT', title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['quantity', 'priority', 'title']));
  });

  it('rejects half a coordinate pair and bad query params', async () => {
    const requester = await login('requester@relay.demo');
    const res = await requester.post('/api/requests').send({ ...validRequest, lng: undefined });
    expect(res.status).toBe(400);
    const q = await requester.get('/api/requests?radiusKm=5');
    expect(q.status).toBe(400);
    expect(q.body.error.fields.radiusKm).toBeDefined();
  });

  it('only requesters can post requests', async () => {
    const volunteer = await login('volunteer@relay.demo');
    const res = await volunteer.post('/api/requests').send(validRequest);
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown requests and routes', async () => {
    const requester = await login('requester@relay.demo');
    expect((await requester.get('/api/requests/does-not-exist')).status).toBe(404);
    expect((await requester.get('/api/nope')).body.error.code).toBe('NOT_FOUND');
  });
});

describe('listing, sorting and location filters', () => {
  it('sorts by priority (CRITICAL first) then oldest first', async () => {
    const requester = await login('requester@relay.demo');
    const res = await requester.get('/api/requests?limit=100');
    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const items = res.body.items as { priority: string; status: string; createdAt: string }[];
    const waiting = (s: string) => (s === 'OPEN' ? 0 : 1);
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1];
      const b = items[i];
      expect(rank[a.priority]).toBeLessThanOrEqual(rank[b.priority]);
      if (a.priority === b.priority) {
        // Still-unclaimed (OPEN) requests first, then oldest first.
        expect(waiting(a.status)).toBeLessThanOrEqual(waiting(b.status));
        if (waiting(a.status) === waiting(b.status)) {
          expect(new Date(a.createdAt).getTime()).toBeLessThanOrEqual(new Date(b.createdAt).getTime());
        }
      }
    }
  });

  it('a new CRITICAL request appears near the top of open requests', async () => {
    const { requester, id } = await createOpenRequest();
    const res = await requester.get('/api/requests?status=OPEN');
    const ids = res.body.items.map((i: { id: string }) => i.id);
    const firstNonCritical = res.body.items.findIndex((i: { priority: string }) => i.priority !== 'CRITICAL');
    expect(ids.indexOf(id)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(id)).toBeLessThan(firstNonCritical);
  });

  it('filters by radius using Haversine and returns distanceKm', async () => {
    const requester = await login('requester@relay.demo');
    const res = await requester.get('/api/requests?lat=12.9815&lng=80.218&radiusKm=3&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.distanceKm).toBeLessThanOrEqual(3);
    }
    // Kattankulathur (~20 km away) must not be included.
    expect(res.body.items.some((i: { area: string }) => i.area === 'Kattankulathur')).toBe(false);
  });

  it('filters by city and area case-insensitively, and by text', async () => {
    const requester = await login('requester@relay.demo');
    const res = await requester.get('/api/requests?city=tambaram&area=MUDICHUR&limit=100');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((i: { area: string }) => i.area === 'Mudichur')).toBe(true);
    const q = await requester.get('/api/requests?q=tarpaulin');
    expect(q.body.total).toBe(1);
  });

  it('a request posted without GPS still shows up in "near me" via its area', async () => {
    const { requester, id } = await createOpenRequest({ lat: undefined, lng: undefined, area: 'velachery' });
    const res = await requester.get('/api/requests?lat=12.9815&lng=80.218&radiusKm=2&status=OPEN');
    expect(res.body.items.some((i: { id: string }) => i.id === id)).toBe(true);
  });

  it('hides contact details from uninvolved users', async () => {
    const { id } = await createOpenRequest();
    const pending = await login('pending@relay.demo');
    const res = await pending.get(`/api/requests/${id}`);
    expect(res.body.request.contactPhone).toBeNull();
    expect(res.body.request.addressLine).toBeNull();
  });
});

describe('status transitions', () => {
  it('runs the full happy path and records every change in StatusHistory', async () => {
    const { requester, id } = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');

    expect((await volunteer.post(`/api/requests/${id}/accept`)).status).toBe(200);
    expect((await volunteer.post(`/api/requests/${id}/start`).send({ note: 'On the way' })).status).toBe(200);
    const done = await volunteer.post(`/api/requests/${id}/fulfil`);
    expect(done.status).toBe(200);
    expect(done.body.request.status).toBe('FULFILLED');
    expect(done.body.request.fulfilledAt).toBeTruthy();

    const detail = await requester.get(`/api/requests/${id}`);
    expect(detail.body.request.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'FULFILLED']);
    expect(detail.body.request.history[2].note).toBe('On the way');
    // Requester can now see the volunteer's contact details
    expect(detail.body.request.volunteer.phone).toBeTruthy();
  });

  it('lets the requester confirm fulfilment', async () => {
    const { requester, id } = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');
    await volunteer.post(`/api/requests/${id}/accept`);
    await volunteer.post(`/api/requests/${id}/start`);
    const res = await requester.post(`/api/requests/${id}/fulfil`);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('FULFILLED');
  });

  it('returns 409 for transitions that are not allowed', async () => {
    const { requester, id } = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');

    const startOpen = await volunteer.post(`/api/requests/${id}/start`);
    expect(startOpen.status).toBe(409);
    expect(startOpen.body.error.code).toBe('INVALID_TRANSITION');

    await volunteer.post(`/api/requests/${id}/accept`);
    expect((await volunteer.post(`/api/requests/${id}/fulfil`)).status).toBe(409); // ACCEPTED -> FULFILLED skips a step
    expect((await volunteer.post(`/api/requests/${id}/accept`)).status).toBe(409); // already accepted

    await volunteer.post(`/api/requests/${id}/start`);
    expect((await requester.post(`/api/requests/${id}/cancel`)).status).toBe(409); // IN_PROGRESS can't be cancelled
    expect((await volunteer.post(`/api/requests/${id}/release`)).status).toBe(409);
    await volunteer.post(`/api/requests/${id}/fulfil`);
    expect((await volunteer.post(`/api/requests/${id}/start`)).status).toBe(409); // FULFILLED is terminal
  });

  it('enforces who may perform each transition (403)', async () => {
    const { id } = await createOpenRequest();
    const pending = await login('pending@relay.demo');
    const requester2 = await login('irfan@relay.demo');
    const volunteer = await login('volunteer@relay.demo');
    const other = await login('divya@relay.demo');

    expect((await pending.post(`/api/requests/${id}/accept`)).status).toBe(403);
    expect((await (await login('vignesh@relay.demo')).post(`/api/requests/${id}/accept`)).status).toBe(403); // rejected volunteer
    expect((await requester2.post(`/api/requests/${id}/accept`)).status).toBe(403);
    expect((await requester2.post(`/api/requests/${id}/cancel`)).status).toBe(403); // not the owner

    await volunteer.post(`/api/requests/${id}/accept`);
    expect((await other.post(`/api/requests/${id}/start`)).status).toBe(403); // not assigned
    expect((await other.post(`/api/requests/${id}/release`)).status).toBe(403);
  });

  it('release returns the request to OPEN and clears the volunteer', async () => {
    const { id } = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');
    await volunteer.post(`/api/requests/${id}/accept`);
    const res = await volunteer.post(`/api/requests/${id}/release`).send({ note: 'Cannot make it' });
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('OPEN');
    expect(res.body.request.volunteerId).toBeNull();
    // someone else can now accept it
    const other = await login('divya@relay.demo');
    expect((await other.post(`/api/requests/${id}/accept`)).status).toBe(200);
  });

  it('owner and admin can cancel OPEN/ACCEPTED requests', async () => {
    const a = await createOpenRequest();
    expect((await a.requester.post(`/api/requests/${a.id}/cancel`).send({ note: 'Got help' })).body.request.status).toBe('CANCELLED');

    const b = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');
    await volunteer.post(`/api/requests/${b.id}/accept`);
    const admin = await login('admin@relay.demo', 'Admin@123');
    expect((await admin.post(`/api/requests/${b.id}/cancel`)).status).toBe(200);
  });

  it('prevents a double accept: exactly one of two simultaneous accepts wins', async () => {
    const { id } = await createOpenRequest();
    const v1 = await login('volunteer@relay.demo');
    const v2 = await login('divya@relay.demo');
    const v3 = await login('arjun@relay.demo');

    const results = await Promise.all([
      v1.post(`/api/requests/${id}/accept`),
      v2.post(`/api/requests/${id}/accept`),
      v3.post(`/api/requests/${id}/accept`),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409]);

    const winner = results.find((r) => r.status === 200)!;
    const row = await prisma.request.findUniqueOrThrow({ where: { id } });
    expect(row.volunteerId).toBe(winner.body.request.volunteerId);
    const accepts = await prisma.statusHistory.count({ where: { requestId: id, toStatus: 'ACCEPTED' } });
    expect(accepts).toBe(1);
  });
});

describe('editing', () => {
  it('owner can edit only while OPEN', async () => {
    const { requester, id } = await createOpenRequest();
    const ok = await requester.patch(`/api/requests/${id}`).send({ quantity: 12 });
    expect(ok.status).toBe(200);
    expect(ok.body.request.quantity).toBe(12);

    const other = await login('irfan@relay.demo');
    expect((await other.patch(`/api/requests/${id}`).send({ quantity: 5 })).status).toBe(403);

    const volunteer = await login('volunteer@relay.demo');
    await volunteer.post(`/api/requests/${id}/accept`);
    const late = await requester.patch(`/api/requests/${id}`).send({ quantity: 20 });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('NOT_EDITABLE');
  });

  it('rejects editing status directly', async () => {
    const { requester, id } = await createOpenRequest();
    const res = await requester.patch(`/api/requests/${id}`).send({ status: 'FULFILLED' });
    expect(res.status).toBe(400);
  });
});

describe('admin verification workflow', () => {
  it('approving a pending volunteer lets them accept immediately', async () => {
    const { id } = await createOpenRequest();
    const admin = await login('admin@relay.demo', 'Admin@123');
    const pendingList = await admin.get('/api/admin/volunteers?status=PENDING');
    const priya = pendingList.body.volunteers.find((v: { email: string }) => v.email === 'pending@relay.demo');
    expect(priya).toBeTruthy();

    const pending = await login('pending@relay.demo');
    expect((await pending.post(`/api/requests/${id}/accept`)).status).toBe(403);

    const approve = await admin.post(`/api/admin/volunteers/${priya.id}/approve`).send({ note: 'College ID verified' });
    expect(approve.status).toBe(200);
    expect(approve.body.volunteer.verificationStatus).toBe('APPROVED');
    expect(approve.body.volunteer.verificationNote).toBe('College ID verified');

    // Same session, no re-login required
    expect((await pending.post(`/api/requests/${id}/accept`)).status).toBe(200);
  });

  it('rejecting requires a note; non-admins are blocked', async () => {
    const admin = await login('admin@relay.demo', 'Admin@123');
    const list = await admin.get('/api/admin/volunteers?status=PENDING');
    const target = list.body.volunteers[0];
    expect((await admin.post(`/api/admin/volunteers/${target.id}/reject`).send({})).status).toBe(400);
    const ok = await admin.post(`/api/admin/volunteers/${target.id}/reject`).send({ note: 'ID could not be verified' });
    expect(ok.body.volunteer.verificationStatus).toBe('REJECTED');

    const volunteer = await login('volunteer@relay.demo');
    expect((await volunteer.get('/api/admin/stats')).status).toBe(403);
  });

  it('returns stats', async () => {
    const admin = await login('admin@relay.demo', 'Admin@123');
    const res = await admin.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBe(25);
    expect(res.body.byStatus.OPEN).toBeGreaterThan(0);
    expect(res.body.pendingVerifications).toBe(2);
    expect(res.body.avgFulfilHours).toBeGreaterThan(0);
    expect(res.body.byCity.Chennai).toBeGreaterThan(0);
  });
});

describe('flags', () => {
  it('users can report a request once; admins see and act on it', async () => {
    const { id } = await createOpenRequest();
    const volunteer = await login('volunteer@relay.demo');
    const owner = await login('requester@relay.demo');

    expect((await volunteer.post(`/api/requests/${id}/flag`).send({ reason: 'Looks fake to me' })).status).toBe(201);
    expect((await volunteer.post(`/api/requests/${id}/flag`).send({ reason: 'Looks fake to me' })).status).toBe(409);
    expect((await owner.post(`/api/requests/${id}/flag`).send({ reason: 'my own one' })).status).toBe(403);

    const admin = await login('admin@relay.demo', 'Admin@123');
    const flags = await admin.get('/api/admin/flags');
    expect(flags.body.flagged.some((f: { request: { id: string } }) => f.request.id === id)).toBe(true);

    await admin.post(`/api/requests/${id}/cancel`).send({ note: 'Removed: reported as fake' });
    const after = await admin.get('/api/admin/flags');
    expect(after.body.flagged.some((f: { request: { id: string } }) => f.request.id === id)).toBe(false);
  });
});
