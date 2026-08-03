import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, CardHeader, Grid, MenuItem, Stack, Tab, Tabs, TextField,
  Typography, Snackbar, Alert, FormControl, InputLabel, Select, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LeadExcelImport from '@/components/LeadExcelImport';
import PageHeader from '@/components/PageHeader';
import { useHistoricalDuplicateGuard } from '@/components/HistoricalDuplicateGuard';
import { LEAD_SOURCES, PRIORITIES, NAME_RE, EMAIL_RE, MOBILE_RE, HISTORICAL_INDUSTRIES, leadsListPath, prettyLabel } from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateLeadMutation, useAssignSingleMutation } from '@/features/leads/leadsApi';
import { useCreateHistoricalLeadMutation } from '@/features/historical/historicalApi';
import { useListUsersQuery } from '@/features/adminApi';

const empty = {
  source: 'MANUAL', leadType: 'EXHIBITION', status: 'NEW', priority: 'MEDIUM',
  title: '', firstName: '', lastName: '', designation: '', email: '', mobile: '',
  altEmail: '', altMobile: '',
  company: '', shellSpace: '', rawSpace: '', website: '', learnAbout: '', industry: '',
  address: '', city: '', state: '', zipCode: '', country: '',
  remarks: '',
};

type Form = typeof empty;

