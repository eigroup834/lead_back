import { useState, type ReactNode } from 'react';
import { TableCell, TableSortLabel, type TableCellProps } from '@mui/material';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string = string> {
  by: K;
  dir: SortDir;
}

/**
 * Sort state for a table header. `onChange` fires after every toggle — paged
 * tables use it to jump back to page 1, since the first page of a re-sorted
 * list is no longer the page you were on.
 */
export function useSort<K extends string>(initial: SortState<K>, onChange?: () => void) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (by: K) => {
    // Re-clicking the active column flips direction; a new column starts ascending.
    setSort((s) => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
    onChange?.();
  };
  return { sort, toggle };
}

/**
 * Client-side sort for tables that fetch all their rows in one request (the
 * paged tables sort on the server instead, so their sort spans every page).
 * Numbers compare numerically; strings compare case-insensitively with blanks
 * pushed to the end in both directions.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  by: K,
  dir: SortDir,
  valueOf: Record<K, (row: T) => string | number>,
): T[] {
  const get = valueOf[by];
  if (!get) return rows;
  return [...rows].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (typeof x === 'number' && typeof y === 'number') return dir === 'asc' ? x - y : y - x;
    const sx = String(x);
    const sy = String(y);
    if (!sx !== !sy) return sx ? -1 : 1; // blanks last regardless of direction
    const cmp = sx.localeCompare(sy, undefined, { sensitivity: 'base', numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
}

/**
 * Header cell that sorts by `field`. Columns with no meaningful order (actions,
 * multi-value cells) should stay a plain TableCell instead.
 */
export function SortableCell<K extends string>({
  field, sort, onSort, children, sx, ...cellProps
}: {
  field: K;
  sort: SortState<K>;
  onSort: (field: K) => void;
  children: ReactNode;
} & Omit<TableCellProps, 'sortDirection' | 'onClick'>) {
  const active = sort.by === field;
  return (
    <TableCell
      sortDirection={active ? sort.dir : false}
      sx={{ fontWeight: 700, whiteSpace: 'nowrap', ...sx }}
      {...cellProps}
    >
      <TableSortLabel active={active} direction={active ? sort.dir : 'asc'} onClick={() => onSort(field)}>
        {children}
      </TableSortLabel>
    </TableCell>
  );
}
