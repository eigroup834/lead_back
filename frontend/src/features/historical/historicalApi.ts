import { api } from '@/app/api';
import type { ApiEnvelope, Lead, PageMeta } from '@/features/types';

// A historical lead is a permanent, year-tagged archive of a converted lead.
// e.g. "Tata — 2026 event". It stays here forever; moving it back to Lead
// Management for a future event creates a fresh lead and leaves this record intact.
export interface HistoricalLead {
  id: string;
  eventYear: number;
  eventName: string | null;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  designation: string | null;
  status: string;               // status the lead had when archived (typically CONVERTED)
  sourceLeadId: string | null;  // the Lead it was archived from
  restoredLeadId: string | null; // most recent lead created by moving it back, if any
  archivedAt: string;
}

export interface HistoricalListParams {
  page?: number;
  limit?: number;
  q?: string;
  year?: number;
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
  }),
});

export const {
  useListHistoricalLeadsQuery,
  useHistoricalYearsQuery,
  useRestoreHistoricalLeadsMutation,
  useDeleteHistoricalLeadMutation,
} = historicalApi;

// Re-export so callers that only need the Lead shape keep a stable import.
export type { Lead };
