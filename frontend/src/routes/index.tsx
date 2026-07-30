import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from '@/layouts/AppLayout';
import { landingPath } from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { RequireAuth, RequirePermission } from './guards';

// Route-level code splitting.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/LeadsPage'));
const AddLeadPage = lazy(() => import('@/pages/AddLeadPage'));
const LeadDetailsPage = lazy(() => import('@/pages/LeadDetailsPage'));
const FollowupsPage = lazy(() => import('@/pages/FollowupsPage'));
const OtherLeadsPage = lazy(() => import('@/pages/OtherLeadsPage'));
const HistoricalPage = lazy(() => import('@/pages/HistoricalPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const RolesPage = lazy(() => import('@/pages/RolesPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

const Fallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
    <CircularProgress />
  </Box>
);

// "/" can't be a fixed redirect any more — the Dashboard is Super Admin only.
function LandingRedirect() {
  const { level } = usePermissions();
  return <Navigate to={landingPath(level)} replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<LandingRedirect />} />
          <Route path="dashboard" element={<RequirePermission permission="dashboard.view" maxLevel={1}><DashboardPage /></RequirePermission>} />
          <Route path="leads" element={<RequirePermission permission="lead.view" maxLevel={2}><LeadsPage /></RequirePermission>} />
          <Route path="leads/new" element={<RequirePermission permission="lead.create"><AddLeadPage /></RequirePermission>} />
          <Route path="leads/assigned" element={<RequirePermission permission="lead.view"><LeadsPage assignedOnly /></RequirePermission>} />
          <Route path="leads/:id" element={<RequirePermission permission="lead.view"><LeadDetailsPage /></RequirePermission>} />
          <Route path="followups" element={<RequirePermission permission="lead.view"><FollowupsPage /></RequirePermission>} />
          <Route path="other-leads" element={<RequirePermission permission="lead.view"><OtherLeadsPage /></RequirePermission>} />
          <Route path="historical" element={<RequirePermission permission="historical.view"><HistoricalPage /></RequirePermission>} />
          <Route path="analytics" element={<RequirePermission permission="analytics.view"><AnalyticsPage /></RequirePermission>} />
          <Route path="users" element={<RequirePermission permission="user.view"><UsersPage /></RequirePermission>} />
          <Route path="roles" element={<RequirePermission permission="role.manage"><RolesPage /></RequirePermission>} />
          <Route path="settings" element={<RequirePermission maxLevel={1}><SettingsPage /></RequirePermission>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
