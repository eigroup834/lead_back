import { api } from '@/app/api';
import type { ApiEnvelope, DashboardSummary, TeamPerf } from '@/features/types';

interface Dim { label: string; count: number }
interface FunnelItem { status: string; count: number }
interface DailyPoint { day: string; count: number }
interface MonthlyPoint { month: string; count: number; converted: number }

export interface DashFilter {
  dateFrom?: string;
  dateTo?: string;
  eventName?: string;
  country?: string;
  teamId?: string;
  userId?: string;
  days?: number;
  months?: number;
}

interface FiltersRef {
  events: string[];
  countries: string[];
  teams: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}

const clean = (f?: DashFilter | void) =>
  Object.fromEntries(Object.entries((f as DashFilter | undefined) ?? {}).filter(([, v]) => v !== undefined && v !== '' && v !== null));

export interface ConversionBySource {
  key: string;
  total: number;
  converted: number;
  conversionRate: number;
}

export interface TargetAchievement {
  userId: string;
  name: string;
  target: number;
  achieved: number;
  deals: number;
  achievedPct: number;
  remaining: number;
}

export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    dashFilters: build.query<ApiEnvelope<FiltersRef>, void>({ query: () => '/dashboard/filters', providesTags: ['Dashboard'] }),
    summary: build.query<ApiEnvelope<DashboardSummary>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/summary', params: clean(f) }), providesTags: ['Dashboard'] }),
    funnel: build.query<ApiEnvelope<FunnelItem[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/funnel', params: clean(f) }), providesTags: ['Dashboard'] }),
    byEvent: build.query<ApiEnvelope<Dim[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/by-event', params: clean(f) }), providesTags: ['Dashboard'] }),
    bySource: build.query<ApiEnvelope<Dim[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/by-source', params: clean(f) }), providesTags: ['Dashboard'] }),
    byCountry: build.query<ApiEnvelope<Dim[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/by-country', params: clean(f) }), providesTags: ['Dashboard'] }),
    dailyTrend: build.query<ApiEnvelope<DailyPoint[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/trends/daily', params: clean(f) }), providesTags: ['Dashboard'] }),
    monthlyTrend: build.query<ApiEnvelope<MonthlyPoint[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/trends/monthly', params: clean(f) }), providesTags: ['Dashboard'] }),
    conversionBySource: build.query<ApiEnvelope<ConversionBySource[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/conversion-by-source', params: clean(f) }), providesTags: ['Dashboard'] }),
    targetYears: build.query<ApiEnvelope<number[]>, void>({ query: () => ({ url: '/dashboard/target-years' }), providesTags: ['Dashboard'] }),
    targetAchievement: build.query<ApiEnvelope<TargetAchievement[]>, DashFilter & { year?: number }>({ query: (f) => ({ url: '/dashboard/target-achievement', params: clean(f) }), providesTags: ['Dashboard'] }),
    teamPerformance: build.query<ApiEnvelope<TeamPerf[]>, DashFilter | void>({ query: (f) => ({ url: '/dashboard/team-performance', params: clean(f) }), providesTags: ['Dashboard'] }),
  }),
});

export const {
  useDashFiltersQuery,
  useSummaryQuery,
  useFunnelQuery,
  useByEventQuery,
  useBySourceQuery,
  useByCountryQuery,
  useDailyTrendQuery,
  useMonthlyTrendQuery,
  useConversionBySourceQuery,
  useTargetYearsQuery,
  useTargetAchievementQuery,
  useTeamPerformanceQuery,
} = dashboardApi;
