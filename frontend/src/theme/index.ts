import { createTheme, type Theme } from '@mui/material/styles';

// Brand gradients — shared across the app (buttons, sidebar, auth screens).
export const GRADIENTS = {
  // Bright brand-blue accent (primary buttons, highlights).
  brand: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(29, 78, 216) 100%)',
  brandHover: 'linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(30, 64, 175) 100%)',
  // Deep navy gradient (sidebar, auth background).
  dark: 'linear-gradient(160deg,#2549a3,#16315f 45%,#0a1325)',
} as const;

// Enterprise palette — brand blue accent. Light & dark variants.
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
        // Dark mode uses navy tones so the content frame is cohesive with the
        // navy sidebar/app-bar instead of clashing slate-grey.
        default: isDark ? '#0b1630' : '#f1f5f9',
        paper: isDark ? '#13213f' : '#ffffff',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"DM Sans", sans-serif',
      // Compact headings across all screens.
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
          // Apply the brand gradient only when enabled, so disabled buttons keep
          // MUI's proper greyed-out background + text (not blue with dark text).
          containedPrimary: {
            '&:not(.Mui-disabled)': { background: GRADIENTS.brand },
            '&:not(.Mui-disabled):hover': { background: GRADIENTS.brandHover },
          },
        },
      },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
      // Uniform, compact form typography so inputs, selects, labels, placeholders
      // and menu options all share the same size + app font (DM Sans).
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
      // Dropdowns always open below the field, never overlapping it. The capped
      // height lets long lists scroll instead of being pushed up over the field.
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
            // Links and the active Typography crumb inherit the small size.
            '& .MuiTypography-root, & a': { fontSize: '0.8rem' },
          },
          li: { fontSize: '0.8rem' },
        },
      },
    },
  });
}
