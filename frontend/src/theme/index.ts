import { createTheme, type Theme } from '@mui/material/styles';

export const GRADIENTS = {
  brand: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(29, 78, 216) 100%)',
  brandHover: 'linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(30, 64, 175) 100%)',
  dark: 'linear-gradient(160deg,#2549a3,#16315f 45%,#0a1325)',
} as const;

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
      secondary: { main: '#0ea5e9' },
      success: { main: '#16a34a' },
      warning: { main: '#d97706' },
      error: { main: '#dc2626' },
      background: {
        default: isDark ? '#0b1630' : '#f1f5f9',
        paper: isDark ? '#13213f' : '#ffffff',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"DM Sans", sans-serif',
      h4: { fontWeight: 700, fontSize: '1.35rem' },
      h5: { fontWeight: 700, fontSize: '1.15rem' },
      h6: { fontWeight: 600, fontSize: '1rem' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCard: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          containedPrimary: {
            '&:not(.Mui-disabled)': { background: GRADIENTS.brand },
            '&:not(.Mui-disabled):hover': { background: GRADIENTS.brandHover },
          },
        },
      },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiInputBase: {
        styleOverrides: {
          input: {
            fontSize: '0.85rem',
            '&::placeholder': { fontFamily: 'inherit', fontSize: '0.85rem', opacity: 0.7 },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: '0.85rem' } },
      },
      MuiMenuItem: {
        styleOverrides: { root: { fontSize: '0.85rem' } },
      },
      MuiSelect: {
        defaultProps: {
          MenuProps: {
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
            PaperProps: { sx: { maxHeight: 320 } },
          },
        },
      },
      // Compact breadcrumbs on all screens.
      MuiBreadcrumbs: {
        styleOverrides: {
          root: {
            fontSize: '0.8rem',
            '& .MuiTypography-root, & a': { fontSize: '0.8rem' },
          },
          li: { fontSize: '0.8rem' },
        },
      },
    },
  });
}
