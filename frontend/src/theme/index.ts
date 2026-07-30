import { createTheme, alpha, type Theme } from '@mui/material/styles';

export const GRADIENTS = {
  brand: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(29, 78, 216) 100%)',
  brandHover: 'linear-gradient(135deg, rgb(37, 99, 235) 0%, rgb(30, 64, 175) 100%)',
  dark: 'linear-gradient(160deg,#2549a3,#16315f 45%,#0a1325)',
} as const;

export const SIDEBAR = {
  bg: '#0f172a',
  bgHover: 'rgba(148,163,184,0.12)',
  bgActive: 'rgba(59,130,246,0.16)',
  text: '#94a3b8',
  textActive: '#f8fafc',
  border: 'rgba(148,163,184,0.14)',
} as const;

const NEUTRAL = {
  border: '#e2e8f0',
  borderDark: 'rgba(148,163,184,0.18)',
  surface: '#ffffff',
  surfaceDark: '#111c33',
  canvas: '#f6f8fb',
  canvasDark: '#0b1425',
};

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  const divider = isDark ? NEUTRAL.borderDark : NEUTRAL.border;
  const paper = isDark ? NEUTRAL.surfaceDark : NEUTRAL.surface;

  return createTheme({
    palette: {
      mode,
      primary: { main: '#2563eb', light: '#3b82f6', dark: '#1d4ed8' },
      secondary: { main: '#0ea5e9' },
      success: { main: '#16a34a' },
      warning: { main: '#d97706' },
      error: { main: '#dc2626' },
      info: { main: '#0284c7' },
      divider,
      background: {
        default: isDark ? NEUTRAL.canvasDark : NEUTRAL.canvas,
        paper,
      },
      text: {
        primary: isDark ? '#e8edf7' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
    },

    shape: { borderRadius: 8 },

    typography: {
      fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
      h4: { fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.015em' },
      h6: { fontWeight: 650, fontSize: '1rem', letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600, fontSize: '0.95rem' },
      subtitle2: { fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.01em' },
      body1: { fontSize: '0.875rem' },
      body2: { fontSize: '0.825rem', lineHeight: 1.55 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.32)',
            borderRadius: 8,
            border: `2px solid ${isDark ? NEUTRAL.canvasDark : NEUTRAL.canvas}`,
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: divider },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${divider}`,
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15,23,42,0.04)',
          },
        },
      },

      MuiCardHeader: {
        styleOverrides: {
          root: { padding: '16px 20px' },
          title: { fontSize: '0.95rem', fontWeight: 650 },
          subheader: { fontSize: '0.8rem' },
        },
      },

      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 14, minHeight: 36 },
          sizeSmall: { minHeight: 32, paddingInline: 10, fontSize: '0.8rem' },
          sizeLarge: { minHeight: 42, paddingInline: 20 },
          outlined: { borderColor: divider, '&:hover': { borderColor: 'currentColor' } },
        },
      },

      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },

      MuiAppBar: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },

      MuiToolbar: {
        styleOverrides: { root: { minHeight: 60, '@media (min-width:600px)': { minHeight: 60 } } },
      },

      MuiTable: {
        styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : '#f8fafc',
              color: isDark ? '#cbd5e1' : '#475569',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.045em',
              textTransform: 'uppercase',
              borderBottom: `1px solid ${divider}`,
              whiteSpace: 'nowrap',
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${divider}`, fontSize: '0.825rem' },
          sizeSmall: { padding: '10px 14px' },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color .12s ease',
            '&:last-of-type .MuiTableCell-root': { borderBottom: 'none' },
            '&.MuiTableRow-hover:hover': {
              backgroundColor: isDark ? 'rgba(148,163,184,0.07)' : 'rgba(37,99,235,0.04)',
            },
          },
        },
      },

      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            '&.Mui-active': { color: 'inherit' },
            '&:hover': { color: 'inherit', opacity: 0.85 },
          },
        },
      },

      MuiTablePagination: {
        styleOverrides: {
          root: { borderTop: `1px solid ${divider}` },
          selectLabel: { fontSize: '0.8rem' },
          displayedRows: { fontSize: '0.8rem' },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.72rem', height: 24, borderRadius: 6 },
          outlined: { borderColor: divider },
          label: { paddingInline: 8 },
        },
      },

      MuiDivider: {
        styleOverrides: { root: { borderColor: divider } },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? 'rgba(148,163,184,0.05)' : '#fff',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: divider },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(148,163,184,0.4)' : '#cbd5e1',
            },
          },
          input: { fontSize: '0.85rem' },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          input: {
            fontSize: '0.85rem',
            '&::placeholder': { fontFamily: 'inherit', fontSize: '0.85rem', opacity: 0.7 },
          },
        },
      },

      MuiInputLabel: { styleOverrides: { root: { fontSize: '0.85rem' } } },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${divider}`,
            boxShadow: '0 8px 28px rgba(15,23,42,0.12)',
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: { root: { fontSize: '0.85rem', borderRadius: 6, marginInline: 6 } },
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

      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 14, border: `1px solid ${divider}` },
        },
      },

      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 650, padding: '18px 22px' } },
      },

      MuiDialogContent: { styleOverrides: { root: { padding: '4px 22px 18px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 18px', gap: 8 } } },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontSize: '0.825rem', alignItems: 'center' },
          standardInfo: { backgroundColor: alpha('#0284c7', isDark ? 0.16 : 0.08) },
          standardSuccess: { backgroundColor: alpha('#16a34a', isDark ? 0.16 : 0.09) },
          standardWarning: { backgroundColor: alpha('#d97706', isDark ? 0.16 : 0.1) },
          standardError: { backgroundColor: alpha('#dc2626', isDark ? 0.16 : 0.08) },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: '#1e293b',
            fontSize: '0.75rem',
            borderRadius: 6,
            padding: '6px 10px',
          },
          arrow: { color: '#1e293b' },
        },
      },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 42 },
          indicator: { height: 2.5, borderRadius: 2 },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: { minHeight: 42, fontWeight: 600, fontSize: '0.85rem', textTransform: 'none' },
        },
      },

      MuiBreadcrumbs: {
        styleOverrides: {
          root: {
            fontSize: '0.78rem',
            '& .MuiTypography-root, & a': { fontSize: '0.78rem' },
          },
          li: { fontSize: '0.78rem' },
          separator: { marginInline: 6 },
        },
      },

      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },

      MuiCheckbox: { defaultProps: { size: 'small' } },

      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
    },
  });
}
