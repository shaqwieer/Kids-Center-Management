/** Staff-side review rollup. Submitting a review is public (see public.routes). */
import { Router } from 'express';
import { asyncHandler } from '../../utils/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { reviewSummary } from './reviews.service.js';

const router = Router();
router.use(requireAuth);

router.get('/summary', asyncHandler(async (req, res) => {
  res.json(await reviewSummary(req.user.tenantId, req.query.period || 'month'));
}));

export default router;
