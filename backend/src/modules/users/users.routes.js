import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/http.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  ROLES, listUsers, createUser, updateUser, deleteUser,
} from './users.service.js';

const router = Router();

// Staff accounts are managed by managers only.
router.use(requireAuth, requireRole('manager'));

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES).default('staff'),
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

router.get('/', asyncHandler(async (req, res) => {
  res.json({ users: await listUsers(req.user.tenantId) });
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ user: await createUser(req.user.tenantId, req.body) });
}));

router.put('/:id', validate(idSchema, 'params'), validate(updateSchema), asyncHandler(async (req, res) => {
  res.json({ user: await updateUser(req.user.tenantId, req.params.id, req.body) });
}));

router.delete('/:id', validate(idSchema, 'params'), asyncHandler(async (req, res) => {
  res.json(await deleteUser(req.user.tenantId, req.params.id, req.user.id));
}));

export default router;
