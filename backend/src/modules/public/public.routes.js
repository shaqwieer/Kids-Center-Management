/** Public (no-auth) endpoints: QR registration + customer card lookup. */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ApiError } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { publicRegister, getPublicCard } from '../customers/customers.service.js';
import { getDefaultTenant } from '../tenants/tenants.service.js';

const router = Router();

const childSchema = z.object({
  name: z.string().min(1),
  age: z.union([z.number(), z.string()]).optional().nullable(),
  gender: z.enum(['m', 'f']).optional().nullable(),
});

const registerSchema = z.object({
  full_name: z.string().min(2),
  phone: z.string().min(6),
  national_id: z.string().optional().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: 'consent is required' }) }),
  children: z.array(childSchema).min(1),
});

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const tenant = await getDefaultTenant();
  const result = await publicRegister(tenant.id, req.body);
  res.status(result.already_registered ? 200 : 201).json({ customer: result });
}));

router.get('/customers/:qr_token', asyncHandler(async (req, res) => {
  if (!req.params.qr_token) throw ApiError.badRequest('qr_token required');
  res.json({ customer: await getPublicCard(req.params.qr_token) });
}));

export default router;
