/**
 * Post-visit review. When a session is checked out we mint a review row with an
 * opaque token and schedule a WhatsApp message carrying `/r/<token>`; the mother
 * answers "ما رأيك في الزيارة؟" and optionally "كيف نخدمك بشكل أفضل؟".
 *
 * The token is single-purpose and the page is idempotent: opening it twice shows
 * her own answer back rather than asking again.
 */
import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';
import { makeQrToken } from '../../utils/codes.js';
import { periodRange } from '../../utils/time.js';
import { getSettings } from '../settings/settings.service.js';

/**
 * Idempotent — `reviews.session_id` is unique, so a retried checkout reuses the
 * existing row instead of minting a second link for the same visit.
 */
export async function ensureReviewForSession(tenantId, sessionId, customerId) {
  const existing = await db('reviews').where({ session_id: sessionId }).first();
  if (existing) return existing;
  const [row] = await db('reviews').insert({
    tenant_id: tenantId,
    session_id: sessionId,
    customer_id: customerId || null,
    token: makeQrToken(),
  }).returning('*');
  return row;
}

export async function markReviewSent(reviewId) {
  await db('reviews').where({ id: reviewId }).update({ sent_at: db.fn.now() });
}

/** Public page payload — deliberately minimal, no phone/ID leakage. */
export async function getPublicReview(token) {
  const r = await db('reviews').where({ token }).first();
  if (!r) throw ApiError.notFound('Review link not found');
  const settings = await getSettings(r.tenant_id);

  let childName = null;
  if (r.session_id) {
    const row = await db('sessions as s')
      .join('children as ch', 'ch.id', 's.child_id')
      .where('s.id', r.session_id)
      .select('ch.name as child_name')
      .first();
    childName = row?.child_name || null;
  }

  return {
    token: r.token,
    center_name: settings.center_name,
    primary_color: settings.primary_color,
    child_name: childName,
    rating: r.rating,
    comment: r.comment,
    submitted: Boolean(r.submitted_at),
  };
}

export async function submitReview(token, { rating, comment }) {
  const r = await db('reviews').where({ token }).first();
  if (!r) throw ApiError.notFound('Review link not found');
  if (r.submitted_at) throw ApiError.badRequest('This review was already submitted');

  await db('reviews').where({ id: r.id }).update({
    rating: Number(rating),
    comment: comment ? String(comment).trim().slice(0, 2000) : null,
    submitted_at: db.fn.now(),
  });
  return { ok: true };
}

/** Manager-facing rollup: average, star distribution, response rate, comments. */
export async function reviewSummary(tenantId, period = 'month') {
  const { start, end } = periodRange(period);
  const rows = await db('reviews')
    .where({ tenant_id: tenantId })
    .andWhereBetween('created_at', [start, end]);

  const answered = rows.filter((r) => r.submitted_at && r.rating);
  const total = answered.reduce((s, r) => s + r.rating, 0);
  const distribution = [1, 2, 3, 4, 5].map((star) => ({
    star, count: answered.filter((r) => r.rating === star).length,
  }));

  const comments = await db('reviews')
    .where({ tenant_id: tenantId })
    .whereNotNull('submitted_at')
    .whereNotNull('comment')
    .orderBy('submitted_at', 'desc')
    .limit(20)
    .select('rating', 'comment', 'submitted_at');

  return {
    period,
    sent: rows.filter((r) => r.sent_at).length,
    answered: answered.length,
    response_rate: rows.length ? Math.round((answered.length / rows.length) * 100) : 0,
    average: answered.length ? Number((total / answered.length).toFixed(2)) : null,
    distribution,
    comments,
  };
}
