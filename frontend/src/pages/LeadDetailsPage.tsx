import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Stack, Chip, Divider, TextField,
  Button, MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import StatusChip from '@/components/StatusChip';
import {
  LEAD_STATUSES, EXTERNAL_LEAD_TYPES, prettyLabel, sentenceCase, sourceChannelLabel,
  type ExternalLeadType,
} from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useGetLeadQuery, useChangeStatusMutation, useAddNoteMutation,
  useScheduleFollowupMutation, useConvertExternalMutation,
} from '@/features/leads/leadsApi';

export default function LeadDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { has } = usePermissions();
  const { data, isLoading } = useGetLeadQuery(id);
  const [changeStatus, { isLoading: changing }] = useChangeStatusMutation();
  const [addNote, { isLoading: adding }] = useAddNoteMutation();
  const [scheduleFollowup, { isLoading: scheduling }] = useScheduleFollowupMutation();
  const [convertExternal, { isLoading: converting }] = useConvertExternalMutation();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [fuDate, setFuDate] = useState('');
  const [fuTime, setFuTime] = useState('');
  const [fuNote, setFuNote] = useState('');
  const [convertType, setConvertType] = useState<ExternalLeadType | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (isLoading) return <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>;
  const lead = data?.data;
  if (!lead) return <Typography>Lead not found.</Typography>;

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">{lead.company || fullName}</Typography>
        <StatusChip status={lead.status} />
        {lead.priority && <Chip size="small" label={sentenceCase(lead.priority)} variant="outlined" />}
      </Stack>

      <Grid container spacing={2.5}>
        {/* Column 1: lead information */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Lead Information" />
            <CardContent>
              <Field label="Contact" value={fullName} />
              <Field label="Designation" value={lead.designation} />
              <Field label="Email" value={lead.email} />
              <Field label="Mobile" value={lead.mobile} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Country" value={lead.country} />
              <Field label="City" value={lead.city} />
              <Field label="Source" value={lead.sourceChannel ? sourceChannelLabel(lead.sourceChannel) : lead.learnAbout} />
              <Field label="Assigned To" value={lead.assignedUser ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}` : 'Unassigned'} />
            </CardContent>
          </Card>

          {has('lead.edit') && (
            <Card sx={{ mt: 2.5 }}>
              <CardHeader
                title="Reclassify lead"
                titleTypographyProps={{ variant: 'subtitle1' }}
                subheaderTypographyProps={{ variant: 'caption' }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {EXTERNAL_LEAD_TYPES.map((t) => (
                    <Button key={t} size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={() => setConvertType(t)}>
                      {prettyLabel(t)}
                    </Button>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Column 2: update status / followup / remark */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                {has('lead.edit') && (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Update Status</Typography>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>New status</InputLabel>
                        <Select label="New status" value={status} onChange={(e) => setStatus(e.target.value)}>
                          {LEAD_STATUSES.map((s) => <MenuItem key={s} value={s}>{sentenceCase(s)}</MenuItem>)}
                        </Select>
                      </FormControl>

                      {/* Choosing "Follow up" reveals the follow-up fields; Save persists both together. */}
                      {status === 'FOLLOW_UP' && (
                        <>
                          <Stack direction="row" spacing={1}>
                            <TextField size="small" type="date" label="Follow-up date" InputLabelProps={{ shrink: true }} fullWidth value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
                            <TextField
                              size="small" type="time" label="Time (IST)" InputLabelProps={{ shrink: true }} fullWidth
                              value={fuTime} onChange={(e) => setFuTime(e.target.value)}
                              helperText="SMS reminder is sent to the assignee"
                            />
                          </Stack>
                          <TextField size="small" fullWidth multiline minRows={2} label="Follow-up remark" placeholder="Remark…" value={fuNote} onChange={(e) => setFuNote(e.target.value)} />
                        </>
                      )}

                      <Button
                        variant="contained"
                        disabled={!status || changing || scheduling || (status === 'FOLLOW_UP' && !fuDate)}
                        onClick={async () => {
                          await changeStatus({ id, status }).unwrap();
                          if (status === 'FOLLOW_UP') {
                            await scheduleFollowup({
                              id, followupDate: fuDate, followupTime: fuTime || undefined,
                              priority: 'MEDIUM', note: fuNote || undefined,
                            }).unwrap();
                          }
                          setStatus(''); setFuDate(''); setFuTime(''); setFuNote('');
                        }}
                      >
                        Save
                      </Button>
                    </Stack>
                    <Divider sx={{ mb: 2 }} />
                  </>
                )}
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Follow-ups</Typography>
                <Timeline items={lead.followups.map((f) => ({
                  primary: `${new Date(f.followupDate).toLocaleDateString()}${f.followupTime ? ` ${f.followupTime} IST` : ''} · ${f.priority}`,
                  secondary: `${f.status}${f.note ? ' · ' + f.note : ''}`,
                }))} empty="No follow-ups scheduled" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Remark" />
              <CardContent sx={{ pt: 0 }}>
                {has('lead.note') && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    <TextField size="small" fullWidth placeholder="Add a remark…" value={note} onChange={(e) => setNote(e.target.value)} />
                    <Button variant="contained" disabled={!note || adding} onClick={async () => { await addNote({ id, body: note }).unwrap(); setNote(''); }}>Add</Button>
                  </Stack>
                )}
                <Timeline items={lead.notes.map((n) => ({
                  primary: n.body,
                  secondary: `${new Date(n.createdAt).toLocaleString()}${n.author ? ' · ' + n.author.firstName + ' ' + n.author.lastName : ''}`,
                }))} empty="No remarks yet" />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* Column 3: status + assignment timelines */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            <Card>
              <CardHeader title="Status Timeline" />
              <CardContent sx={{ pt: 0 }}>
                <Timeline items={lead.statusHistory.map((h) => ({
                  primary: `${h.fromStatus ?? '—'} → ${h.toStatus}`,
                  secondary: `${new Date(h.createdAt).toLocaleString()}${h.changedBy ? ' · ' + h.changedBy.firstName + ' ' + h.changedBy.lastName : ''}${h.reason ? ' · ' + h.reason : ''}`,
                }))} empty="No status changes yet" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Assignment History" />
              <CardContent sx={{ pt: 0 }}>
                <Timeline items={lead.assignments.map((a) => ({
                  primary: `${a.type} → ${a.assignedTo ? a.assignedTo.firstName + ' ' + a.assignedTo.lastName : '—'}`,
                  secondary: `${new Date(a.createdAt).toLocaleString()}${a.assignedBy ? ' · by ' + a.assignedBy.firstName : ''}`,
                }))} empty="Not assigned yet" />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* convert-to-external confirm */}
      <Dialog open={!!convertType} onClose={() => setConvertType(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Convert to {convertType ? prettyLabel(convertType) : ''} lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{lead.company || fullName}” will be moved out of the exhibitor pipeline into the external
            {' '}({prettyLabel(convertType ?? 'VISITOR')}) list for the local CRM. It will no longer appear in Lead Management.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertType(null)}>Cancel</Button>
          <Button
            variant="contained" disabled={converting}
            onClick={async () => {
              if (!convertType) return;
              try {
                await convertExternal({ id, type: convertType }).unwrap();
                setToast(`Moved to ${prettyLabel(convertType)} (external) list`);
                setTimeout(() => navigate('/leads'), 800);
              } catch {
                setToast('Conversion failed');
              } finally {
                setConvertType(null);
              }
            }}
          >
            Convert
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{value || '—'}</Typography>
    </Stack>
  );
}

function Timeline({ items, empty }: { items: Array<{ primary: string; secondary: string }>; empty: string }) {
  if (!items.length) return <Typography color="text.secondary" variant="body2" sx={{ py: 1 }}>{empty}</Typography>;
  return (
    <List dense disablePadding>
      {items.map((it, i) => (
        <ListItem key={i} sx={{ borderLeft: 2, borderColor: 'primary.main', pl: 2, mb: 1 }}>
          <ListItemText primary={it.primary} secondary={it.secondary} />
        </ListItem>
      ))}
    </List>
  );
}