function validate(form: Form, requireAll: boolean) {
  const required = (v: string) => (requireAll && !v.trim() ? 'Required' : '');
  return {
    company: required(form.company),
    designation: required(form.designation),
    firstName: form.firstName && !NAME_RE.test(form.firstName) ? 'Letters only' : required(form.firstName),
    lastName: form.lastName && !NAME_RE.test(form.lastName) ? 'Letters only' : '',
    email: form.email ? (!EMAIL_RE.test(form.email) ? 'Enter a valid email' : '') : required(form.email),
    mobile: form.mobile ? (!MOBILE_RE.test(form.mobile) ? 'Digits only' : '') : required(form.mobile),
    altEmail: form.altEmail && !EMAIL_RE.test(form.altEmail) ? 'Enter a valid email' : '',
    altMobile: form.altMobile && !MOBILE_RE.test(form.altMobile) ? 'Digits only' : '',
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
  const { has, level } = usePermissions();
  const canAssign = has('lead.assign');
  const [form, setForm] = useState<Form>(empty);
  const [mode, setMode] = useState<'SINGLE' | 'EXCEL'>('SINGLE');
  const [destination, setDestination] = useState<'LEAD' | 'HISTORICAL'>('LEAD');
  const [assignTo, setAssignTo] = useState('');
  const [createLead, { isLoading, error }] = useCreateLeadMutation();
  const [createHistorical, { isLoading: savingHist }] = useCreateHistoricalLeadMutation();
  const [assignSingle] = useAssignSingleMutation();
  const { guard: dupGuard, dialog: dupDialog } = useHistoricalDuplicateGuard();
  const { data: users } = useListUsersQuery({ limit: 100, status: 'ACTIVE' }, { skip: !canAssign });
  const [toast, setToast] = useState<string | null>(null);

  const members = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const reqd = destination === 'LEAD';
  const errors = validate(form, reqd);
  const hasErrors = Object.values(errors).some(Boolean);

  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const markTouched = (k: keyof Form) => () => setTouched((t) => ({ ...t, [k]: true }));
  const shownError = (k: keyof typeof errors) =>
    (touched[k] || form[k] !== '') ? errors[k] : '';

  const submit = async () => {
    if (hasErrors) {
      setTouched({ company: true, firstName: true, designation: true, email: true, mobile: true });
      return;
    }
    if (destination === 'HISTORICAL') {
      await createHistorical({
        company: form.company || undefined,
        name: [form.firstName, form.lastName].filter(Boolean).join(' ') || undefined,
        designation: form.designation || undefined,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        altEmail: form.altEmail || undefined,
        altMobile: form.altMobile || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        industry: form.industry || undefined,
        assignedUserId: assignTo || undefined,
      }).unwrap();
      setToast('Added to Historical Data');
      setTimeout(() => navigate('/historical'), 700);
      return;
    }

    const payload: Record<string, unknown> = {
      source: form.source, status: form.status, priority: form.priority,
    };
    if (form.leadType) payload.leadType = form.leadType;
    (Object.keys(empty) as (keyof Form)[]).forEach((k) => {
      if (['source', 'leadType', 'status', 'priority'].includes(k)) return;
      if (form[k] !== '') payload[k] = form[k];
    });
    const res = await createLead(payload).unwrap();
    if (res.meta?.external) {
      setToast(`${prettyLabel(form.leadType || 'Visitor')} lead saved to the external list`);
      setTimeout(() => navigate(leadsListPath(level)), 900);
      return;
    }
    const goToLead = () => {
      setToast('Lead added');
      setTimeout(() => navigate(`/leads/${res.data.id}`), 600);
    };

    if (!assignTo) {
      goToLead();
      return;
    }

    await dupGuard([res.data.id], async () => {
      try { await assignSingle({ leadId: res.data.id, assignToId: assignTo }).unwrap(); } catch { }
      goToLead();
    });
  };

  return (
    <Box>
      <PageHeader
        title="Add Lead"
        subtitle="Capture a single lead, or import a batch from a spreadsheet."
        actions={<Button startIcon={<ArrowBackIcon />} onClick={() => navigate(leadsListPath(level))}>Back to leads</Button>}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{serverError(error)}</Alert>}

      <Tabs value={mode} onChange={(_e, v) => setMode(v)} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="SINGLE" label="One lead" />
        <Tab value="EXCEL" label="Import from Excel" icon={<UploadFileIcon fontSize="small" />} iconPosition="start" />
      </Tabs>

      {mode === 'EXCEL' ? (
        <Stack spacing={2.5}>
          {canAssign && (
            <Card>
              <CardContent>
                <FormControl size="small" sx={{ minWidth: 280 }}>
                  <InputLabel>Assign imported leads to (optional)</InputLabel>
                  <Select
                    label="Assign imported leads to (optional)"
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                  >
                    <MenuItem value=""><em>Leave unassigned</em></MenuItem>
                    {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
                  </Select>
                </FormControl>
              </CardContent>
            </Card>
          )}
          <LeadExcelImport
            assignToId={assignTo || undefined}
            onImported={(n) => setToast(`${n} lead(s) imported`)}
          />
        </Stack>
      ) : (
      <Stack spacing={2.5}>
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
                <TextField size="small" fullWidth label="Lead type" value="Exhibitor" disabled />
              </Grid>
              <Grid item xs={12} sm={3}>
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

        <Card>
          <CardHeader title="Contact" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={2}><TextField size="small" fullWidth label="Title" value={form.title} onChange={set('title')} /></Grid>
              <Grid item xs={6} sm={5}><TextField size="small" fullWidth required={reqd} label="First name" value={form.firstName} onChange={set('firstName')} onBlur={markTouched('firstName')} error={!!shownError('firstName')} helperText={shownError('firstName')} /></Grid>
              <Grid item xs={12} sm={5}><TextField size="small" fullWidth label="Last name" value={form.lastName} onChange={set('lastName')} onBlur={markTouched('lastName')} error={!!shownError('lastName')} helperText={shownError('lastName')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth required={reqd} label="Designation" value={form.designation} onChange={set('designation')} onBlur={markTouched('designation')} error={!!shownError('designation')} helperText={shownError('designation')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth required={reqd} label="Email" type="email" value={form.email} onChange={set('email')} onBlur={markTouched('email')} error={!!shownError('email')} helperText={shownError('email')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth required={reqd} label="Mobile" value={form.mobile} onChange={set('mobile')} onBlur={markTouched('mobile')} error={!!shownError('mobile')} helperText={shownError('mobile')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Alternate email" value={form.altEmail} onChange={set('altEmail')} onBlur={markTouched('altEmail')} error={!!shownError('altEmail')} helperText={shownError('altEmail')} /></Grid>
              <Grid item xs={12} sm={4}><TextField size="small" fullWidth label="Alternate mobile" value={form.altMobile} onChange={set('altMobile')} onBlur={markTouched('altMobile')} error={!!shownError('altMobile')} helperText={shownError('altMobile')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Company & participation" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth required={reqd} label="Company" value={form.company} onChange={set('company')} onBlur={markTouched('company')} error={!!shownError('company')} helperText={shownError('company')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Shell space" value={form.shellSpace} onChange={set('shellSpace')} /></Grid>
              <Grid item xs={12} sm={3}><TextField size="small" fullWidth label="Raw space" value={form.rawSpace} onChange={set('rawSpace')} /></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Industry</InputLabel>
                  <Select label="Industry" value={form.industry} onChange={set('industry')}>
                    <MenuItem value=""><em>Not set</em></MenuItem>
                    {HISTORICAL_INDUSTRIES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Website" value={form.website} onChange={set('website')} /></Grid>
              <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="How did they learn about us" value={form.learnAbout} onChange={set('learnAbout')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader title="Other" />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField size="small" fullWidth multiline minRows={3} label="Remarks" value={form.remarks} onChange={set('remarks')} /></Grid>
            </Grid>
          </CardContent>
        </Card>

        <Box>
          <Button variant="contained" size="large" startIcon={<SaveIcon />} disabled={isLoading || savingHist} onClick={submit}>
            {isLoading || savingHist ? 'Saving…' : destination === 'HISTORICAL' ? 'Save to Historical' : 'Save Lead'}
          </Button>
        </Box>
      </Stack>
      )}

      {dupDialog}

      <Snackbar open={!!toast} autoHideDuration={1500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity="success">{toast}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
