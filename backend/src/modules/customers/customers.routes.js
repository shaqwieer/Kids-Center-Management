import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  searchCustomers, getCustomerDetail, createCustomer, updateCustomer, lookupCustomer,
} from './customers.service.js';

const router = Router();
router.use(requireAuth);

const childSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  age: z.union([z.number(), z.string()]).optional().nullable(),
  gender: z.enum(['m', 'f']).optional().nullable(),
  birthdate: z.string().optional().nullable(),
  has_allergy: z.boolean().optional(),
  allergy_note: z.string().max(500).optional().nullable(),
});

const createSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(6),
  national_id: z.string().optional().nullable(),
  consent: z.boolean().optional(),
  // Which language her WhatsApp messages go out in. Omitted = centre default.
  lang: z.enum(['ar', 'en']).optional().nullable(),
  children: z.array(childSchema).default([]),
});

const updateSchema = createSchema.partial().extend({
  children: z.array(childSchema).optional(),
});

// `?date=YYYY-MM-DD` narrows the list to the guardians who visited that day.
router.get('/', asyncHandler(async (req, res) => {
  const { search, date } = req.query;
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    throw ApiError.badRequest('Invalid date', { date });
  }
  res.json({ customers: await searchCustomers(req.user.tenantId, search, date) });
}));

router.get('/lookup', asyncHandler(async (req, res) => {
  const customer = await lookupCustomer(req.user.tenantId, { qr: req.query.qr, phone: req.query.phone });
  res.json({ customer });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ customer: await getCustomerDetail(req.user.tenantId, req.params.id) });
}));

// Reception may search and open customer records (الاطلاع) but not rewrite them —
// families create and correct their own data through the public QR page.
router.post('/', requireRole('manager'), validate(createSchema), asyncHandler(async (req, res) => {
  const customer = await createCustomer(req.user.tenantId, req.body, { tenantSlug: req.user.tenantSlug });
  res.status(201).json({ customer });
}));

router.put('/:id', requireRole('manager'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ customer: await updateCustomer(req.user.tenantId, req.params.id, req.body) });
}));

export default router;
