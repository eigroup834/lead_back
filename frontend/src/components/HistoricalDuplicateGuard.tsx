import { useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
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
        <Stack spacing={2.5}>
          {pending?.matches.map((m) => (
            <Box key={m.leadId}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{m.company}</Typography>
              <Stack spacing={1}>
                {m.matches.map((h) => (
                  <Box key={h.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.company || '—'}</Typography>
                      <Chip size="small" color="warning" label={`${Math.round(h.score * 100)}% match`} />
                      {h.eventYear && <Chip size="small" variant="outlined" label={h.eventYear} />}
                    </Stack>
                    <MatchField label="Contact" value={h.name} />
                    <MatchField label="Email" value={h.email} />
                    <MatchField label="Mobile" value={h.mobile} />
                    <MatchField label="Was with" value={h.assignedTo} />
                  </Box>
                ))}
              </Stack>
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

function MatchField({ label, value }: { label: string; value: string | null }) {
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.15 }}>
      <Typography variant="caption" color="text.secondary" sx={{ width: 68, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Stack>
  );
}
