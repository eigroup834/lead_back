import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { useAppSelector } from '@/store';
import { usePermissions } from '@/hooks/usePermissions';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAppSelector((s) => s.auth.accessToken);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function RequirePermission({ permission, children }: { permission?: string; children: JSX.Element }) {
  const { has } = usePermissions();
  if (!has(permission)) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>403 — Forbidden</Typography>
        <Typography color="text.secondary">You don't have permission to view this page.</Typography>
      </Box>
    );
  }
  return children;
}
