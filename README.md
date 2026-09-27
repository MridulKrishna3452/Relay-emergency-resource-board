# Relay 🛟

**A community resource board for urgent _non-medical_ support during local emergencies** (floods, cyclones, power outages).

People in need post requests for **water, food packets, transport or temporary shelter**. **Verified volunteers** accept and fulfil them. **Admins** verify volunteers and moderate requests. Everything is tracked on a timeline from _posted_ to _fulfilled_.

> Seeded with realistic Chennai-region data (Velachery, Tambaram, T. Nagar, Adyar, Guindy, Porur, Kattankulathur…).

---

## Quick start (3 commands)

Requires **Node.js 18+** (tested on Node 22). No database server needed: it uses SQLite.

```bash
npm install      # installs client + server, generates Prisma client, creates server/.env
npm run seed     # creates the SQLite DB (migrations) and loads demo data
npm run dev      # API on http://localhost:4000, web app on http://localhost:5173
```

Open **http://localhost:5173** and use the **one-click demo login** buttons on the login page.

Run the API test suite (28 tests, including the double-accept race): `npm test`

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@relay.demo` | `Admin@123` |
| Requester | `requester@relay.demo` | `Demo@123` |
| Volunteer (approved) | `volunteer@relay.demo` | `Demo@123` |
| Volunteer (**pending**) | `pending@relay.demo` | `Demo@123` |

More seeded users (all `Demo@123`): requesters `irfan@`, `kavitha@`, `suresh@`, `anitha@`; approved volunteers `divya@`, `arjun@`; pending `rahul@`; rejected `vignesh@` (all `@relay.demo`).

To reset the demo data at any time, run `npm run seed` again. See **[DEMO.md](DEMO.md)** for the presenter's script.

---

## The 4 mandatory features and how Relay meets them

| # | Requirement | Where / how |
|---|---|---|
| 1 | **Request priority** CRITICAL / HIGH / MEDIUM / LOW | Chosen on the request form with plain-language guidance ("Risk to safety right now", …). Coloured badges and card borders: **red / orange / amber / slate**. The default sort everywhere is **priority, then oldest first**, so nobody waits forever. Within the same priority, still-unclaimed (OPEN) requests come before ones that already have a volunteer. |
| 2 | **Status tracking** OPEN → ACCEPTED → IN_PROGRESS → FULFILLED (+ CANCELLED) | A server-side state machine (`server/src/lib/requestService.ts`). Every change writes a `StatusHistory` row, rendered as a **timeline** and progress stepper on the request page. Illegal transitions return **409** with a clear message. Accepting is **atomic**, so two volunteers can't both accept (conditional `UPDATE … WHERE status='OPEN'`, verified by a concurrent test). |
| 3 | **Location-based filtering** city/area + "near me" radius | Board filters for city, area, category, priority, status and text search. **Near me** uses `navigator.geolocation` with a 1–50 km radius slider. The server does a bounding-box prefilter, then exact **Haversine** distance, and returns `distanceKm` on each result. If location is denied, it falls back to the user's saved area coordinates, or to their city. Requests posted without GPS get the approximate centre of their area, so they still show up in radius searches. |
| 4 | **Admin verification workflow** | Volunteers register as **PENDING** (ID-proof text required). Admins see a queue, **approve** (optional note) or **reject** (note required), and can revoke later. Only **APPROVED** volunteers can accept, enforced by `requireApprovedVolunteer` middleware on the server. Pending and rejected volunteers can browse read-only, with a banner explaining their status. Approval takes effect immediately with no re-login, because the user is loaded fresh from the DB on each request. |

### Everything else

- **Role-based workflow**: REQUESTER / VOLUNTEER / ADMIN, with protected routes on the client and `requireAuth` / `requireRole` on the server. The server computes an `allowedActions` list for every request, and the UI shows **only** the buttons you're allowed to use. The server re-checks every action anyway.
- **Validation**: Zod on every body and query; key rules are mirrored in the forms with inline messages. A consistent error shape: `{ error: { code, message, fields? } }` with 400 / 401 / 403 / 404 / 409.
- **Privacy**: exact address and phone numbers are visible only to the requester, the assigned volunteer and admins. Other viewers get coordinates rounded to about 100 m.
- **Reporting fake requests**: any uninvolved user can flag a request once. Admins see reported requests and can cancel them (which resolves the reports) or dismiss the reports.
- **Dashboards**: *My requests*, grouped by status (requester). *Assigned to me* + *Nearby open requests* with a radius picker (volunteer). A verification queue, stats cards, Recharts charts by status / priority / category / city, average time to fulfil, and flagged requests (admin).
- **UX**: responsive (cards on mobile, grid on desktop, checked at 375 px), large tap targets (44–52 px), visible focus rings, labelled controls, skip link, toasts, skeleton loaders, empty and error states, a 404 page, and an error boundary.

### Stretch goals (all done)

- 📶 **PWA / offline**: installable (manifest + service worker via `vite-plugin-pwa`, with an **Install app** button when the browser offers it). The app shell and last-loaded board and request data are cached (network-first), so the board **stays readable offline**. **New requests made offline are queued** in `localStorage` and **synced automatically when you reconnect**. The UI shows an offline banner, a "Save & post when online" button, and a "Waiting to be posted" list. *Note: the service worker runs in production builds (`npm run build && npm run preview -w client`), not in `npm run dev`. The offline queue works in both.*
- 🗺️ **Map view**: Leaflet + OpenStreetMap tiles (no API key), with pins coloured by priority, a radius circle for "near me", and the same filters as the board.
- 🔄 **Live board**: auto-refreshes every 15 s with a "Live · updated Xs ago" indicator, and pops a toast when a **new CRITICAL request** appears.

---

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces (`/client`, `/server`) + `concurrently` |
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, React Router 6, TanStack Query 5, Recharts, React-Leaflet, lucide-react, react-hot-toast, vite-plugin-pwa |
| Backend | Node.js, Express 4, TypeScript (run with `tsx`) |
| Database | Prisma 5 ORM + SQLite (file DB) |
| Auth | JWT in an **httpOnly cookie** (also accepts `Authorization: Bearer`), bcrypt password hashing |
| Validation | Zod (server), mirrored rules in forms (client) |
| Tests | Vitest + Supertest against a separate `test.db` |

### Switching to Postgres

The schema avoids SQLite-only features, and enum-like fields are `String`s validated by Zod, so it's portable:

1. In `server/prisma/schema.prisma` set `provider = "postgresql"`.
2. Set `DATABASE_URL="postgresql://user:pass@host:5432/relay"` in `server/.env`.
3. Delete `server/prisma/migrations` (they contain SQLite SQL), then run `npx prisma migrate dev --name init` in `/server`, followed by `npm run seed`.

---

## REST API

All endpoints live under `/api`. Errors are always `{ error: { code, message, fields? } }`.

**Auth**
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | role `REQUESTER` → `NOT_REQUIRED`; `VOLUNTEER` → `PENDING` (needs `idProofText`). `ADMIN` is rejected. |
| POST | `/auth/login` | sets the httpOnly cookie and also returns `token` |
| POST | `/auth/logout` | |
| GET | `/auth/me` | |

**Requests** (login required)
| Method | Path | Who |
|---|---|---|
| GET | `/requests` | any. Query: `status`, `priority`, `category` (comma-separated allowed), `city`, `area`, `lat`, `lng`, `radiusKm`, `mine=true`, `assignedToMe=true`, `q`, `sort=priority\|newest\|distance`, `page`, `limit` |
| GET | `/requests/:id` | any. Includes the `history` timeline, requester/volunteer info, `allowedActions` |
| POST | `/requests` | requester |
| PATCH | `/requests/:id` | owner, only while OPEN |
| POST | `/requests/:id/accept` | approved volunteer (OPEN → ACCEPTED, atomic) |
| POST | `/requests/:id/start` | assigned volunteer (ACCEPTED → IN_PROGRESS) |
| POST | `/requests/:id/fulfil` | assigned volunteer or requester (IN_PROGRESS → FULFILLED) |
| POST | `/requests/:id/release` | assigned volunteer (ACCEPTED → OPEN) |
| POST | `/requests/:id/cancel` | owner or admin (OPEN/ACCEPTED → CANCELLED) |
| POST | `/requests/:id/flag` | any uninvolved user, once per request |

Transition endpoints accept an optional `{ "note": "…" }`, which is stored on the timeline.

**Admin** (admin only)
| Method | Path |
|---|---|
| GET | `/admin/volunteers?status=PENDING\|APPROVED\|REJECTED` |
| POST | `/admin/volunteers/:id/approve` `{ note? }` |
| POST | `/admin/volunteers/:id/reject` `{ note }` (required) |
| GET | `/admin/stats` (counts by status / priority / category / city, pending verifications, flagged count, average hours to fulfil) |
| GET | `/admin/flags` (open reports grouped by request) |
| POST | `/admin/flags/:requestId/dismiss` |

To cancel a flagged request, admins use `POST /requests/:id/cancel`, which also resolves its reports.

**Meta** (public)
| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/meta/locations` (distinct cities → areas, for dropdowns) |
| GET | `/meta/summary` (landing-page counters) |

