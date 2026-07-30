import { useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
} from '@mui/material';
import { useHistoricalMatchesMutation, type HistoricalMatch } from '@/features/leads/leadsApi';

interface Pending {
  threshold: number;
  matches: HistoricalMatch[];
  run: () => void | Promise<void>;
}

export function useHistoricalDuplicateGuard(verb = 'Assign') {
  const [check, { isLoading: checking }] = useHistoricalMatchesMutation();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const guard = async (leadIds: string[], run: () => void | Promise<void>) => {
    const ids = leadIds.filter(Boolean);
    if (ids.length) {
      try {
        const res = await check({ leadIds: ids }).unwrap();
        if (res.data.matches.length) {
          setPending({ threshold: res.data.threshold, matches: res.data.matches, run });
          return;
        }
      } catch {
        /* advisory only */
      }
    }
    await run();
  };

  const proceed = async () => {
    if (!pending) return;
    const { run } = pending;
    setBusy(true);
    try {
      await run();
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const dialog: ReactNode = (
    <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="sm" fullWidth>
      <DialogTitle>Already in Historical Data</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {pending?.matches.length === 1
            ? 'This company already appears in the historical archive.'
            : `${pending?.matches.length} of these companies already appear in the historical archive.`}
          {' '}Matching at {Math.round((pending?.threshold ?? 0.9) * 100)}% or above on company name.
        </Alert>
        <Stack spacing={2}>
          {pending?.matches.map((m) => (
            <Box key={m.leadId}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.company}</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {m.matches.map((h) => (
                  <li key={h.id}>
                    <Typography variant="caption">
                      {h.company}
                      {h.eventYear ? ` · ${h.eventYear}` : ''}
                      {h.assignedTo ? ` · was with ${h.assignedTo}` : ''}
                      {' · '}{Math.round(h.score * 100)}% match
                    </Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          This company may have exhibited before. Check the Historical Data tab for past
          participation before working the lead.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPending(null)}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={proceed}>{verb} anyway</Button>
      </DialogActions>
    </Dialog>
  );

  return { guard, checking, dialog };
}
