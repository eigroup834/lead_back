import { Router } from 'express';
import authRoutes from '@modules/auth/auth.routes';
import usersRoutes from '@modules/users/users.module';
import rolesRoutes from '@modules/roles/roles.module';
import departmentsRoutes from '@modules/departments/departments.module';
import leadsRoutes from '@modules/leads/leads.routes';
import historicalRoutes from '@modules/historical/historical.routes';
import externalRoutes from '@modules/external/external.routes';
import followupsRoutes from '@modules/followups/followups.module';
import dashboardRoutes from '@modules/dashboard/dashboard.routes';
import reportsRoutes from '@modules/reports/reports.routes';
import syncRoutes from '@modules/sync/sync.routes';
import notificationsRoutes from '@modules/notifications/notifications.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/roles', rolesRoutes);
router.use('/departments', departmentsRoutes);
router.use('/leads', leadsRoutes);
router.use('/historical', historicalRoutes);
router.use('/external-leads', externalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/sync', syncRoutes);
router.use('/notifications', notificationsRoutes);

router.use('/', followupsRoutes);

export default router;
