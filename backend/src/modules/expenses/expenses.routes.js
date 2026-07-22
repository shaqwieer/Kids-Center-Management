import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/http.js';
import { EXPENSE_CATEGORIES, createExpense, deleteExpense, listExpenses, updateExpense } from './expenses.service.js';

const router = Router();
router.use(requireAuth);
const expenseSchema = z.object({
  title: z.string().trim().min(2).max(160), category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive().max(9999999999.99), incurred_at: z.coerce.date(),
  notes: z.string().max(2000).optional().nullable(),
});
router.get('/', asyncHandler(async (req, res) => {
  const start = req.query.start ? new Date(req.query.start) : undefined;
  const end = req.query.end ? new Date(req.query.end) : undefined;
  res.json({ expenses: await listExpenses(req.user.tenantId, { start, end }) });
}));
router.post('/', requireRole('manager'), validate(expenseSchema), asyncHandler(async (req, res) => {
  res.status(201).json({ expense: await createExpense(req.user.tenantId, req.user.id, req.body) });
}));
router.put('/:id', requireRole('manager'), validate(expenseSchema.partial()), asyncHandler(async (req, res) => {
  res.json({ expense: await updateExpense(req.user.tenantId, req.params.id, req.body) });
}));
router.delete('/:id', requireRole('manager'), asyncHandler(async (req, res) => {
  await deleteExpense(req.user.tenantId, req.params.id);
  res.status(204).end();
}));
export default router;
