import { Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { currentSeason, seasonLabel } from '@/constants';
import type { SalesTarget } from '@/features/adminApi';

export type TargetDraft = { year: number; targetSqm: string };

export const toDrafts = (targets?: SalesTarget[]): TargetDraft[] =>
  (targets ?? []).map((t) => ({ year: t.year, targetSqm: String(t.targetSqm) }));

/** Drops blank rows and keeps the last value if a season is listed twice. */
export const fromDrafts = (drafts: TargetDraft[]): SalesTarget[] => {
  const byYear = new Map<number, number>();
  for (const d of drafts) {
    const n = Number(d.targetSqm);
    if (!d.targetSqm.trim() || Number.isNaN(n) || n < 0) continue;
    byYear.set(d.year, n);
  }
  return [...byYear.entries()].map(([year, targetSqm]) => ({ year, targetSqm }));
};

export const draftsInvalid = (drafts: TargetDraft[]) =>
  drafts.some((d) => d.targetSqm.trim() !== '' && (Number.isNaN(Number(d.targetSqm)) || Number(d.targetSqm) < 0));

// A few seasons either side of now — enough to plan ahead and correct the past.
const YEAR_OPTIONS = (() => {
  const now = currentSeason();
  return Array.from({ length: 8 }, (_, i) => now - 2 + i);
})();

export default function SalesTargetEditor({ value, onChange }: {
  value: TargetDraft[];
  onChange: (next: TargetDraft[]) => void;
}) {
  const used = new Set(value.map((v) => v.year));
  const nextFreeYear = YEAR_OPTIONS.find((y) => !used.has(y)) ?? currentSeason();

  const setRow = (i: number, patch: Partial<TargetDraft>) =>
    onChange(value.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Sales targets</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Space to book per season, in sqm. A season runs April to March and is named for the
        year its March event falls in.
      </Typography>

      <Stack spacing={1}>
        {value.map((row, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
            <TextField
              select size="small" label="Season" value={row.year}
              onChange={(e) => setRow(i, { year: Number(e.target.value) })}
              sx={{ minWidth: 190 }}
            >
              {YEAR_OPTIONS.map((y) => (
                <MenuItem key={y} value={y} disabled={y !== row.year && used.has(y)}>
                  {y} · {seasonLabel(y)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" label="Target (sqm)" type="number" value={row.targetSqm}
              onChange={(e) => setRow(i, { targetSqm: e.target.value })}
              inputProps={{ min: 0, step: 'any' }}
              error={row.targetSqm.trim() !== '' && (Number.isNaN(Number(row.targetSqm)) || Number(row.targetSqm) < 0)}
              sx={{ width: 160 }}
            />
            <Tooltip title="Remove">
              <IconButton size="small" onClick={() => onChange(value.filter((_, j) => j !== i))} sx={{ mt: 0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>

      <Button
        size="small" startIcon={<AddIcon />} sx={{ mt: value.length ? 1 : 0 }}
        onClick={() => onChange([...value, { year: nextFreeYear, targetSqm: '' }])}
      >
        Add season
      </Button>
    </Box>
  );
}
