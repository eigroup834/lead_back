import { z } from 'zod';

export const LEAD_STATUSES = [
  'NEW', 'ASSIGNED', 'CONTACTED', 'NOT_REACHABLE', 'INTERESTED', 'NOT_INTERESTED',
  'FOLLOW_UP', 'HOT', 'WARM', 'COLD', 'CONVERTED', 'INVALID', 'LOST',
] as const;

export const SORTABLE = [
  'createdAt', 'createDate', 'company', 'status', 'firstName', 'email', 'mobile',
  'country', 'sourceChannel', 'shellSpace', 'remarks', 'assignedUser',
] as const;

export const LEAD_SOURCES = [
  'WEBSITE', 'MANUAL', 'REFERRAL', 'WALK_IN', 'EMAIL', 'PHONE', 'SOCIAL_MEDIA', 'PARTNER', 'HISTORICAL', 'OTHER',
] as const;

export const LEAD_TYPES = ['EXHIBITION', 'VISITOR', 'DELEGATE', 'SPEAKER'] as const;

export const LEAD_SOURCE_CHANNELS = ['SPACE_BOOKING', 'POST_SHOW_DOWNLOAD', 'GOOGLE', 'LINKEDIN', 'META'] as const;

export const listLeadsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  status: z
    .union([z.enum(LEAD_STATUSES), z.array(z.enum(LEAD_STATUSES))])
    .optional()
    .transform((v) => (v ? (Array.isArray(v) ? v : [v]) : undefined)),
  eventName: z.string().trim().optional(),
  country: z.string().trim().optional(),
  sourceChannel: z.enum(LEAD_SOURCE_CHANNELS).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedUserId: z.string().uuid().optional(),
  unassigned: z.coerce.boolean().optional(),
  assigned: z.coerce.boolean().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(SORTABLE).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuery>;

export const updateLeadSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  altEmail: z.string().optional(),
  altMobile: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const createLeadSchema = z.object({
  title: z.string().trim().max(50).optional(),
  company: z.string().trim().min(1, 'Company is required').max(200),
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().max(100).optional(),
  designation: z.string().trim().min(1, 'Designation is required').max(150),
  shellSpace: z.string().trim().max(100).optional(),
  rawSpace: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email').max(200),
  mobile: z.string().trim().min(7, 'Mobile is required').max(40),
  altEmail: z.string().trim().max(200).optional().or(z.literal(''))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Enter a valid alternate email' }),
  altMobile: z.string().trim().max(40).optional().or(z.literal(''))
    .refine((v) => !v || /^[+]?[\d\s-]{7,20}$/.test(v), { message: 'Alternate mobile must be 7-20 digits' }),
  website: z.string().trim().max(200).optional(),
  industry: z.string().trim().min(1, 'Industry is required').max(150),
  learnAbout: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(2000).optional(),
  eventName: z.string().trim().max(200).optional(),
  createDate: z.coerce.date().optional(),
  source: z.enum(LEAD_SOURCES).default('MANUAL'),
  leadType: z.enum(LEAD_TYPES).optional(),
  status: z.enum(LEAD_STATUSES).default('NEW'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const BULK_IMPORT_MAX = 2000;

export const bulkImportRow = z.object({
  row: z.coerce.number().int().min(1),
  title: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  designation: z.string().trim().max(150).optional(),
  email: z.string().trim().max(200).optional(),
  mobile: z.string().trim().max(40).optional(),
  altEmail: z.string().trim().max(200).optional(),
  altMobile: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().max(200).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  shellSpace: z.string().trim().max(100).optional(),
  rawSpace: z.string().trim().max(100).optional(),
  learnAbout: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(150).optional(),
  eventName: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(2000).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});
export type BulkImportRow = z.infer<typeof bulkImportRow>;

export const bulkImportSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(BULK_IMPORT_MAX),
  assignToId: z.string().uuid().optional(),
  skipDuplicates: z.coerce.boolean().default(true),
});
export type BulkImportInput = z.infer<typeof bulkImportSchema>;

export const historicalMatchSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
});
export type HistoricalMatchInput = z.infer<typeof historicalMatchSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  reason: z.string().max(500).optional(),
  sqmSpace: z.string().trim().max(100).optional(),
});

export const convertExternalSchema = z.object({
  type: z.enum(['VISITOR', 'DELEGATE', 'SPEAKER']),
});

export const archiveHistoricalSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(5000),
  eventYear: z.coerce.number().int().min(2000).max(2100),
});
export type ArchiveHistoricalInput = z.infer<typeof archiveHistoricalSchema>;

export const idParam = z.object({ id: z.string().uuid() });
