/**
 * Staff-side booking management. Reception may LOOK (الاطلاع) — creating,
 * editing and settling payment are manager-only, matching the role brief.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  BOOKING_TYPES, availability, createBooking, getBooking, listBookings, updateBooking,
} from './bookings.service.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  type: z.enum(BOOKING_TYPES),
  guardian_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  children_count: z.coerce.number().int().positive().max(200),
  theme: z.string().max(40).optional().nullable(),
  food: z.string().max(40).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const updateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  paid_amount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(2000).optional().nullable(),
  theme: z.string().max(40).optional().nullable(),
  food: z.string().max(40).optional().nullable(),
});

router.get('/availability', asyncHandler(async (req, res) => {
  res.json(await availability(req.user.tenantId, {
    type: req.query.type || 'party',
    date: req.query.date,
  }));
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json({
    bookings: await listBookings(req.user.tenantId, {
      from: req.query.from ? new Date(req.query.from) : undefined,
      to: req.query.to ? new Date(req.query.to) : undefined,
      status: req.query.status,
      type: req.query.type,
    }),
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ booking: await getBooking(req.user.tenantId, req.params.id) });
}));

router.post('/', requireRole('manager'), validate(createSchema), asyncHandler(async (req, res) => {
  const booking = await createBooking(
    req.user.tenantId, req.user.tenantSlug, req.body, { userId: req.user.id },
  );
  res.status(201).json({ booking });
}));

router.put('/:id', requireRole('manager'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ booking: await updateBooking(req.user.tenantId, req.user.tenantSlug, req.params.id, req.body) });
}));

export default router;
