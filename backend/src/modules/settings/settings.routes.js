import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getSettings, updateSettings } from './settings.service.js';

const router = Router();
router.use(requireAuth);

function serialize(row) {
  return {
    durations: row.durations,
    late_fee_per_minute: Number(row.late_fee_per_minute),
    center_name: row.center_name,
    tagline: row.tagline,
    primary_color: row.primary_color,
    currency: row.currency,
    wa_templates: row.wa_templates,
    payments_enabled: row.payments_enabled,
  };
}

const langText = z.object({ ar: z.string().optional(), en: z.string().optional() });
const updateSchema = z.object({
  durations: z.array(z.object({ min: z.number().int().positive(), price: z.number().nonnegative() })).optional(),
  late_fee_per_minute: z.number().nonnegative().optional(),
  center_name: z.string().min(1).optional(),
  tagline: z.string().optional(),
  primary_color: z.string().optional(),
  currency: z.string().optional(),
  wa_templates: z.object({ welcome: langText, warn_5: langText, time_up: langText }).partial().optional(),
  payments_enabled: z.boolean().optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  res.json({ settings: serialize(await getSettings(req.user.tenantId)) });
}));

router.put('/', requireRole('manager'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ settings: serialize(await updateSettings(req.user.tenantId, req.body)) });
}));

export default router;
