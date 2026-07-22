import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CardHeader, Grid, MenuItem, Stack, TextField,
  Typography, Snackbar, Alert,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  LEAD_SOURCES, LEAD_TYPES, LEAD_STATUSES, PRIORITIES, EXTERNAL_LEAD_TYPES,
  prettyLabel, sentenceCase,
} from '@/constants';
import { useCreateLeadMutation } from '@/features/leads/leadsApi';

const empty = {
  // classification
  source: 'MANUAL', leadType: '', status: 'NEW', priority: 'MEDIUM',
  // contact
  title: '', firstName: '', lastName: '', designation: '', email: '', mobile: '', phone: '',
  // company / participation
  company: '', shellSpace: '', rawSpace: '', website: '', learnAbout: '',
  // address
  address: '', city: '', state: '', zipCode: '', country: '',
  // other
  remarks: '',
};

type Form = typeof empty;

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
  const [form, setForm] = useState<Form>(empty);
  const [createLead, { isLoading, error }] = useCreateLeadMutation();
  const [toast, setToast] = useState<string | null>(null);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
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
    } else {
      setToast('Lead added');
      setTimeout(() => navigate(`/leads/${res.data.id}`), 600);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">Add Lead</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/leads')}>Back to leads</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{serverError(error)}</Alert>}

      <Stack spacing={2.5}>
        {/* Classification */}
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField size="small" select fullWidth label="Source" value={form.source} onChange={set('source')}>
                  {LEAD_SOURCES.map((s) => <MenuItem key={s} value={s}>{prettyLabel(s)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  size="small" select fullWidth label="Lead type" value={form.leadType} onChange={set('leadType')}
                  helperText={(EXTERNAL_LEAD_TYPES as readonly string[]).includes(form.leadType) ? 'Saved to external list (local CRM)' : ' '}
                >
                  <MenuItem value="">—</MenuItem>
                  {LEAD_TYPES.map((t) => <MenuItem key={t} value={t}>{prettyLabel(t)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField size="small" select fullWidth label="Status" value={form.status} onChange={set('status')}>
                  {LEAD_STATUSES.map((s) => <MenuItem key={s} value={s}>{sentenceCase(s)}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField size="small" select fullWidth label="Priority" value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{prettyLabel(p)}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader title="Contact" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={2}><TextField size="small" fullWidth label="Title" value={form.title} onChange={set('title')} /></Grid>
              <Grid item xs={6} sm={5}><TextField size="small" fullWidth label="First name" value={form.firstName} onChange={set('firstName')} /></Grid>
              <Grid item xs={12} sm={5}><TextField size="small" fullWidth label="Last name" value={form.lastName} onChange={set('lastName')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Designation" value={form.designation} onChange={set('designation')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Email" type="email" value={form.email} onChange={set('email')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Mobile" value={form.mobile} onChange={set('mobile')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Phone" value={form.phone} onChange={set('phone')} /></Grid>
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
          <Button variant="contained" size="large" startIcon={<SaveIcon />} disabled={isLoading} onClick={submit}>
            {isLoading ? 'Saving…' : 'Save Lead'}
          </Button>
        </Box>
      </Stack>

      <Snackbar open={!!toast} autoHideDuration={1500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity="success">{toast}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
