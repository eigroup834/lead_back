import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Grid, Card, CardContent, CardHeader, Typography, Stack, Chip, Divider, TextField,
  Button, MenuItem, Select, FormControl, InputLabel, List, ListItem, ListItemText, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  Radio, RadioGroup, FormControlLabel, FormLabel,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EditIcon from '@mui/icons-material/Edit';
import LeadEditDialog from '@/components/LeadEditDialog';
import StatusChip from '@/components/StatusChip';
import {
  LEAD_DETAIL_STATUS_OPTIONS, EXTERNAL_LEAD_TYPES, prettyLabel, sentenceCase, statusLabel, leadSourceLabel,
  formatDate, formatDateTime,
  type ExternalLeadType,
} from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { DetailSkeleton } from '@/components/Skeletons';
import { useHistoricalDuplicateGuard } from '@/components/HistoricalDuplicateGuard';
import {
  useGetLeadQuery, useChangeStatusMutation, useAddNoteMutation,
  useScheduleFollowupMutation, useConvertExternalMutation, useAssignSingleMutation,
  useLeadEditHistoryQuery,
} from '@/features/leads/leadsApi';
import { useListUsersQuery } from '@/features/adminApi';

export default function LeadDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { has, level } = usePermissions();
  const canAssign = has('lead.assign');
  const isSuperAdmin = level === 1; 

  const { data, isLoading } = useGetLeadQuery(id, { refetchOnMountOrArgChange: true });
  const { data: users } = useListUsersQuery({ limit: 100, status: 'ACTIVE' }, { skip: !canAssign });
  const [changeStatus, { isLoading: changing }] = useChangeStatusMutation();
  const [addNote, { isLoading: adding }] = useAddNoteMutation();
  const [scheduleFollowup, { isLoading: scheduling }] = useScheduleFollowupMutation();
  const [convertExternal, { isLoading: converting }] = useConvertExternalMutation();
  const [assignSingle, { isLoading: assigning }] = useAssignSingleMutation();
  const { guard: dupGuard, dialog: dupDialog } = useHistoricalDuplicateGuard();
  const [assignTo, setAssignTo] = useState('');
  const [status, setStatus] = useState('');
  const [remark, setRemark] = useState('');
  const [sqmSpace, setSqmSpace] = useState('');
  const [spaceType, setSpaceType] = useState<'RAW' | 'SHELL'>('SHELL');
  const [fuDate, setFuDate] = useState('');
  const [fuTime, setFuTime] = useState('');
  const [convertType, setConvertType] = useState<ExternalLeadType | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = has('lead.edit');
  const { data: editHistory } = useLeadEditHistoryQuery(id, { skip: !id });

  if (isLoading) return <DetailSkeleton />;
  const lead = data?.data;
  if (!lead) return <Typography>Lead not found.</Typography>;

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—';
  const isAssigned = !!lead.assignedUser;

  // A converted lead is closed: no edit, reassign, status change or reclassify.
  // The server enforces this too; here it just keeps the controls out of the way.
  const isConverted = lead.status === 'CONVERTED';
  const spaceKind = lead.sqmSpaceType === 'RAW' ? 'Raw space'
    : lead.sqmSpaceType === 'SHELL' ? 'Shell space' : null;
  const bookedSpace = lead.sqmSpace
    ? `${lead.sqmSpace} sqm${spaceKind ? ` · ${spaceKind}` : ''}`
    : null;
  const canModify = canEdit && !isConverted;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const nowD = new Date();
  const todayStr = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`;
  const nowTimeStr = `${pad2(nowD.getHours())}:${pad2(nowD.getMinutes())}`;
  const fuTimeInvalid = fuDate === todayStr && !!fuTime && fuTime < nowTimeStr;
  const sqmValid = /^\s*\d+(\.\d+)?\s*$/.test(sqmSpace);
  const members = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const runAssign = async () => {
    try {
      await assignSingle({ leadId: lead.id, assignToId: assignTo }).unwrap();
      setAssignTo('');
      setToast('Lead assigned');
    } catch {
      setToast('Could not assign lead');
    }
  };

  const doAssign = () => dupGuard([lead.id], runAssign);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5">{lead.company || fullName}</Typography>
        <StatusChip status={lead.status} />
        {lead.priority && <Chip size="small" label={sentenceCase(lead.priority)} variant="outlined" />}
      </Stack>

      {isConverted && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {bookedSpace
            ? `Converted — ${bookedSpace} booked.`
            : 'Converted.'}{' '}
          It is now a closed record — it cannot be edited, reassigned, reclassified,
          or moved to another status.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Lead Information"
              action={canModify && (
                // Available, not advertised: recedes into the card header and only
                // picks up brand colour once you reach for it.
                <Button
                  size="small"
                  startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                  onClick={() => setEditOpen(true)}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 500,
                    minHeight: 28,
                    px: 1,
                    '&:hover': { color: 'primary.main', bgcolor: 'action.hover' },
                  }}
                >
                  Edit
                </Button>
              )}
            />
            <CardContent>
              <Field label="Contact" value={fullName} />
              <Field label="Designation" value={lead.designation} />
              <Field label="Email" value={lead.email} />
              <Field label="Mobile" value={lead.mobile} />
              <Field label="Alt. email" value={lead.altEmail} />
              <Field label="Alt. mobile" value={lead.altMobile} />
              <Field label="Industry" value={lead.industry} />
              <Field label="Country" value={lead.country} />
              <Field label="City" value={lead.city} />
              <Field label="Source" value={leadSourceLabel(lead)} />
              {lead.eventName && <Field label="Event" value={lead.eventName} />}
              {lead.shellSpace && <Field label="Space enquired" value={lead.shellSpace} />}
              <Field label="Assigned To" value={lead.assignedUser ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}` : 'Unassigned'} />
              {bookedSpace && <Field label="Space booked" value={bookedSpace} />}
            </CardContent>
          </Card>

          {canModify && (
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

        <Grid item xs={12} md={4}>
          <Stack spacing={2.5}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Assignment</Typography>
                {isAssigned ? (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    <Chip size="small" color="primary" sx={{ alignSelf: 'flex-start' }} label={`${lead.assignedUser!.firstName} ${lead.assignedUser!.lastName}`} />
                    {isSuperAdmin && !isConverted && (
                      <Stack direction="row" spacing={1}>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Reassign to</InputLabel>
                          <Select label="Reassign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                            {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
                          </Select>
                        </FormControl>
                        <Button variant="outlined" size="small" disabled={!assignTo || assigning} onClick={doAssign}>Reassign</Button>
                      </Stack>
                    )}
                  </Stack>
                ) : canAssign && !isConverted ? (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Assign to</InputLabel>
                      <Select label="Assign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                        {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <Button variant="contained" size="small" disabled={!assignTo || assigning} onClick={doAssign}>Assign</Button>
                  </Stack>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>This lead isn't assigned yet.</Alert>
                )}
                <Divider sx={{ mb: 2 }} />

                {canModify && !isAssigned && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Assign this lead to a member before updating its status.
                  </Typography>
                )}
                {canModify && isAssigned && (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Update Status</Typography>
                    <Stack spacing={1.5} sx={{ mb: 2 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>New status</InputLabel>
                        <Select label="New status" value={status} onChange={(e) => setStatus(e.target.value)}>
                          {LEAD_DETAIL_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>)}
                        </Select>
                      </FormControl>

                      {/* Choosing "Follow up" reveals the follow-up date/time. */}
                      {status === 'FOLLOW_UP' && (
                        <Stack direction="row" spacing={1}>
                          <TextField
                            size="small" type="date" label="Follow-up date" InputLabelProps={{ shrink: true }} fullWidth
                            value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                            inputProps={{ min: todayStr }}
                          />
                          <TextField
                            size="small" type="time" label="Time (IST)" InputLabelProps={{ shrink: true }} fullWidth
                            value={fuTime} onChange={(e) => setFuTime(e.target.value)}
                            inputProps={{ min: fuDate === todayStr ? nowTimeStr : undefined }}
                            error={fuTimeInvalid}
                            helperText={fuTimeInvalid ? 'Time is in the past' : 'SMS reminder is sent to the assignee'}
                          />
                        </Stack>
                      )}

                      {/* Space booked — the kind of space, then how much of it. */}
                      {status === 'CONVERTED' && (
                        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                          <FormControl>
                            <FormLabel sx={{ fontSize: 13, fontWeight: 600 }}>Space booked</FormLabel>
                            <RadioGroup
                              row
                              value={spaceType}
                              onChange={(e) => setSpaceType(e.target.value as 'RAW' | 'SHELL')}
                            >
                              <FormControlLabel value="RAW" control={<Radio size="small" />} label="Raw space" />
                              <FormControlLabel value="SHELL" control={<Radio size="small" />} label="Shell space" />
                            </RadioGroup>
                          </FormControl>
                          <TextField
                            size="small" fullWidth required label="Area booked (sqm)" type="number"
                            placeholder="e.g. 54" value={sqmSpace}
                            onChange={(e) => setSqmSpace(e.target.value)}
                            inputProps={{ min: 0, step: 'any' }}
                            error={!!sqmSpace && !sqmValid}
                            helperText={
                              !sqmSpace ? 'Required to convert'
                                : !sqmValid ? 'Enter a number, e.g. 54'
                                  : `${sqmSpace} sqm of ${spaceType === 'RAW' ? 'raw' : 'shell'} space`
                            }
                            sx={{ mt: 1 }}
                          />
                        </Box>
                      )}

                      {/* Remark travels with every status update. */}
                      <TextField size="small" fullWidth multiline minRows={2} label="Remark" placeholder="Add a remark…" value={remark} onChange={(e) => setRemark(e.target.value)} />

                      <Button
                        variant="contained"
                        disabled={!status || changing || scheduling || adding || (status === 'FOLLOW_UP' && (!fuDate || fuTimeInvalid)) || (status === 'CONVERTED' && !sqmValid)}
                        onClick={async () => {
                          await changeStatus({
                            id, status, reason: remark || undefined,
                            sqmSpace: status === 'CONVERTED' ? sqmSpace.trim() : undefined,
                            sqmSpaceType: status === 'CONVERTED' ? spaceType : undefined,
                          }).unwrap();
                          if (status === 'FOLLOW_UP') {
                            await scheduleFollowup({
                              id, followupDate: fuDate, followupTime: fuTime || undefined,
                              priority: 'MEDIUM', note: remark || undefined,
                            }).unwrap();
                          }
                          if (remark && has('lead.note')) await addNote({ id, body: remark }).unwrap();
                          setStatus(''); setFuDate(''); setFuTime(''); setRemark(''); setSqmSpace('');
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
                  primary: `${formatDate(f.followupDate)}${f.followupTime ? ` ${f.followupTime} IST` : ''} · ${f.priority}`,
                  secondary: `${f.status}${f.note ? ' · ' + f.note : ''}`,
                }))} empty="No follow-ups scheduled" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Remarks" />
              <CardContent sx={{ pt: 0 }}>
                {lead.remarks && (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      From the lead record
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{lead.remarks}</Typography>
                  </Box>
                )}
                <Timeline items={lead.notes.map((n) => ({
                  primary: n.body,
                  secondary: `${formatDateTime(n.createdAt)}${n.author ? ' · ' + n.author.firstName + ' ' + n.author.lastName : ''}`,
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
                <Timeline items={lead.statusHistory.map((h) => {
                  const reason = h.reason && h.reason !== 'Auto on assignment' ? ' · ' + h.reason : '';
                  return {
                    primary: `${h.fromStatus ? statusLabel(h.fromStatus) : '—'} → ${statusLabel(h.toStatus)}`,
                    secondary: `${formatDateTime(h.createdAt)}${h.changedBy ? ' · ' + h.changedBy.firstName + ' ' + h.changedBy.lastName : ''}${reason}`,
                  };
                })} empty="No status changes yet" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Assignment History" />
              <CardContent sx={{ pt: 0 }}>
                <Timeline items={lead.assignments.map((a) => ({
                  primary: a.assignedTo ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}` : '—',
                  secondary: `${formatDateTime(a.createdAt)}${a.assignedBy ? ' · by ' + a.assignedBy.firstName : ''}`,
                }))} empty="Not assigned yet" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Edit History" />
              <CardContent sx={{ pt: 0 }}>
                <Timeline items={(editHistory?.data ?? []).map((e) => ({
                  primary: e.changes.map((c) => `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('\n'),
                  secondary: `${formatDateTime(e.createdAt)}${e.editedBy ? ' · ' + e.editedBy.firstName + ' ' + e.editedBy.lastName : ''}`,
                }))} empty="No edits yet" />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {canModify && editOpen && (
        <LeadEditDialog
          lead={lead}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(changed) => setToast(changed ? 'Lead updated' : 'No changes to save')}
        />
      )}

      {/* convert-to-external confirm */}
      <Dialog open={!!convertType} onClose={() => setConvertType(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Convert to {convertType ? prettyLabel(convertType) : ''} lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{lead.company || fullName}” will be moved out of the exhibitor pipeline into the external
            {' '}{prettyLabel(convertType ?? 'VISITOR')} panel and queued straight for sync. It will no longer appear
            in Lead Management, and it skips Brochure Data because it is already queued.
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
                setToast(`Queued for sync to the ${prettyLabel(convertType)} panel`);
                // This page is only reachable from Assigned Leads, so go back
                // there. Lead Management is levels 1–2 only and would 403.
                setTimeout(() => navigate('/leads/assigned'), 800);
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

      {dupDialog}

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
          <ListItemText
            primary={it.primary}
            secondary={it.secondary}
            primaryTypographyProps={{ sx: { whiteSpace: 'pre-line' } }}
          />
        </ListItem>
      ))}
    </List>
  );
}
