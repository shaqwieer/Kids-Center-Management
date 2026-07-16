import { Router } from 'express';
import { asyncHandler, ApiError } from '../../utils/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { listBySession } from './notifications.service.js';
import { getSessionRow } from '../sessions/sessions.repo.js';

const router = Router();
router.use(requireAuth);

// Debug/inspection: notifications for a given session (tenant-scoped).
router.get('/', asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) throw ApiError.badRequest('session_id is required');
  const row = await getSessionRow(sessionId);
  if (!row || row.tenant_id !== req.user.tenantId) throw ApiError.notFound('Session not found');
  res.json({ notifications: await listBySession(sessionId) });
}));

export default router;
