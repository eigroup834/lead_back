import { z } from 'zod';











export const idParam = z.object({ id: z.string().uuid() });

export const HISTORICAL_INDUSTRIES = [
  'AI, Agentic AI & Machine Learning',
  'Broadband, Fiber Optic & Cables',
  'Cybersecurity',
  'Datacenter & Cloud',
  'Fintech & Banking',
  'Green Technology, Energy Tech & ESG',
  'Information & Communications Technologies (ICT)',
  'IoT, Edge Computing & Digital Twins',
  'IPTV & OTT Streaming',
  'Mobile Devices, Accessories',
  'Robotics, Drones & Autonomous Systems',
  'Satellite Communications & Space Tech',
  'Security & Surveillance',
  'Semiconductors & Electronics Manufacturing',
  'Smart Devices',
  'Smart Future Cities & Digital Infrastructure',
  'Smart Mobility & Connected Vehicles',
  'Startups, Innovation Hubs & Incubators',
  'Telecom, 5G, 6G & Network Infrastructure',
] as const;

export const HISTORICAL_SORTABLE = [
  'archivedAt', 'eventYear', 'company', 'name', 'designation', 'email', 'mobile',
  'city', 'country', 'industry', 'remark', 'assignedUser',
] as const;

export const listHistoricalLeadsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  assigneeId: z.string().uuid().optional(),
  industry: z.string().trim().max(150).optional(),
  noIndustry: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(HISTORICAL_SORTABLE).default('eventYear'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListHistoricalLeadsQuery = z.infer<typeof listHistoricalLeadsQuery>;

export const restoreHistoricalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5000),
});
export type RestoreHistoricalInput = z.infer<typeof restoreHistoricalSchema>;

export const createHistoricalLeadSchema = z
  .object({
    company: z.string().trim().max(200).optional(),
    name: z.string().trim().max(200).optional(),
    designation: z.string().trim().max(150).optional(),
    email: z.string().email().optional().or(z.literal('')),
    mobile: z.string().trim().max(40).optional(),
    altEmail: z.string().trim().max(200).optional().or(z.literal(''))
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Enter a valid alternate email' }),
    altMobile: z.string().trim().max(40).optional()
      .refine((v) => !v || /^[+]?[\d\s-]{7,20}$/.test(v), { message: 'Alternate mobile must be 7-20 digits' }),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    industry: z.string().trim().max(150).optional().or(z.literal('')),
    eventName: z.string().trim().max(200).optional(),
    eventYear: z.coerce.number().int().min(2000).max(2100).optional(),
    assignedUserId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.company || d.name || d.email || d.mobile), {
    message: 'Provide at least a company, name, email, or mobile',
  });
export type CreateHistoricalLeadInput = z.infer<typeof createHistoricalLeadSchema>;

const exhHistoryEntry = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  sqm_spo: z.string().trim().max(200),
});
const optionalPattern = (re: RegExp, message: string, max: number) =>
  z.string().trim().max(max).nullable().optional()
    .refine((v) => !v || re.test(v), { message });

export const updateHistoricalLeadSchema = z.object({
  company: z.string().trim().max(200).nullable().optional()
    .refine((v) => !v || v.length >= 2, { message: 'Company must be at least 2 characters' }),
  name: optionalPattern(/^[A-Za-z\s.'-]+$/, 'Name may only contain letters, spaces, . and -', 200),
  designation: z.string().trim().max(150).nullable().optional(),
  email: optionalPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email', 200),
  mobile: optionalPattern(/^[+]?[\d\s-]{7,20}$/, 'Mobile must be 7-20 digits', 40),
  altEmail: optionalPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid alternate email', 200),
  altMobile: optionalPattern(/^[+]?[\d\s-]{7,20}$/, 'Alternate mobile must be 7-20 digits', 40),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  eventName: z.string().trim().max(200).nullable().optional(),
  eventYear: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
  industry: z.string().trim().max(150).nullable().optional(),
  branchOffice: z.string().trim().max(150).nullable().optional(),
  lastContactMeet: z.string().trim().max(100).nullable().optional(),
  lastContactEmail: z.string().trim().max(100).nullable().optional(),
  lastContactMobile: z.string().trim().max(100).nullable().optional(),
  remark: z.string().trim().max(4000).nullable().optional(),
  specialRemarks: z.string().trim().max(4000).nullable().optional(),
  spaceSqm: z.string().trim().max(100).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  exhHistory: z.array(exhHistoryEntry).max(50).optional(),
});
export type UpdateHistoricalLeadInput = z.infer<typeof updateHistoricalLeadSchema>;
