import { useEffect, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from '@/theme';
import { useAppDispatch, useAppSelector } from '@/store';
import { setCredentials, setInitialized } from '@/features/auth/authSlice';
import AppRoutes from '@/routes';
import SplashScreen from '@/components/SplashScreen';

export default function App() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.mode);
  const initialized = useAppSelector((s) => s.auth.initialized);
  const theme = useMemo(() => buildTheme(mode), [mode]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          dispatch(setCredentials({ accessToken: json.data.accessToken, user: json.data.user }));
        }
      } catch {
      } finally {
        dispatch(setInitialized());
      }
    })();
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {initialized ? <AppRoutes /> : <SplashScreen />}
    </ThemeProvider>
  );
}