Quick curl check:
```bash
curl -c jar.txt -H "Content-Type: application/json" -d "{\"email\":\"volunteer@relay.demo\",\"password\":\"Demo@123\"}" http://localhost:4000/api/auth/login
curl -b jar.txt "http://localhost:4000/api/requests?lat=12.9815&lng=80.218&radiusKm=3&status=OPEN"
```

---

## Folder structure

```
relay/
├─ package.json            # workspaces + concurrently (dev, seed, test, build)
├─ scripts/setup-env.cjs   # copies server/.env.example -> server/.env on install
├─ DEMO.md                 # presenter script
├─ server/
│  ├─ .env.example
│  ├─ prisma/
│  │  ├─ schema.prisma     # User, Request, StatusHistory, Flag
│  │  ├─ migrations/
│  │  └─ seed.ts           # Chennai demo data (12 users, 25 requests + history, flags)
│  ├─ src/
│  │  ├─ app.ts            # express app (used by index.ts and the tests)
│  │  ├─ index.ts
│  │  ├─ middleware/auth.ts        # attachUser, requireAuth, requireRole, requireApprovedVolunteer
│  │  ├─ lib/requestService.ts     # state machine, atomic transitions, allowedActions, privacy
│  │  ├─ lib/validation.ts         # all Zod schemas
│  │  ├─ lib/geo.ts                # Haversine + bounding box
│  │  ├─ lib/errors.ts             # AppError + error handler
│  │  └─ routes/ auth.ts requests.ts admin.ts meta.ts
│  └─ tests/api.test.ts    # Vitest + Supertest
└─ client/
   ├─ vite.config.ts       # /api proxy + PWA config
   ├─ public/              # icons
   └─ src/
      ├─ api/              # typed fetch client + types
      ├─ auth/             # AuthContext, ProtectedRoute
      ├─ components/       # Layout, FilterBar, RequestCard, Timeline, Badges, Modal, banners…
      ├─ lib/              # constants, formatting, validation, geolocation, offline queue, board hooks
      └─ pages/            # Landing, Login, Register, Board, MapPage, RequestDetail, RequestForm,
                           # RequesterDashboard, VolunteerDashboard, AdminDashboard, NotFound
```

