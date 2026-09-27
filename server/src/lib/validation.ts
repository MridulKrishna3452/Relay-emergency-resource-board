import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES, VERIFICATION_STATUSES } from './constants';

const trimmed = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const phoneSchema = z
  .string({ required_error: 'Phone is required.' })
  .trim()
  .refine((v) => /^\+?[0-9\s-]{10,18}$/.test(v) && v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13, {
    message: 'Enter a valid phone number (10-13 digits).',
  });

const lat = z.coerce.number({ invalid_type_error: 'Latitude must be a number.' }).min(-90, 'Invalid latitude.').max(90, 'Invalid latitude.');
const lng = z.coerce.number({ invalid_type_error: 'Longitude must be a number.' }).min(-180, 'Invalid longitude.').max(180, 'Invalid longitude.');

const optionalCoord = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

const pairedCoords = <T extends { lat?: number; lng?: number }>(val: T, ctx: z.RefinementCtx) => {
  if ((val.lat === undefined) !== (val.lng === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [val.lat === undefined ? 'lat' : 'lng'], message: 'Provide both latitude and longitude, or neither.' });
  }
};

export const registerSchema = z
  .object({
    name: trimmed(2, 80, 'Name'),
    email: z.string({ required_error: 'Email is required.' }).trim().toLowerCase().email('Enter a valid email address.'),
    phone: phoneSchema,
    password: z
      .string({ required_error: 'Password is required.' })
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password must be at most 72 characters.')
      .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Password must include a letter and a number.'),
    role: z.enum(['REQUESTER', 'VOLUNTEER'], {
      errorMap: () => ({ message: 'Choose whether you need help or want to volunteer.' }),
    }),
    city: trimmed(2, 60, 'City'),
    area: trimmed(2, 60, 'Area'),
    lat: optionalCoord(lat),
    lng: optionalCoord(lng),
    idProofText: z.string().trim().max(200, 'ID proof must be at most 200 characters.').optional(),
    skills: z.string().trim().max(300, 'Skills must be at most 300 characters.').optional(),
    hasVehicle: z.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    pairedCoords(val, ctx);
    if (val.role === 'VOLUNTEER' && (!val.idProofText || val.idProofText.length < 3)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idProofText'], message: 'Volunteers must describe an ID proof (e.g. college ID / NGO name).' });
    }
  });

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required.' }).trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

const requestFields = {
  title: trimmed(5, 100, 'Title'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: `Category must be one of ${CATEGORIES.join(', ')}.` }) }),
  description: trimmed(10, 1000, 'Description'),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).int('Quantity must be a whole number.').min(1, 'Quantity must be at least 1.').max(100000, 'Quantity is too large.'),
  peopleAffected: z.coerce.number({ invalid_type_error: 'People affected must be a number.' }).int('People affected must be a whole number.').min(1, 'People affected must be at least 1.').max(1000000, 'People affected is too large.'),
  priority: z.enum(PRIORITIES, { errorMap: () => ({ message: `Priority must be one of ${PRIORITIES.join(', ')}.` }) }),
  city: trimmed(2, 60, 'City'),
  area: trimmed(2, 60, 'Area'),
  addressLine: trimmed(3, 200, 'Address'),
  lat: optionalCoord(lat).nullable(),
  lng: optionalCoord(lng).nullable(),
  contactPhone: phoneSchema,
};

export const createRequestSchema = z.object(requestFields).strict().superRefine((v, ctx) => pairedCoords({ lat: v.lat ?? undefined, lng: v.lng ?? undefined }, ctx));

export const updateRequestSchema = z
  .object(requestFields)
  .partial()
  .strict()
  .superRefine((v, ctx) => {
    if (Object.keys(v).length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nothing to update.' });
    if ('lat' in v || 'lng' in v) pairedCoords({ lat: v.lat ?? undefined, lng: v.lng ?? undefined }, ctx);
  });

const boolFlag = z
  .enum(['true', 'false', '1', '0'], { errorMap: () => ({ message: 'Must be true or false.' }) })
  .transform((v) => v === 'true' || v === '1')
  .optional();

/** Accepts `status=OPEN` or `status=OPEN,ACCEPTED`. */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const parts = v.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
      const bad = parts.filter((p) => !values.includes(p));
      if (bad.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${label}: ${bad.join(', ')}. Allowed: ${values.join(', ')}.` });
        return z.NEVER;
      }
      return parts as T[number][];
    });

export const listQuerySchema = z
  .object({
    status: csvEnum(STATUSES, 'status'),
    priority: csvEnum(PRIORITIES, 'priority'),
    category: csvEnum(CATEGORIES, 'category'),
    city: z.string().trim().max(60).optional(),
    area: z.string().trim().max(60).optional(),
    lat: optionalCoord(lat),
    lng: optionalCoord(lng),
    radiusKm: optionalCoord(z.coerce.number({ invalid_type_error: 'radiusKm must be a number.' }).min(0.1, 'radiusKm must be at least 0.1.').max(200, 'radiusKm must be at most 200.')),
    mine: boolFlag,
    assignedToMe: boolFlag,
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['priority', 'newest', 'distance']).optional(),
    page: z.coerce.number().int().min(1, 'page must be at least 1.').default(1),
    limit: z.coerce.number().int().min(1).max(100, 'limit must be at most 100.').default(20),
  })
  .superRefine((val, ctx) => {
    pairedCoords(val, ctx);
    if (val.radiusKm !== undefined && val.lat === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['radiusKm'], message: 'radiusKm requires lat and lng.' });
    }
  });

export const noteSchema = z
  .object({ note: z.string().trim().max(500, 'Note must be at most 500 characters.').optional() })
  .strict()
  .default({});

export const rejectSchema = z.object({
  note: trimmed(3, 500, 'A note explaining the rejection'),
});

export const flagSchema = z.object({ reason: trimmed(5, 300, 'Reason') }).strict();

export const volunteersQuerySchema = z.object({
  status: z.enum(VERIFICATION_STATUSES).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
