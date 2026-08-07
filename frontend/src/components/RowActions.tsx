import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, IconButton, Menu, MenuItem, Stack, Tooltip, alpha } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { TABLE_HEAD } from '@/theme';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Pins an actions column to the right edge of a scrolling table so its buttons stay
 * reachable however far the table is scrolled sideways. Spread onto both the header
 * cell and the body cell; the header needs a higher zIndex to clear the sticky head.
 */
export const STICKY_ACTION_COL = {
  position: 'sticky' as const,
  right: 0,
  zIndex: 2,
  // Frosted rather than opaque, so columns sliding underneath stay faintly visible
  // instead of hitting a hard wall. Falls back to a solid surface where unsupported.
  bgcolor: 'background.paper',
  '@supports (backdrop-filter: blur(8px))': {
    bgcolor: (t: Theme) => alpha(t.palette.background.paper, t.palette.mode === 'dark' ? 0.78 : 0.82),
    backdropFilter: 'saturate(180%) blur(8px)',
  },
  // In the header row it must wear the header colour, or the pinned corner shows
  // as a pale notch cut out of the tinted band.
  '&.MuiTableCell-head': {
    bgcolor: (t: Theme) => (t.palette.mode === 'dark' ? TABLE_HEAD.bgDark : TABLE_HEAD.bgLight),
    backdropFilter: 'none',
  },
  // A hairline edge plus one soft shadow, rather than a gradient strip: a per-cell
  // gradient re-draws on every row and streaks against the row borders.
  borderLeft: (t: Theme) => `1px solid ${t.palette.divider}`,
  boxShadow: (t: Theme) => `-8px 0 12px -10px ${alpha(
    t.palette.mode === 'dark' ? '#000' : '#0f172a', t.palette.mode === 'dark' ? 0.65 : 0.16,
  )}`,
};

export interface RowAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  primary?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

/**
 * One house style for per-row table actions.
 *
 * Up to INLINE_LIMIT actions render as labelled buttons — a label is always clearer
 * than an icon nobody has to guess at. Anything beyond that folds into an overflow
 * menu so wide tables do not grow a wall of buttons.
 */
const INLINE_LIMIT = 2;

// Stacked (one per line) rather than side by side. Flip to 'row' here to change
// every table at once — no page touches this decision individually.
const STACK_DIRECTION: 'row' | 'column' = 'column';

export default function RowActions({ actions, limit = INLINE_LIMIT }: { actions: RowAction[]; limit?: number }) {
  const [menu, setMenu] = useState<null | HTMLElement>(null);
  const visible = actions.filter((a) => !a.hidden);
  if (!visible.length) return null;

  const inline = visible.length <= limit ? visible : visible.slice(0, limit - 1);
  const overflow = visible.length <= limit ? [] : visible.slice(limit - 1);

  const open = (e: MouseEvent<HTMLElement>) => setMenu(e.currentTarget);
  const close = () => setMenu(null);

  return (
    <Stack
      direction={STACK_DIRECTION}
      spacing={0.5}
      justifyContent="flex-end"
      alignItems={STACK_DIRECTION === 'column' ? 'stretch' : 'center'}
      sx={{
        display: 'inline-flex',
        minWidth: STACK_DIRECTION === 'column' ? 96 : 'auto',
        // Actions belong to the row you are on. They rest quietly and come forward
        // on hover or keyboard focus, so a 25-row table is not 50 shouting buttons.
        opacity: 0.42,
        transform: STACK_DIRECTION === 'column' ? 'none' : 'translateX(2px)',
        transition: 'opacity .18s ease, transform .18s ease',
        'tr:hover &, tr:focus-within &, &:hover, &:focus-within': {
          opacity: 1,
          transform: 'none',
        },
        // Touch devices have no hover, so never hide anything there.
        '@media (hover: none)': { opacity: 1, transform: 'none' },
      }}
    >
      {inline.map((a) => (
        <Button
          key={a.label}
          size="small"
          variant={a.primary ? 'contained' : 'outlined'}
          startIcon={a.icon}
          disabled={a.disabled}
          onClick={a.onClick}
          sx={{
            // Geometry comes from the theme's small-button spec; only the tighter
            // row density is set here so table rows stay compact.
            minHeight: 28,
            px: 1.25,
            py: 0.25,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            justifyContent: 'center',
          }}
        >
          {a.label}
        </Button>
      ))}

      {overflow.length > 0 && (
        <>
          <Tooltip title="More actions">
            <IconButton
              size="small"
              onClick={open}
              sx={STACK_DIRECTION === 'column' ? { alignSelf: 'center', py: 0 } : undefined}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={menu} open={!!menu} onClose={close}>
            {overflow.map((a) => (
              <MenuItem
                key={a.label}
                disabled={a.disabled}
                onClick={() => { close(); a.onClick(); }}
              >
                {a.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Stack>
  );
}
