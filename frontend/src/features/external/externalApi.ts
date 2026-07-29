import { api } from '@/app/api';
import type { ApiEnvelope, Lead, PageMeta } from '@/features/types';
import type { ExternalCategory } from '@/constants';

export type { ExternalCategory };

export interface ExternalLead {
  id: string;
  category: ExternalCategory;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  designation: string | null;
  company: string | null;
  industry: string | null;
  businessInterest: string | null;
  eventName: string | null;
  createDate: string | null;
  createdAt: string;
  // Sync lifecycle — set once queued for the cron job that pushes leads to their panel.
  syncStatus?: 'PENDING' | 'SYNCED' | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
}

export interface ExternalListParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const externalApi = api.injectEndpoints({
  endpoints: (build) => ({
    listExternalLeads: build.query<ApiEnvelope<ExternalLead[]> & { meta: PageMeta }, ExternalListParams>({
      query: (params) => ({ url: '/external-leads', params }),
      providesTags: ['External'],
    }),
    externalCounts: build.query<ApiEnvelope<Record<string, number>>, void>({
      query: () => '/external-leads/counts',
      providesTags: ['External'],
    }),
    convertToExhibitor: build.mutation<ApiEnvelope<Lead>, string>({
      query: (id) => ({ url: `/external-leads/${id}/convert-exhibitor`, method: 'POST' }),
      invalidatesTags: ['External', 'Leads', 'Dashboard'],
    }),
    bulkConvertToExhibitor: build.mutation<ApiEnvelope<{ converted: number; skipped: number; total: number }>, string[]>({
      query: (ids) => ({ url: '/external-leads/convert-exhibitor/bulk', method: 'POST', body: { ids } }),
      invalidatesTags: ['External', 'Leads', 'Dashboard'],
    }),
    // Reclassify within Other Leads (visitor / delegate / speaker / other) — stays in this panel.
    reclassifyExternalLead: build.mutation<ApiEnvelope<ExternalLead>, { id: string; category: ExternalCategory }>({
      query: ({ id, category }) => ({ url: `/external-leads/${id}/reclassify`, method: 'PATCH', body: { category } }),
      invalidatesTags: ['External'],
    }),
    // Assign brochure lead(s) to a user.
    assignExternalLeads: build.mutation<ApiEnvelope<{ assigned: number; total: number }>, { ids: string[]; assignToId: string }>({
      query: (body) => ({ url: '/external-leads/assign', method: 'POST', body }),
      invalidatesTags: ['External'],
    }),
    // Queue lead(s) for sync — a cron job later pushes them to their respective panel.
    syncExternalLeads: build.mutation<ApiEnvelope<{ queued: number; total: number }>, string[]>({
      query: (ids) => ({ url: '/external-leads/sync', method: 'POST', body: { ids } }),
      invalidatesTags: ['External'],
    }),
  }),
});

export const {
  useListExternalLeadsQuery,
  useExternalCountsQuery,
  useConvertToExhibitorMutation,
  useBulkConvertToExhibitorMutation,
  useReclassifyExternalLeadMutation,
  useAssignExternalLeadsMutation,
  useSyncExternalLeadsMutation,
} = externalApi;
