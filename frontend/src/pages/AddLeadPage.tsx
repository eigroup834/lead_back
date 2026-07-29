import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CardHeader, Grid, MenuItem, Stack, TextField,
  Typography, Snackbar, Alert, FormControl, InputLabel, Select, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { LEAD_SOURCES, PRIORITIES, prettyLabel } from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateLeadMutation, useAssignSingleMutation } from '@/features/leads/leadsApi';
import { useCreateHistoricalLeadMutation } from '@/features/historical/historicalApi';
import { useListUsersQuery } from '@/features/adminApi';

const empty = {
  // classification
  source: 'MANUAL', leadType: 'EXHIBITION', status: 'NEW', priority: 'MEDIUM',
  // contact
  title: '', firstName: '', lastName: '', designation: '', email: '', mobile: '',
  // company / participation
  company: '', shellSpace: '', rawSpace: '', website: '', learnAbout: '',
  // address
  address: '', city: '', state: '', zipCode: '', country: '',
  // other
  remarks: '',
};

type Form = typeof empty;

// Basic client-side validation.
const NAME_RE = /^[A-Za-z\s.'-]+$/;             // alphabetic (+ common name punctuation)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[+]?[\d\s-]{7,20}$/;         // digits (optional +, spaces, dashes)

function validate(form: Form) {
  return {
    firstName: form.firstName && !NAME_RE.test(form.firstName) ? 'Letters only' : '',
    lastName: form.lastName && !NAME_RE.test(form.lastName) ? 'Letters only' : '',
    email: form.email && !EMAIL_RE.test(form.email) ? 'Enter a valid email' : '',
    mobile: form.mobile && !MOBILE_RE.test(form.mobile) ? 'Digits only' : '',
  };
}

function serverError(error: unknown): string {
  const data = (error as { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } } } })?.data;
  const e = data?.error;
  if (!e) return 'Could not save lead. Please try again.';
  const fe = e.details?.fieldErrors;
  if (fe) {
    const first = Object.entries(fe).find(([, m]) => m?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  if (e.details?.formErrors?.length) return e.details.formErrors[0];
  return e.message ?? 'Could not save lead.';
}

export default function AddLeadPage() {
  const navigate = useNavigate();
  const { has } = usePermissions();
  const canAssign = has('lead.assign');
  const [form, setForm] = useState<Form>(empty);
  const [destination, setDestination] = useState<'LEAD' | 'HISTORICAL'>('LEAD');
  const [assignTo, setAssignTo] = useState('');
  const [createLead, { isLoading, error }] = useCreateLeadMutation();
  const [createHistorical, { isLoading: savingHist }] = useCreateHistoricalLeadMutation();
  const [assignSingle] = useAssignSingleMutation();
  const { data: users } = useListUsersQuery(undefined, { skip: !canAssign });
  const [toast, setToast] = useState<string | null>(null);

  const members = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const errors = validate(form);
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    if (destination === 'HISTORICAL') {
      await createHistorical({
        company: form.company || undefined,
        name: [form.firstName, form.lastName].filter(Boolean).join(' ') || undefined,
        designation: form.designation || undefined,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        assignedUserId: assignTo || undefined,
      }).unwrap();
      setToast('Added to Historical Data');
      setTimeout(() => navigate('/historical'), 700);
      return;
    }

    // Send classification fields always; drop empty optional text fields.
    const payload: Record<string, unknown> = {
      source: form.source, status: form.status, priority: form.priority,
    };
    if (form.leadType) payload.leadType = form.leadType;
    (Object.keys(empty) as (keyof Form)[]).forEach((k) => {
      if (['source', 'leadType', 'status', 'priority'].includes(k)) return;
      if (form[k] !== '') payload[k] = form[k];
    });
    const res = await createLead(payload).unwrap();
    // Visitor/Delegate/Speaker are stored in the external (local-CRM) list, which
    // has no detail page here — just confirm and return to the leads list.
    if (res.meta?.external) {
      setToast(`${prettyLabel(form.leadType || 'Visitor')} lead saved to the external list`);
      setTimeout(() => navigate('/leads'), 900);
      return;
    }
    // Optionally assign to a member on creation → lands in that member's Assigned Leads.
    if (assignTo) {
      try { await assignSingle({ leadId: res.data.id, assignToId: assignTo }).unwrap(); } catch { /* non-fatal */ }
    }
    setToast('Lead added');
    setTimeout(() => navigate(`/leads/${res.data.id}`), 600);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Add Lead</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/leads')}>Back to leads</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{serverError(error)}</Alert>}

      <Stack spacing={2.5}>
        {/* Destination + assignment */}
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>Add to</Typography>
                <ToggleButtonGroup
                  size="small" exclusive color="primary" value={destination}
                  onChange={(_e, v) => v && setDestination(v)}
                >
                  <ToggleButton value="LEAD">Lead Management</ToggleButton>
                  <ToggleButton value="HISTORICAL">Historical Data</ToggleButton>
                </ToggleButtonGroup>
              </Grid>
              {canAssign && (
                <Grid item xs={12} sm={6}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Assign to (optional)</InputLabel>
                    <Select label="Assign to (optional)" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Classification — only relevant for Lead Management */}
        {destination === 'LEAD' && (
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField size="small" select fullWidth label="Source" value={form.source} onChange={set('source')}>
                  {LEAD_SOURCES.map((s) => <MenuItem key={s} value={s}>{prettyLabel(s)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                {/* Manually added leads are always Exhibitor leads. */}
                <TextField size="small" fullWidth label="Lead type" value="Exhibitor" disabled />
              </Grid>
              <Grid item xs={12} sm={3}>
                {/* New leads always start as New; status changes later on the lead page. */}
                <TextField size="small" fullWidth label="Status" value="New" disabled helperText="New leads start as New" />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField size="small" select fullWidth label="Priority" value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{prettyLabel(p)}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        )}

        {/* Contact */}
        <Card>
          <CardHeader title="Contact" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={2}><TextField size="small" fullWidth label="Title" value={form.title} onChange={set('title')} /></Grid>
              <Grid item xs={6} sm={5}><TextField size="small" fullWidth label="First name" value={form.firstName} onChange={set('firstName')} error={!!errors.firstName} helperText={errors.firstName} /></Grid>
              <Grid item xs={12} sm={5}><TextField size="small" fullWidth label="Last name" value={form.lastName} onChange={set('lastName')} error={!!errors.lastName} helperText={errors.lastName} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Designation" value={form.designation} onChange={set('designation')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Email" type="email" value={form.email} onChange={set('email')} error={!!errors.email} helperText={errors.email} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Mobile" value={form.mobile} onChange={set('mobile')} error={!!errors.mobile} helperText={errors.mobile} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Company & participation */}
        <Card>
          <CardHeader title="Company & participation" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Company" value={form.company} onChange={set('company')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Shell space" value={form.shellSpace} onChange={set('shellSpace')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Raw space" value={form.rawSpace} onChange={set('rawSpace')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Website" value={form.website} onChange={set('website')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="How did they learn about us" value={form.learnAbout} onChange={set('learnAbout')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader title="Address" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField size="small" fullWidth label="Address" value={form.address} onChange={set('address')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="City" value={form.city} onChange={set('city')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="State" value={form.state} onChange={set('state')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Zip code" value={form.zipCode} onChange={set('zipCode')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Country" value={form.country} onChange={set('country')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Other */}
        <Card>
          <CardHeader title="Other" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField size="small" fullWidth multiline minRows={3} label="Remarks" value={form.remarks} onChange={set('remarks')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        <Box>
          <Button variant="contained" size="large" startIcon={<SaveIcon />} disabled={isLoading || savingHist || hasErrors} onClick={submit}>
            {isLoading || savingHist ? 'Saving…' : destination === 'HISTORICAL' ? 'Save to Historical' : 'Save Lead'}
          </Button>
        </Box>
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={1500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity="success">{toast}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
