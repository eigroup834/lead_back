import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Breadcrumbs, Chip, Divider, Drawer, IconButton, Link, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography,
} from '@mui/material';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import HubIcon from '@mui/icons-material/Hub';
import { NAV_ITEMS, landingPath } from '@/constants';
import { SIDEBAR, GRADIENTS } from '@/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleMode, toggleSidebar } from '@/features/ui/uiSlice';
import { logout } from '@/features/auth/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { api } from '@/app/api';
import NotificationsBell from '@/components/NotificationsBell';
import { PageSkeleton } from '@/components/Skeletons';

const FULL = 250;
const MINI = 72;

const CRUMB_LABELS: Record<string, string> = {
  leads: 'Leads',
  assigned: 'Assigned',
  new: 'Add Lead',
  followups: 'Follow-ups',
  'other-leads': 'Brochure Data',
  historical: 'Historical Data',
  analytics: 'Dashboard',
  users: 'Users',
  roles: 'Roles',
  settings: 'Settings',
  dashboard: 'Overview',
};

export default function AppLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { has, user, level } = usePermissions();
  const mode = useAppSelector((s) => s.ui.mode);
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const [doLogout] = useLogoutMutation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const items = NAV_ITEMS.filter((i) => has(i.permission) && (i.maxLevel === undefined || level <= i.maxLevel));
  const width = open ? FULL : MINI;
  const crumbs = location.pathname.split('/').filter(Boolean);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const handleLogout = async () => {
    try { await doLogout().unwrap(); } catch { }
    dispatch(logout());
    dispatch(api.util.resetApiState());
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        color="inherit"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 0.5, pr: { xs: 1.5, sm: 2.5 } }}>
          <Box
            sx={{
              width: { xs: 0, sm: width - 24 },
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              transition: 'width .2s',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
                bgcolor: 'primary.main', color: '#fff',
                display: 'grid', placeItems: 'center',
              }}
            >
              <HubIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontWeight: 750, fontSize: '1rem', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
              Lead CRM
            </Typography>
          </Box>

          <Tooltip title={open ? 'Collapse menu' : 'Expand menu'}>
            <IconButton size="small" onClick={() => dispatch(toggleSidebar())}>
              {open ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton size="small" onClick={() => dispatch(toggleMode())}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <NotificationsBell />

          <Tooltip title="Account">
            <IconButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ ml: 0.5, p: 0.5 }}>
              <Avatar sx={{ width: 34, height: 34, background: GRADIENTS.brand, color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(79,70,229,0.35)' }}>
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchor}
            open={!!anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 232, mt: 0.5 } } }}
          >
            <Box sx={{ px: 2, py: 1.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 650 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                {user?.email}
              </Typography>
              {user?.roles?.length ? (
                <Chip size="small" label={user.roles[0]} sx={{ mt: 1 }} />
              ) : null}
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ mt: 0.5 }}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width, flexShrink: 0,
          '& .MuiDrawer-paper': {
            width, boxSizing: 'border-box', overflowX: 'hidden',
            transition: 'width .26s cubic-bezier(.4,0,.2,1)',
            bgcolor: SIDEBAR.bg,
            backgroundImage: 'radial-gradient(120% 60% at 0% 0%, rgba(99,102,241,0.16) 0%, rgba(99,102,241,0) 55%)',
            color: SIDEBAR.text,
            borderRight: 'none',
            boxShadow: '1px 0 0 rgba(148,163,184,0.10)',
          },
        }}
      >
        <Toolbar />
        <List sx={{ px: 1.25, py: 2 }} component="nav">
          {open && (
            <Typography
              variant="caption"
              sx={{ px: 1.75, pb: 1.25, display: 'block', color: 'rgba(148,163,184,0.55)', fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.1em' }}
            >
              WORKSPACE
            </Typography>
          )}
          {items.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Tooltip key={item.path} title={open ? '' : item.label} placement="right">
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mb: 0.375, minHeight: 44, px: 1.5, borderRadius: 2.5,
                    color: SIDEBAR.text,
                    position: 'relative',
                    overflow: 'hidden',
                    justifyContent: open ? 'flex-start' : 'center',
                    transition: 'background .18s ease, color .18s ease',
                    '& .MuiListItemIcon-root': { color: 'inherit', transition: 'color .18s ease, transform .18s ease' },
                    '&:hover': {
                      bgcolor: SIDEBAR.bgHover,
                      color: SIDEBAR.textActive,
                      '& .MuiListItemIcon-root': { transform: 'translateX(1px)' },
                    },
                    '&.Mui-selected': {
                      bgcolor: SIDEBAR.bgActive,
                      color: SIDEBAR.textActive,
                      '&:hover': { bgcolor: SIDEBAR.bgActive },
                      '& .MuiListItemIcon-root': { color: '#c7d2fe' },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0, top: 8, bottom: 8,
                        width: 3, borderRadius: '0 3px 3px 0',
                        background: SIDEBAR.activeBar,
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, mr: open ? 1.75 : 0 }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  {open && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: '0.8438rem', fontWeight: active ? 650 : 500, letterSpacing: '-0.005em', noWrap: true }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>

        <Box sx={{ flex: 1 }} />
        {open && (
          <Box sx={{ p: 2, borderTop: `1px solid ${SIDEBAR.border}` }}>
            <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.6)' }}>
              Exhibitor Lead Management
            </Typography>
          </Box>
        )}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1, minWidth: 0, pb: 5,
          px: { xs: 1.5, sm: 2.5, md: 3.5 },
          width: `calc(100% - ${width}px)`,
          '& > .MuiBox-root': { animation: 'fadeInUp .28s cubic-bezier(.4,0,.2,1)' },
        }}
      >
        <Toolbar />
        <Breadcrumbs sx={{ mt: 2.5, mb: 2 }}>
          <Link component={RouterLink} to={landingPath(level)} underline="hover" color="inherit">Home</Link>
          {crumbs.map((c, i) => {
            const to = '/' + crumbs.slice(0, i + 1).join('/');
            const label = CRUMB_LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
            return i === crumbs.length - 1
              ? <Typography key={to} color="text.primary" sx={{ fontWeight: 600 }}>{label}</Typography>
              : <Link key={to} component={RouterLink} to={to} underline="hover" color="inherit">{label}</Link>;
          })}
        </Breadcrumbs>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
}
