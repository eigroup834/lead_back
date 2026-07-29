import { useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Breadcrumbs, Divider, Drawer, IconButton, Link, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { NAV_ITEMS } from '@/constants';
import { GRADIENTS } from '@/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleMode, toggleSidebar } from '@/features/ui/uiSlice';
import { logout } from '@/features/auth/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { api } from '@/app/api';
import NotificationsBell from '@/components/NotificationsBell';

const FULL = 248;
const MINI = 72;

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

  const handleLogout = async () => {
    try { await doLogout().unwrap(); } catch { /* ignore */ }
    dispatch(logout());
    dispatch(api.util.resetApiState()); // drop the previous user's cached data
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: GRADIENTS.dark,
          color: '#e2e8f0',
          borderBottom: 'none',
          zIndex: (t) => t.zIndex.drawer + 1,
          '& .MuiIconButton-root': { color: '#e2e8f0' },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => dispatch(toggleSidebar())}><MenuIcon /></IconButton>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>Lead CRM</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton onClick={() => dispatch(toggleMode())}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <NotificationsBell />
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff', fontSize: 14 }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem disabled>{user?.email}</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}><ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width, flexShrink: 0,
          '& .MuiDrawer-paper': {
            width, boxSizing: 'border-box', overflowX: 'hidden', transition: 'width .2s',
            background: GRADIENTS.dark,
            color: '#e2e8f0',
            borderRight: 'none',
          },
        }}
      >
        <Toolbar />
        <List sx={{ pt: 3, pb: 1 }}>
          {items.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <ListItemButton
                key={item.path}
                selected={active}
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1, borderRadius: 2, mb: 0.5, minHeight: 46,
                  color: '#cbd5e1',
                  '& .MuiListItemIcon-root': { color: 'inherit' },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255,255,255,0.16)', color: '#fff',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, mr: open ? 2 : 'auto' }}><Icon /></ListItemIcon>
                {open && <ListItemText primary={item.label} />}
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: `calc(100% - ${width}px)` }}>
        <Toolbar />
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/dashboard" underline="hover" color="inherit">Home</Link>
          {crumbs.map((c, i) => {
            const to = '/' + crumbs.slice(0, i + 1).join('/');
            const label = c.charAt(0).toUpperCase() + c.slice(1);
            return i === crumbs.length - 1
              ? <Typography key={to} color="text.primary">{label}</Typography>
              : <Link key={to} component={RouterLink} to={to} underline="hover" color="inherit">{label}</Link>;
          })}
        </Breadcrumbs>
        <Outlet />
      </Box>
    </Box>
  );
}
