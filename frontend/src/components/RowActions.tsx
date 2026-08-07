import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, IconButton, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Pins an actions column to the right edge of a scrolling table so its buttons stay
 * reachable however far the table is scrolled sideways. Spread onto both the header
 * cell and the body cell; the header needs a higher zIndex to clear the sticky head.
 */
export const STICKY_ACTION_COL = {
  position: 'sticky' as const,
  right: 0,
  bgcolor: 'background.paper',
  zIndex: 2,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '6px',
    transform: 'translateX(-100%)',
    pointerEvents: 'none',
    background: 'linear-gradient(to right, rgba(15,23,42,0), rgba(15,23,42,0.08))',
  },
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
      sx={{ display: 'inline-flex', minWidth: STACK_DIRECTION === 'column' ? 96 : 'auto' }}
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
