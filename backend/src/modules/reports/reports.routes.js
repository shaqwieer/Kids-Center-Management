/**
 * Excel export. Manager-only: these workbooks carry every customer phone number
 * and the full financial picture, which is beyond reception's "الاطلاع" scope.
 */
import { Router } from 'express';
import { asyncHandler, ApiError } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { periodRange } from '../../utils/time.js';
import { REPORT_TYPES, buildReport } from './reports.service.js';

const router = Router();
router.use(requireAuth, requireRole('manager'));

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

router.get('/export', asyncHandler(async (req, res) => {
  const type = String(req.query.type || 'full');
  if (!REPORT_TYPES.includes(type)) {
    throw ApiError.badRequest('Unknown report type', { allowed: REPORT_TYPES });
  }

  const period = req.query.period || 'month';
  // An explicit start/end wins; otherwise fall back to the named period.
  const fallback = periodRange(period);
  const start = req.query.start ? new Date(req.query.start) : fallback.start;
  const end = req.query.end ? new Date(req.query.end) : fallback.end;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Invalid start or end date');
  }

  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const { buffer, filename } = await buildReport(req.user.tenantId, { type, start, end, lang, period });

  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}));

export default router;
