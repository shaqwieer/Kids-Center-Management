import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/http.js';
import {
  createVouchers, listVouchers, lookupVoucher, voidVoucher,
} from './vouchers.service.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  duration_minutes: z.number().int().positive(),
  sold_price: z.coerce.number().min(0).max(9999999999.99).optional(),
  quantity: z.number().int().min(1).max(50).optional(),
  recipient_name: z.string().trim().max(120).optional().nullable(),
  buyer_name: z.string().trim().max(120).optional().nullable(),
  buyer_phone: z.string().trim().max(32).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')),
});

// Reception scans a voucher at Start Session, so lookup is open to staff.
router.get('/lookup', asyncHandler(async (req, res) => {
  res.json({ voucher: await lookupVoucher(req.user.tenantId, req.query.code) });
}));

// Issuing, listing and cancelling are the manager's — vouchers are money.
router.get('/', requireRole('manager'), asyncHandler(async (req, res) => {
  res.json({ vouchers: await listVouchers(req.user.tenantId, { state: req.query.state }) });
}));

router.post('/', requireRole('manager'), validate(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ vouchers: await createVouchers(req.user.tenantId, req.user.id, req.body) });
}));

router.post('/:id/void', requireRole('manager'), asyncHandler(async (req, res) => {
  res.json({ voucher: await voidVoucher(req.user.tenantId, req.params.id) });
}));

export default router;