---

## Design decisions and assumptions

- **Enums as strings**: SQLite has no native enums in Prisma, so allowed values live in `server/src/lib/constants.ts` and are enforced by Zod. The same code works on Postgres.
- **Atomic accept**: `updateMany({ where: { id, status: 'OPEN', volunteerId: null }, … })` inside a transaction with the history insert. If `count === 0`, someone else won, and the loser gets a 409. The same guard protects every transition and the owner's edit (so an edit can't race an accept).
- **Server decides permissions**: every request carries `allowedActions`, so the UI never guesses. Pending volunteers see a *disabled* Accept button with an explanation, rather than having it silently disappear.
- **Filtering**: enum and ownership filters plus a lat/lng bounding box run in SQL. Exact Haversine, case-insensitive city/area/text matching, sorting and pagination run in memory. That's ample for a city-scale board. At national scale, move to Postgres + PostGIS (`ST_DWithin`) and full-text search.
- **Admins** only come from the seed. Admins can't post requests (they moderate), and they cancel rather than flag.
- **Cancelling** is allowed only from OPEN / ACCEPTED, per the spec. Once a volunteer is en route (IN_PROGRESS), it's completed by fulfilment.
- **Env var** `API_PORT` (not `PORT`) is used for the API so it never collides with tools that set `PORT` for the frontend.
- The footer lists India emergency numbers (108 medical / 100 police / 1070 disaster) because Relay is explicitly non-medical.

## Future scope

- SMS / WhatsApp notifications to nearby volunteers for CRITICAL requests (Twilio / Gupshup), plus an SMS-only posting flow for feature phones
- Server-Sent Events instead of 15 s polling; push notifications through the service worker
- Postgres + PostGIS for spatial queries at scale; a heat-map of unmet needs for authorities
- Photo upload for ID proof and delivery confirmation; volunteer ratings and badges
- Tamil / Hindi localisation (i18n) and voice input for low-literacy users
- Request de-duplication (same area + category + phone), and rate limiting / CAPTCHA on sign-up
- Integration with official relief-camp registries and NGO inventory
