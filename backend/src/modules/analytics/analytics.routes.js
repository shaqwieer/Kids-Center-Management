import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { insights } from './analytics.service.js';

const router = Router();
// Carries revenue by income source, so it sits on the manager side of the line.
router.use(requireAuth, requireRole('manager'));

router.get('/insights', asyncHandler(async (req, res) => {
  res.json(await insights(req.user.tenantId, {
    period: req.query.period || 'month',
    lang: req.query.lang === 'en' ? 'en' : 'ar',
    lookbackDays: Math.min(365, Math.max(7, Number(req.query.lookback_days) || 90)),
  }));
}));

export default router;
