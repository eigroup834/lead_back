import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, CardHeader, Button, MenuItem, Select, FormControl, InputLabel,
  Stack, Typography, Alert, LinearProgress, Link,
} from '@mui/material';
import { useAppSelector } from '@/store';

type Format = 'csv' | 'excel' | 'pdf';

// Reports use the queued export endpoint; we poll job status until ready.
export default function ReportsPage() {
  const token = useAppSelector((s) => s.auth.accessToken);
  const [format, setFormat] = useState<Format>('csv');
  const [job, setJob] = useState<{ id: string; status: string; file?: string; downloadUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const start = async () => {
    setBusy(true);
    const res = await fetch('/api/v1/reports/export', { method: 'POST', headers, body: JSON.stringify({ format, filter: {} }) });
    const json = await res.json();
    setJob({ id: json.data.jobId, status: 'queued' });
  };

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') { setBusy(false); return; }
    const t = setInterval(async () => {
      const res = await fetch(`/api/v1/reports/${job.id}`, { headers });
      const json = await res.json();
      setJob((prev) => prev && { ...prev, status: json.data.status, file: json.data.file, downloadUrl: json.data.downloadUrl });
    }, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Reports & Exports</Typography>
      <Card sx={{ maxWidth: 560 }}>
        <CardHeader title="Generate Lead Export" subheader="Large exports are processed in the background and will be available once complete." />
        <CardContent>
          <Stack spacing={2}>
            <FormControl size="small" sx={{ width: 200 }}>
              <InputLabel>Format</InputLabel>
              <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                <MenuItem value="csv">CSV</MenuItem>
                <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                <MenuItem value="pdf">PDF (summary)</MenuItem>
              </Select>
            </FormControl>
            <Box><Button variant="contained" onClick={start} disabled={busy}>Export</Button></Box>

            {job && (
              <Alert severity={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'info'}>
                Job <b>{job.id}</b> — {job.status}
                {job.status !== 'completed' && job.status !== 'failed' && <LinearProgress sx={{ mt: 1 }} />}
                {job.status === 'completed' && job.downloadUrl && (
                  <Box sx={{ mt: 1 }}><Link href={job.downloadUrl} target="_blank" rel="noreferrer">Download {job.file}</Link></Box>
                )}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
