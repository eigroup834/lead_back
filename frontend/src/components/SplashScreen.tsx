import { Box, CircularProgress, Typography } from '@mui/material';

export default function SplashScreen() {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <CircularProgress />
      <Typography color="text.secondary">Loading…</Typography>
    </Box>
  );
}
