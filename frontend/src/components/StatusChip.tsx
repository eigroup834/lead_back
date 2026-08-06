import { Chip } from '@mui/material';
import { STATUS_COLOR, statusLabel, type LeadStatus } from '@/constants';

export default function StatusChip({ status }: { status: LeadStatus }) {
  return <Chip size="small" label={statusLabel(status)} color={STATUS_COLOR[status]} variant="filled" />;
}
