import { useState, type ReactNode } from 'react';
import { TableCell, TableSortLabel, type TableCellProps } from '@mui/material';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string = string> {
  by: K;
  dir: SortDir;
}

export function useSort<K extends string>(initial: SortState<K>, onChange?: () => void) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (by: K) => {
    setSort((s) => ({ by, dir: s.by === by && s.dir === 'asc' ? 'desc' : 'asc' }));
    onChange?.();
  };
  return { sort, toggle };
}

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
    if (!sx !== !sy) return sx ? -1 : 1;
    const cmp = sx.localeCompare(sy, undefined, { sensitivity: 'base', numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
}

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
