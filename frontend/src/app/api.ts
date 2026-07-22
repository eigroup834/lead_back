import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQuery';

// Single API slice; feature endpoints are injected via api.injectEndpoints.
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Lead', 'Leads', 'Followup', 'User', 'Role', 'Dashboard', 'Notification', 'Sync', 'Historical', 'External'],
  endpoints: () => ({}),
});
