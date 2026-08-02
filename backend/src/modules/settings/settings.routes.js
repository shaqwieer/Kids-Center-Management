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
    terms_url: row.terms_url,
    booking_config: row.booking_config,
    reviews_enabled: row.reviews_enabled,
    review_delay_minutes: row.review_delay_minutes,
    guardian_extend_enabled: row.guardian_extend_enabled,
    guardian_extend_minutes: row.guardian_extend_minutes,
    default_lang: row.default_lang || 'ar',
  };
}

const langText = z.object({ ar: z.string().optional(), en: z.string().optional() });

// Party/workshop pricing + slot config. Slots are "HH:MM" strings in Riyadh time.
const bookingKind = z.object({
  enabled: z.boolean(),
  base_price: z.number().nonnegative(),
  price_per_child: z.number().nonnegative(),
  min_children: z.number().int().positive(),
  max_children: z.number().int().positive(),
  duration_minutes: z.number().int().positive(),
  slots: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  lead_hours: z.number().int().nonnegative(),
}).partial();

const updateSchema = z.object({
  durations: z.array(z.object({ min: z.number().int().positive(), price: z.number().nonnegative() })).optional(),
  late_fee_per_minute: z.number().nonnegative().optional(),
  center_name: z.string().min(1).optional(),
  tagline: z.string().optional(),
  primary_color: z.string().optional(),
  currency: z.string().optional(),
  wa_templates: z.object({
    welcome: langText,
    warn_5: langText,
    time_up: langText,
    review: langText,
    booking_confirmed: langText,
  }).partial().optional(),
  payments_enabled: z.boolean().optional(),
  terms_url: z.string().url().max(500).nullable().optional().or(z.literal('')),
  booking_config: z.object({
    party: bookingKind.optional(),
    workshop: bookingKind.optional(),
    themes: z.array(z.object({ key: z.string(), ar: z.string(), en: z.string() })).optional(),
    foods: z.array(z.object({
      key: z.string(), ar: z.string(), en: z.string(), price_per_child: z.number().nonnegative(),
    })).optional(),
  }).optional(),
  reviews_enabled: z.boolean().optional(),
  review_delay_minutes: z.number().int().nonnegative().max(10080).optional(),
  guardian_extend_enabled: z.boolean().optional(),
  guardian_extend_minutes: z.number().int().positive().max(600).optional(),
  default_lang: z.enum(['ar', 'en']).optional(),
});

router.get('/', asyncHandler(async (req, res) => {
  res.json({ settings: serialize(await getSettings(req.user.tenantId)) });
}));

router.put('/', requireRole('manager'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ settings: serialize(await updateSettings(req.user.tenantId, req.body)) });
}));

export default router;
