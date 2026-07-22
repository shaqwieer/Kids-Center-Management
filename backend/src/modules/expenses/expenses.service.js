import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';

export const EXPENSE_CATEGORIES = ['salaries', 'rent', 'supplies', 'utilities', 'marketing', 'maintenance', 'other'];
function view(row) { return { ...row, amount: Number(row.amount) }; }

export async function listExpenses(tenantId, { start, end } = {}) {
  const query = db('expenses as e').leftJoin('users as u', 'u.id', 'e.created_by')
    .where('e.tenant_id', tenantId).select('e.*', 'u.name as created_by_name').orderBy('e.incurred_at', 'desc');
  if (start) query.andWhere('e.incurred_at', '>=', start);
  if (end) query.andWhere('e.incurred_at', '<=', end);
  return (await query).map(view);
}
export async function getExpense(tenantId, id) {
  const row = await db('expenses').where({ id, tenant_id: tenantId }).first();
  if (!row) throw ApiError.notFound('Expense not found');
  return view(row);
}
export async function createExpense(tenantId, userId, data) {
  const [row] = await db('expenses').insert({
    tenant_id: tenantId, title: data.title.trim(), category: data.category, amount: data.amount,
    incurred_at: data.incurred_at, notes: data.notes?.trim() || null, created_by: userId,
  }).returning('*');
  return view(row);
}
export async function updateExpense(tenantId, id, data) {
  await getExpense(tenantId, id);
  const patch = { updated_at: db.fn.now() };
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.category !== undefined) patch.category = data.category;
  if (data.amount !== undefined) patch.amount = data.amount;
  if (data.incurred_at !== undefined) patch.incurred_at = data.incurred_at;
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
  const [row] = await db('expenses').where({ id, tenant_id: tenantId }).update(patch).returning('*');
  return view(row);
}
export async function deleteExpense(tenantId, id) {
  const count = await db('expenses').where({ id, tenant_id: tenantId }).del();
  if (!count) throw ApiError.notFound('Expense not found');
}
