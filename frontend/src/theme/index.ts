import { createTheme, alpha, type Theme } from '@mui/material/styles';

/**
 * The single source of visual truth. Every screen is styled from here rather than
 * page by page, so spacing, radii, colour and motion stay identical everywhere.
 *
 * Palette: indigo primary, violet secondary, emerald accent — the indigo matches
 * CHART_COLORS[0], so charts and chrome read as one system.
 */

const BRAND = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
} as const;

export const GRADIENTS = {
  brand: `linear-gradient(135deg, ${BRAND[500]} 0%, ${BRAND[600]} 100%)`,
  brandHover: `linear-gradient(135deg, ${BRAND[600]} 0%, ${BRAND[700]} 100%)`,
  accent: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  danger: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
  dark: 'linear-gradient(150deg, #312e81 0%, #1e1b4b 40%, #0b1020 100%)',
  // Very low-alpha wash for KPI tiles and highlighted surfaces.
  tintLight: `linear-gradient(135deg, ${alpha(BRAND[500], 0.07)} 0%, ${alpha(BRAND[500], 0)} 60%)`,
  tintDark: `linear-gradient(135deg, ${alpha(BRAND[400], 0.14)} 0%, ${alpha(BRAND[400], 0)} 60%)`,
} as const;

export const SIDEBAR = {
  bg: '#0e1225',
  bgHover: 'rgba(148,163,184,0.10)',
  bgActive: alpha(BRAND[500], 0.18),
  activeBar: GRADIENTS.brand,
  text: '#96a0b8',
  textActive: '#ffffff',
  border: 'rgba(148,163,184,0.12)',
} as const;

const NEUTRAL = {
  border: '#e6e9f0',
  borderDark: 'rgba(148,163,184,0.16)',
  surface: '#ffffff',
  surfaceDark: '#131a2e',
  canvas: '#f7f8fc',
  canvasDark: '#0b1020',
};

// Layered, low-spread shadows. Flat elevation reads cheap; two stacked layers give
// depth without the muddy grey halo MUI's defaults produce.
const SHADOW = {
  xs: '0 1px 2px rgba(16,24,40,0.05)',
  sm: '0 1px 3px rgba(16,24,40,0.07), 0 1px 2px rgba(16,24,40,0.04)',
  md: '0 4px 10px -2px rgba(16,24,40,0.08), 0 2px 6px -2px rgba(16,24,40,0.05)',
  lg: '0 12px 28px -6px rgba(16,24,40,0.14), 0 4px 10px -4px rgba(16,24,40,0.06)',
  xl: '0 24px 48px -12px rgba(16,24,40,0.20)',
} as const;

