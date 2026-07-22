import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { summary } from './finance.service.js';

const router = Router();
// Reception's brief is "start/extend play, and look" — revenue, expenses and
// net profit are not part of what they look at.
router.use(requireAuth, requireRole('manager'));

router.get('/summary', asyncHandler(async (req, res) => {
  const period = ['today', 'week', 'month'].includes(req.query.period) ? req.query.period : 'month';
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  res.json({ finance: await summary(req.user.tenantId, period, lang) });
}));

export default router;
