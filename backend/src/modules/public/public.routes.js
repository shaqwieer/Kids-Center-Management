/**
 * Public (no-auth) endpoints. Everything here is reachable by anyone with the
 * link, so each route is either write-rate-limited or scoped to a single opaque
 * token that only ever exposes that one record.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { publicRegister, getPublicCard } from '../customers/customers.service.js';
import { getDefaultTenant } from '../tenants/tenants.service.js';
import { getSettings } from '../settings/settings.service.js';
import {
  BOOKING_TYPES, availability, createBooking, getPublicBooking, publicBookingConfig, quote,
} from '../bookings/bookings.service.js';
import { getPublicReview, submitReview } from '../reviews/reviews.service.js';
import { getGuestSession, guardianExtend } from '../sessions/sessions.service.js';

const router = Router();

const childSchema = z.object({
  name: z.string().min(1),
  age: z.union([z.number(), z.string()]).optional().nullable(),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')),
  gender: z.enum(['m', 'f']).optional().nullable(),
  has_allergy: z.boolean().optional(),
  allergy_note: z.string().max(500).optional().nullable(),
});

const registerSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(6),
  national_id: z.string().optional().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: 'consent is required' }) }),
  // The language the form was filled in, so her messages match it. The page
  // sends its current locale; anything else falls back to the centre default.
  lang: z.enum(['ar', 'en']).optional().nullable(),
  children: z.array(childSchema).min(1),
});

// ---- registration ----------------------------------------------------------

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 8 }),
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const tenant = await getDefaultTenant();
    const result = await publicRegister(tenant.id, req.body, { tenantSlug: tenant.slug });
    res.status(result.already_registered ? 200 : 201).json({ customer: result });
  }),
);

router.get('/customers/:qr_token', asyncHandler(async (req, res) => {
  if (!req.params.qr_token) throw ApiError.badRequest('qr_token required');
  res.json({ customer: await getPublicCard(req.params.qr_token) });
}));

/** Branding + the terms link the consent checkbox points at. */
router.get('/center', asyncHandler(async (req, res) => {
  const tenant = await getDefaultTenant();
  const s = await getSettings(tenant.id);
  res.json({
    center: {
      center_name: s.center_name,
      tagline: s.tagline,
      primary_color: s.primary_color,
      currency: s.currency,
      terms_url: s.terms_url,
    },
  });
}));

// ---- party / workshop booking ---------------------------------------------

const bookingSchema = z.object({
  type: z.enum(BOOKING_TYPES),
  guardian_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  children_count: z.coerce.number().int().positive().max(200),
  theme: z.string().max(40).optional().nullable(),
  food: z.string().max(40).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: 'consent is required' }) }),
});

router.get('/booking/config', asyncHandler(async (req, res) => {
  const tenant = await getDefaultTenant();
  res.json({ config: await publicBookingConfig(tenant.id) });
}));

router.get('/booking/availability', asyncHandler(async (req, res) => {
  const tenant = await getDefaultTenant();
  const type = String(req.query.type || 'party');
  if (!BOOKING_TYPES.includes(type)) throw ApiError.badRequest('Unknown booking type', { type });
  if (!req.query.date) throw ApiError.badRequest('date is required (YYYY-MM-DD)');
  res.json(await availability(tenant.id, { type, date: String(req.query.date) }));
}));

/** Live price preview as she changes the child count / catering. */
router.get('/booking/quote', asyncHandler(async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await getSettings(tenant.id);
  const type = String(req.query.type || 'party');
  if (!BOOKING_TYPES.includes(type)) throw ApiError.badRequest('Unknown booking type', { type });
  res.json({
    quote: quote(settings, {
      type,
      children_count: Number(req.query.children_count) || 0,
      food: req.query.food,
    }),
  });
}));

router.post(
  '/booking',
  rateLimit({ windowMs: 60_000, max: 6 }),
  validate(bookingSchema),
  asyncHandler(async (req, res) => {
    const tenant = await getDefaultTenant();
    const booking = await createBooking(tenant.id, tenant.slug, req.body);
    res.status(201).json({ booking });
  }),
);

router.get('/booking/:token', asyncHandler(async (req, res) => {
  res.json({ booking: await getPublicBooking(req.params.token) });
}));

// ---- post-visit review -----------------------------------------------------

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

router.get('/review/:token', asyncHandler(async (req, res) => {
  res.json({ review: await getPublicReview(req.params.token) });
}));

router.post(
  '/review/:token',
  rateLimit({ windowMs: 60_000, max: 10 }),
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    res.json(await submitReview(req.params.token, req.body));
  }),
);

// ---- guardian self-extend --------------------------------------------------

router.get('/session/:token', asyncHandler(async (req, res) => {
  res.json({ session: await getGuestSession(req.params.token) });
}));

router.post(
  '/session/:token/extend',
  rateLimit({ windowMs: 60_000, max: 5 }),
  asyncHandler(async (req, res) => {
    res.json({ session: await guardianExtend(req.params.token) });
  }),
);

export default router;
