import { useState, type MouseEvent, type ReactNode } from 'react';
import { Button, IconButton, Menu, MenuItem, Stack, Tooltip } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { TABLE_HEAD } from '@/theme';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * Pins the actions column to the right edge of a scrolling table. It floats and
 * nothing else — no border, no shadow, no blur.
 *
 * The background is not decoration: without it the columns scrolling underneath
 * would read straight through the buttons. Alignment lives here rather than on each
 * page so the header cell and the body cells cannot drift apart.
 */
export const STICKY_ACTION_COL = {
  position: 'sticky' as const,
  right: 0,
  zIndex: 2,
  bgcolor: 'background.paper',

  // width:1px + nowrap is the shrink-to-fit idiom for a table cell. A percentage is
  // only a hint and the browser still hands the column a share of the table's spare
  // width; an absolute 1px cannot be honoured, so the cell falls back to exactly its
  // content width and every spare pixel goes to the data columns instead.
  width: '1px',
  whiteSpace: 'nowrap' as const,
  textAlign: 'right' as const,
  paddingLeft: 8,
  paddingRight: 16,

  // The header cell wears the header colour, or the pinned corner shows as a pale
  // notch cut out of the tinted band.
  '&.MuiTableCell-head': {
    bgcolor: (t: Theme) => (t.palette.mode === 'dark' ? TABLE_HEAD.bgDark : TABLE_HEAD.bgLight),
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
      sx={{ display: 'inline-flex' }}
    >
      {inline.map((a) => (
        <Button
          key={a.label}
          size="small"
          variant="text"
          startIcon={a.icon}
          disabled={a.disabled}
          onClick={a.onClick}
          sx={{
            // The tinted, indigo-text treatment is the resting state — not something
            // you have to hover to discover. No border, no fill edge, no shadow.
            minHeight: 28,
            px: 1.25,
            py: 0.25,
            fontSize: '0.75rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            justifyContent: 'center',
            border: 'none',
            boxShadow: 'none',
            color: 'primary.main',
            bgcolor: 'action.hover',
            '&:hover': {
              border: 'none',
              boxShadow: 'none',
              color: 'primary.main',
              bgcolor: 'action.selected',
            },
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
