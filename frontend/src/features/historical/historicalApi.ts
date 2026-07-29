import { api } from '@/app/api';
import type { ApiEnvelope, Lead, PageMeta } from '@/features/types';

// A historical lead is a permanent, year-tagged archive of a converted lead.
// e.g. "Tata — 2026 event". It stays here forever; moving it back to Lead
// Management for a future event creates a fresh lead and leaves this record intact.
export interface ExhHistoryEntry {
  year: number;
  sqm_spo: string;
}

export interface HistoricalLead {
  id: string;
  eventYear: number | null;
  eventName: string | null;
  company: string | null;
  name: string | null;
  email: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  designation: string | null;
  status: string;               // status the lead had when archived (typically CONVERTED)
  sourceLeadId: string | null;  // the Lead it was archived from
  restoredLeadId: string | null; // most recent lead created by moving it back, if any
  archivedAt: string;
  // Master-import fields
  histCode: string | null;
  branchOffice: string | null;
  assignedTo: string | null;
  assignedUserId: string | null;
  assignedUser: { id: string; firstName: string; lastName: string } | null; // joined from users
  industry: string | null;
  spaceSqm: string | null;
  remark: string | null;
  specialRemarks: string | null;
  exhHistory: ExhHistoryEntry[];
}

export interface HistoricalListParams {
  page?: number;
  limit?: number;
  q?: string;
  year?: number;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const historicalApi = api.injectEndpoints({
  endpoints: (build) => ({
    listHistoricalLeads: build.query<ApiEnvelope<HistoricalLead[]> & { meta: PageMeta }, HistoricalListParams>({
      query: (params) => ({ url: '/historical/leads', params }),
      providesTags: ['Historical'],
    }),
    // Distinct event years present in the archive, with counts — drives the Year filter.
    historicalYears: build.query<ApiEnvelope<Array<{ year: number; count: number }>>, void>({
      query: () => '/historical/leads/years',
      providesTags: ['Historical'],
    }),
    // Move historical lead(s) back into Lead Management as fresh leads (status New).
    // The historical record(s) are kept as the permanent archive.
    restoreHistoricalLeads: build.mutation<ApiEnvelope<{ restored: number; skipped: number; total: number }>, string[]>({
      query: (ids) => ({ url: '/historical/leads/restore', method: 'POST', body: { ids } }),
      invalidatesTags: ['Historical', 'Leads', 'Dashboard'],
    }),
    deleteHistoricalLead: build.mutation<ApiEnvelope<{ deleted: boolean }>, string>({
      query: (id) => ({ url: `/historical/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Historical'],
    }),
    // Manually add a historical lead (from the Add Lead page).
    createHistoricalLead: build.mutation<ApiEnvelope<HistoricalLead>, {
      company?: string; name?: string; designation?: string; email?: string; mobile?: string;
      city?: string; country?: string; eventName?: string; eventYear?: number; assignedUserId?: string;
    }>({
      query: (body) => ({ url: '/historical/leads', method: 'POST', body }),
      invalidatesTags: ['Historical'],
    }),
    // Edit any field on a historical lead.
    updateHistoricalLead: build.mutation<ApiEnvelope<HistoricalLead>, {
      id: string;
      company?: string | null; name?: string | null; designation?: string | null;
      email?: string | null; mobile?: string | null; city?: string | null; country?: string | null;
      eventName?: string | null; eventYear?: number | null; industry?: string | null;
      branchOffice?: string | null; remark?: string | null; specialRemarks?: string | null;
      spaceSqm?: string | null; assignedUserId?: string | null; exhHistory?: ExhHistoryEntry[];
    }>({
      query: ({ id, ...body }) => ({ url: `/historical/leads/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Historical'],
    }),
  }),
});

export const {
  useListHistoricalLeadsQuery,
  useHistoricalYearsQuery,
  useRestoreHistoricalLeadsMutation,
  useDeleteHistoricalLeadMutation,
  useCreateHistoricalLeadMutation,
  useUpdateHistoricalLeadMutation,
} = historicalApi;

// Re-export so callers that only need the Lead shape keep a stable import.
export type { Lead };
