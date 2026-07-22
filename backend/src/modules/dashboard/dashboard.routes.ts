import { Router, type Request } from 'express';
import { authenticate } from '@middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '@middleware/rbac.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { ok } from '@utils/response';
import { dashboardService, type DashFilter } from './dashboard.service';

const router = Router();
router.use(authenticate);

// Parse the shared analytics filters from the query string.
function parseFilter(req: Request): DashFilter {
  const q = req.query;
  const toDate = (v: unknown) => {
    if (!v) return undefined;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return {
    dateFrom: toDate(q.dateFrom),
    dateTo: toDate(q.dateTo),
    eventName: q.eventName ? String(q.eventName) : undefined,
    country: q.country ? String(q.country) : undefined,
    teamId: q.teamId ? String(q.teamId) : undefined,
    userId: q.userId ? String(q.userId) : undefined,
  };
}

const dashView = requirePermission('dashboard.view');
const analyticsView = requireAnyPermission('analytics.view', 'dashboard.view');

router.get('/filters', dashView, asyncHandler(async (_req, res) => ok(res, await dashboardService.filters())));
router.get('/summary', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.summary(parseFilter(req)))));
router.get('/funnel', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.funnel(parseFilter(req)))));
router.get('/by-event', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.byEvent(parseFilter(req)))));
router.get('/by-source', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.bySource(parseFilter(req)))));
router.get('/by-country', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.byCountry(parseFilter(req)))));
router.get('/trends/daily', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.dailyTrend(parseFilter(req), Number(req.query.days) || 30))));
router.get('/trends/monthly', dashView, asyncHandler(async (req, res) => ok(res, await dashboardService.monthlyTrend(parseFilter(req), Number(req.query.months) || 12))));
router.get('/team-performance', analyticsView, asyncHandler(async (req, res) => ok(res, await dashboardService.teamPerformance(parseFilter(req)))));
router.get('/leaderboard', analyticsView, asyncHandler(async (req, res) => ok(res, (await dashboardService.teamPerformance(parseFilter(req))).slice(0, 10))));

export default router;
