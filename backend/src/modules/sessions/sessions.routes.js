import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  getActiveSessions, getSessionDTO, startSessions, addTime, endSession,
} from './sessions.service.js';

const router = Router();
router.use(requireAuth);

const startSchema = z.object({
  customer_id: z.string().uuid(),
  child_ids: z.array(z.string().uuid()).min(1),
  duration_minutes: z.number().int().positive(),
});

const addTimeSchema = z.object({
  minutes: z.number().int().positive(),
});

router.get('/', asyncHandler(async (req, res) => {
  res.json({ sessions: await getActiveSessions(req.user.tenantId) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ session: await getSessionDTO(req.user.tenantId, req.params.id) });
}));

router.post('/', validate(startSchema), asyncHandler(async (req, res) => {
  const sessions = await startSessions({
    tenantId: req.user.tenantId,
    tenantSlug: req.user.tenantSlug,
    userId: req.user.id,
    customerId: req.body.customer_id,
    childIds: req.body.child_ids,
    durationMinutes: req.body.duration_minutes,
  });
  res.status(201).json({ sessions });
}));

router.post('/:id/add-time', validate(addTimeSchema), asyncHandler(async (req, res) => {
  const session = await addTime({
    tenantId: req.user.tenantId,
    tenantSlug: req.user.tenantSlug,
    sessionId: req.params.id,
    minutes: req.body.minutes,
  });
  res.json({ session });
}));

router.post('/:id/end', asyncHandler(async (req, res) => {
  const session = await endSession({
    tenantId: req.user.tenantId,
    tenantSlug: req.user.tenantSlug,
    sessionId: req.params.id,
  });
  res.json({ session });
}));

export default router;
