import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { login, getMe } from './auth.service.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const result = await login(req.body.email, req.body.password);
  res.json(result);
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: await getMe(req.user.id) });
}));

export default router;
