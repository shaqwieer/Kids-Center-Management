import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { summary } from './finance.service.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', asyncHandler(async (req, res) => {
  const period = ['today', 'week', 'month'].includes(req.query.period) ? req.query.period : 'month';
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  res.json({ finance: await summary(req.user.tenantId, period, lang) });
}));

export default router;
