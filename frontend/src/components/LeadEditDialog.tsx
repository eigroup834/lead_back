import { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField,
} from '@mui/material';
import { HISTORICAL_INDUSTRIES, PRIORITIES, NAME_RE, EMAIL_RE, MOBILE_RE, sentenceCase } from '@/constants';
import { useUpdateLeadMutation } from '@/features/leads/leadsApi';
import type { LeadDetail } from '@/features/types';

const EDITABLE = [
  'title', 'company', 'firstName', 'lastName', 'designation', 'email', 'mobile',
  'altEmail', 'altMobile', 'industry', 'country', 'city', 'priority',
] as const;

type EditableKey = (typeof EDITABLE)[number];
type Form = Record<EditableKey, string>;

const toForm = (lead: LeadDetail): Form =>
  EDITABLE.reduce((acc, k) => {
    acc[k] = ((lead as unknown as Record<string, unknown>)[k] as string | null) ?? '';
    return acc;
  }, {} as Form);

function validate(form: Form): Partial<Record<EditableKey, string>> {
  const e: Partial<Record<EditableKey, string>> = {};
  if (form.company.trim() && form.company.trim().length < 2) e.company = 'At least 2 characters';
  if (form.firstName.trim() && !NAME_RE.test(form.firstName.trim())) e.firstName = 'Letters, spaces, . and - only';
  if (form.lastName.trim() && !NAME_RE.test(form.lastName.trim())) e.lastName = 'Letters, spaces, . and - only';
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email';
  if (form.altEmail.trim() && !EMAIL_RE.test(form.altEmail.trim())) e.altEmail = 'Enter a valid email';
  if (form.mobile.trim() && !MOBILE_RE.test(form.mobile.trim())) e.mobile = 'Must be 7-20 digits';
  if (form.altMobile.trim() && !MOBILE_RE.test(form.altMobile.trim())) e.altMobile = 'Must be 7-20 digits';
  return e;
}

function serverError(err: unknown): string {
  const e = err as { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } };
  const fieldErrors = e?.data?.error?.details?.fieldErrors;
  if (fieldErrors) {
    const first = Object.entries(fieldErrors).find(([, m]) => m?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  return e?.data?.error?.message || 'Could not save changes.';
}

export default function LeadEditDialog({ lead, open, onClose, onSaved }: {
  lead: LeadDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (changed: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(lead));
  const [errors, setErrors] = useState<Partial<Record<EditableKey, string>>>({});
  const [failed, setFailed] = useState('');
  const [updateLead, { isLoading }] = useUpdateLeadMutation();

  const set = (k: EditableKey) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    // Send only what actually differs, so the audit log stays meaningful.
    const original = toForm(lead);
    const body: Record<string, string> = {};
    for (const k of EDITABLE) {
      if (form[k].trim() !== original[k].trim()) body[k] = form[k].trim();
    }
    if (!Object.keys(body).length) { onSaved(false); onClose(); return; }

    setFailed('');
    try {
      await updateLead({ id: lead.id, body: body as never }).unwrap();
      onSaved(true);
      onClose();
    } catch (err) {
      setFailed(serverError(err));
    }
  };

  const text = (k: EditableKey, label: string, extra?: { required?: boolean }) => (
    <Grid item xs={12} sm={6}>
      <TextField
        size="small" fullWidth label={label} value={form[k]}
        onChange={(e) => set(k)(e.target.value)}
        error={!!errors[k]} helperText={errors[k] ?? ' '}
        required={extra?.required}
      />
    </Grid>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Edit lead</DialogTitle>
      <DialogContent dividers>
        {failed && <Alert severity="error" sx={{ mb: 2 }}>{failed}</Alert>}
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          {text('company', 'Company')}
          {text('title', 'Title')}
          {text('firstName', 'First name')}
          {text('lastName', 'Last name')}
          {text('designation', 'Designation')}
          {text('email', 'Email')}
          {text('mobile', 'Mobile')}
          {text('altEmail', 'Alternate email')}
          {text('altMobile', 'Alternate mobile')}
          <Grid item xs={12} sm={6}>
            <TextField
              select size="small" fullWidth label="Industry" value={form.industry}
              onChange={(e) => set('industry')(e.target.value)} helperText=" "
            >
              <MenuItem value="">—</MenuItem>
              {HISTORICAL_INDUSTRIES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
              {form.industry && !HISTORICAL_INDUSTRIES.includes(form.industry as never) && (
                <MenuItem value={form.industry}>{form.industry}</MenuItem>
              )}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select size="small" fullWidth label="Priority" value={form.priority}
              onChange={(e) => set('priority')(e.target.value)} helperText=" "
            >
              {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{sentenceCase(p)}</MenuItem>)}
            </TextField>
          </Grid>
          {text('city', 'City')}
          {text('country', 'Country')}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