const FONT = '"Inter", "Inter var", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  const divider = isDark ? NEUTRAL.borderDark : NEUTRAL.border;
  const paper = isDark ? NEUTRAL.surfaceDark : NEUTRAL.surface;
  const canvas = isDark ? NEUTRAL.canvasDark : NEUTRAL.canvas;
  const shadowSm = isDark ? 'none' : SHADOW.sm;
  const shadowMd = isDark ? '0 4px 12px rgba(0,0,0,0.35)' : SHADOW.md;
  const shadowLg = isDark ? '0 18px 40px rgba(0,0,0,0.5)' : SHADOW.lg;
  const focusRing = `0 0 0 3px ${alpha(BRAND[500], isDark ? 0.34 : 0.22)}`;

  return createTheme({
    palette: {
      mode,
      primary: { main: BRAND[600], light: BRAND[400], dark: BRAND[700], contrastText: '#fff' },
      secondary: { main: '#7c3aed', light: '#a78bfa', dark: '#6d28d9' },
      success: { main: '#059669', light: '#34d399', dark: '#047857' },
      warning: { main: '#d97706', light: '#fbbf24', dark: '#b45309' },
      error: { main: '#e11d48', light: '#fb7185', dark: '#be123c' },
      info: { main: '#0891b2', light: '#22d3ee', dark: '#0e7490' },
      divider,
      background: { default: canvas, paper },
      text: {
        primary: isDark ? '#e9edf7' : '#0f172a',
        secondary: isDark ? '#98a2b8' : '#5b6478',
        disabled: isDark ? '#5b6478' : '#98a2b8',
      },
      action: {
        hover: isDark ? 'rgba(148,163,184,0.08)' : alpha(BRAND[500], 0.05),
        selected: isDark ? 'rgba(148,163,184,0.12)' : alpha(BRAND[500], 0.08),
      },
    },

    shape: { borderRadius: 10 },

    // Rounder, softer elevation than MUI's defaults at every step.
    shadows: [
      'none', SHADOW.xs, SHADOW.sm, SHADOW.sm, SHADOW.md, SHADOW.md, SHADOW.md, SHADOW.md,
      SHADOW.lg, SHADOW.lg, SHADOW.lg, SHADOW.lg, SHADOW.lg, SHADOW.lg, SHADOW.lg, SHADOW.lg,
      SHADOW.xl, SHADOW.xl, SHADOW.xl, SHADOW.xl, SHADOW.xl, SHADOW.xl, SHADOW.xl, SHADOW.xl,
      SHADOW.xl,
    ],

    // One type scale, used everywhere. Tight tracking on headings is what makes
    // Inter read as a product typeface rather than a default.
    typography: {
      fontFamily: FONT,
      h4: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.025em', lineHeight: 1.25 },
      h5: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', lineHeight: 1.3 },
      h6: { fontWeight: 650, fontSize: '1.0625rem', letterSpacing: '-0.015em', lineHeight: 1.35 },
      subtitle1: { fontWeight: 600, fontSize: '0.9375rem', letterSpacing: '-0.01em' },
      subtitle2: { fontWeight: 600, fontSize: '0.8125rem', letterSpacing: '-0.005em' },
      body1: { fontSize: '0.875rem', lineHeight: 1.6 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.6 },
      caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: '0.005em' },
      overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '-0.005em' },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
          body: { backgroundColor: canvas, fontFeatureSettings: '"cv02","cv03","cv04","cv11"' },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(148,163,184,0.26)' : 'rgba(100,116,139,0.28)',
            borderRadius: 999,
            border: `2px solid ${canvas}`,
            '&:hover': { backgroundColor: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.45)' },
          },
          '*::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
          // Content settles in rather than snapping — used by page containers.
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(6px)' },
            to: { opacity: 1, transform: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
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
            borderRadius: 14,
            border: `1px solid ${divider}`,
            boxShadow: shadowSm,
            transition: 'box-shadow .22s cubic-bezier(.4,0,.2,1), border-color .22s ease, transform .22s cubic-bezier(.4,0,.2,1)',
            '&:hover': { boxShadow: shadowMd },
          },
        },
      },

      MuiCardHeader: {
        styleOverrides: {
          root: { padding: '18px 22px 14px' },
          title: { fontSize: '1rem', fontWeight: 650, letterSpacing: '-0.015em' },
          subheader: { fontSize: '0.8125rem', marginTop: 2 },
          action: { alignSelf: 'center', marginTop: 0, marginRight: 0 },
        },
      },

      MuiCardContent: {
        styleOverrides: { root: { padding: 22, '&:last-child': { paddingBottom: 22 } } },
      },

      // Every button in the app shares this geometry, transition, focus and
      // disabled treatment. Variant only changes colour, never shape.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            minHeight: 38,
            paddingInline: 16,
            fontWeight: 600,
            transition: 'background .2s ease, border-color .2s ease, color .2s ease, box-shadow .2s ease, transform .12s ease',
            '&:focus-visible': { boxShadow: focusRing, outline: 'none' },
            '&:active': { transform: 'translateY(0.5px)' },
            '&.Mui-disabled': { opacity: 0.55 },
          },
          sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: '0.8125rem', borderRadius: 8 },
          sizeLarge: { minHeight: 44, paddingInline: 22, fontSize: '0.9375rem' },
          containedPrimary: {
            background: GRADIENTS.brand,
            boxShadow: `0 1px 2px ${alpha(BRAND[700], 0.24)}`,
            '&:hover': {
              background: GRADIENTS.brandHover,
              boxShadow: `0 4px 12px -2px ${alpha(BRAND[600], 0.42)}`,
            },
            '&.Mui-disabled': { background: GRADIENTS.brand, color: '#fff' },
          },
          containedSuccess: { background: GRADIENTS.accent, '&:hover': { background: GRADIENTS.accent, filter: 'brightness(0.94)' } },
          containedError: { background: GRADIENTS.danger, '&:hover': { background: GRADIENTS.danger, filter: 'brightness(0.94)' } },
          outlined: {
            borderColor: divider,
            backgroundColor: isDark ? 'transparent' : '#fff',
            '&:hover': {
              borderColor: alpha(BRAND[500], 0.5),
              backgroundColor: alpha(BRAND[500], isDark ? 0.1 : 0.04),
            },
          },
          text: { '&:hover': { backgroundColor: alpha(BRAND[500], isDark ? 0.12 : 0.06) } },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'background .18s ease, color .18s ease, box-shadow .18s ease',
            '&:focus-visible': { boxShadow: focusRing, outline: 'none' },
          },
          sizeSmall: { padding: 6 },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            borderColor: divider,
            textTransform: 'none',
            fontWeight: 600,
            '&.Mui-selected': {
              backgroundColor: alpha(BRAND[500], 0.12),
              color: isDark ? BRAND[300] : BRAND[700],
              '&:hover': { backgroundColor: alpha(BRAND[500], 0.18) },
            },
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'saturate(180%) blur(12px)',
            backgroundColor: isDark ? alpha(NEUTRAL.surfaceDark, 0.82) : alpha('#ffffff', 0.86),
          },
        },
      },

      MuiToolbar: {
        styleOverrides: { root: { minHeight: 64, '@media (min-width:600px)': { minHeight: 64 } } },
      },

      MuiTable: {
        styleOverrides: { root: { borderCollapse: 'separate', borderSpacing: 0 } },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: isDark ? '#18203a' : '#fbfcfe',
              color: isDark ? '#aab4c8' : '#5b6478',
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderBottom: `1px solid ${divider}`,
              whiteSpace: 'nowrap',
              paddingTop: 12,
              paddingBottom: 12,
            },
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${isDark ? NEUTRAL.borderDark : '#eef1f6'}`,
            fontSize: '0.8125rem',
          },
          // Roomier rows — the old 10px felt cramped at this type size.
          sizeSmall: { padding: '12px 16px' },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color .15s ease',
            '&:last-of-type .MuiTableCell-root': { borderBottom: 'none' },
            '&.MuiTableRow-hover:hover': {
              backgroundColor: isDark ? 'rgba(148,163,184,0.06)' : alpha(BRAND[500], 0.04),
            },
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor: alpha(BRAND[500], isDark ? 0.16 : 0.07),
            },
          },
        },
      },

      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            '&.Mui-active': { color: isDark ? BRAND[300] : BRAND[700] },
            '&:hover': { color: isDark ? BRAND[300] : BRAND[700] },
            '& .MuiTableSortLabel-icon': { opacity: 0.4 },
          },
        },
      },

      MuiTablePagination: {
        styleOverrides: {
          root: { borderTop: `1px solid ${divider}` },
          toolbar: { minHeight: 56 },
          selectLabel: { fontSize: '0.8125rem' },
          displayedRows: { fontSize: '0.8125rem', fontWeight: 500 },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.6875rem',
            height: 24,
            borderRadius: 999,
            letterSpacing: '0.01em',
          },
          outlined: { borderColor: divider },
          label: { paddingInline: 10 },
        },
        // Status badges read as soft tinted pills rather than saturated blocks.
        variants: [
          { props: { variant: 'filled' as const, color: 'success' as const },
            style: { backgroundColor: alpha('#059669', isDark ? 0.24 : 0.12), color: isDark ? '#6ee7b7' : '#047857' } },
          { props: { variant: 'filled' as const, color: 'error' as const },
            style: { backgroundColor: alpha('#e11d48', isDark ? 0.24 : 0.12), color: isDark ? '#fda4af' : '#be123c' } },
          { props: { variant: 'filled' as const, color: 'warning' as const },
            style: { backgroundColor: alpha('#d97706', isDark ? 0.24 : 0.14), color: isDark ? '#fcd34d' : '#b45309' } },
          { props: { variant: 'filled' as const, color: 'info' as const },
            style: { backgroundColor: alpha('#0891b2', isDark ? 0.24 : 0.12), color: isDark ? '#67e8f9' : '#0e7490' } },
          { props: { variant: 'filled' as const, color: 'primary' as const },
            style: { backgroundColor: alpha(BRAND[500], isDark ? 0.26 : 0.12), color: isDark ? BRAND[200] : BRAND[700] } },
          { props: { variant: 'filled' as const, color: 'default' as const },
            style: { backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#eef1f6', color: isDark ? '#cbd5e1' : '#475569' } },
        ],
      },

      MuiDivider: { styleOverrides: { root: { borderColor: divider } } },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: isDark ? 'rgba(148,163,184,0.05)' : '#fff',
            transition: 'box-shadow .18s ease, border-color .18s ease',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: divider, transition: 'border-color .18s ease' },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(148,163,184,0.38)' : '#cbd5e1',
            },
            '&.Mui-focused': { boxShadow: focusRing },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1, borderColor: BRAND[500] },
            '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha('#e11d48', 0.18)}` },
          },
          input: { fontSize: '0.875rem' },
          inputSizeSmall: { fontSize: '0.8438rem' },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          input: {
            fontSize: '0.875rem',
            '&::placeholder': { fontFamily: 'inherit', opacity: 0.6 },
          },
        },
      },

      MuiInputLabel: {
        styleOverrides: { root: { fontSize: '0.875rem', '&.Mui-focused': { color: BRAND[600] } } },
      },

      MuiFormHelperText: {
        styleOverrides: { root: { fontSize: '0.75rem', marginLeft: 2, marginTop: 4 } },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${divider}`,
            boxShadow: shadowLg,
            marginTop: 4,
          },
          list: { padding: 6 },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.8438rem',
            borderRadius: 8,
            minHeight: 38,
            transition: 'background .14s ease',
            '&.Mui-selected': { backgroundColor: alpha(BRAND[500], 0.1) },
          },
        },
      },

      MuiSelect: {
        defaultProps: {
          MenuProps: {
            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            transformOrigin: { vertical: 'top', horizontal: 'left' },
            PaperProps: { sx: { maxHeight: 340 } },
          },
        },
      },

      MuiPopover: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${divider}`, boxShadow: shadowLg },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16, border: `1px solid ${divider}`, boxShadow: SHADOW.xl },
        },
      },

      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: '1.0625rem', fontWeight: 650, letterSpacing: '-0.015em', padding: '20px 24px 14px' },
        },
      },

      MuiDialogContent: { styleOverrides: { root: { padding: '4px 24px 20px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '14px 20px', gap: 8 } } },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 12, fontSize: '0.8438rem', alignItems: 'center', border: '1px solid transparent' },
          standardInfo: { backgroundColor: alpha('#0891b2', isDark ? 0.16 : 0.07), borderColor: alpha('#0891b2', 0.2) },
          standardSuccess: { backgroundColor: alpha('#059669', isDark ? 0.16 : 0.08), borderColor: alpha('#059669', 0.2) },
          standardWarning: { backgroundColor: alpha('#d97706', isDark ? 0.16 : 0.09), borderColor: alpha('#d97706', 0.22) },
          standardError: { backgroundColor: alpha('#e11d48', isDark ? 0.16 : 0.07), borderColor: alpha('#e11d48', 0.2) },
        },
      },

      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 400 },
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#020617' : '#1e2233',
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 8,
            padding: '7px 11px',
            boxShadow: shadowMd,
          },
          arrow: { color: isDark ? '#020617' : '#1e2233' },
        },
      },

      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 46 },
          indicator: { height: 3, borderRadius: '3px 3px 0 0', background: GRADIENTS.brand },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 46,
            fontWeight: 600,
            fontSize: '0.8438rem',
            textTransform: 'none',
            letterSpacing: '-0.005em',
            transition: 'color .18s ease, background .18s ease',
            borderRadius: '8px 8px 0 0',
            '&:hover': { color: isDark ? BRAND[300] : BRAND[600], backgroundColor: alpha(BRAND[500], 0.04) },
          },
        },
      },

      MuiBreadcrumbs: {
        styleOverrides: {
          root: { fontSize: '0.78125rem', '& .MuiTypography-root, & a': { fontSize: '0.78125rem' } },
          li: { fontSize: '0.78125rem' },
          separator: { marginInline: 6, opacity: 0.6 },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, backgroundColor: isDark ? 'rgba(148,163,184,0.16)' : '#eef1f6' },
          bar: { borderRadius: 999 },
          barColorPrimary: { background: GRADIENTS.brand },
        },
      },

      MuiCheckbox: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { borderRadius: 6, '&:focus-visible': { boxShadow: focusRing } } },
      },

      MuiRadio: {
        defaultProps: { size: 'small' },
        styleOverrides: { root: { '&:focus-visible': { boxShadow: focusRing } } },
      },

      MuiSwitch: {
        styleOverrides: {
          track: { borderRadius: 999 },
          thumb: { boxShadow: SHADOW.xs },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 10, transition: 'background .16s ease, color .16s ease' },
        },
      },

      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: { root: { borderRadius: 8 } },
      },

      MuiAvatar: {
        styleOverrides: { root: { fontWeight: 600, fontSize: '0.8125rem' } },
      },

      MuiBadge: {
        styleOverrides: { badge: { fontWeight: 700, fontSize: '0.6875rem' } },
      },
    },
  });
}
