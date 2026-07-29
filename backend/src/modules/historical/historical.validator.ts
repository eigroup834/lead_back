import { z } from 'zod';

// Lead fields a historical-sheet column can be mapped onto. These are the "basic
// fields" that stay the same across every rep's differently-shaped spreadsheet.
export const MAPPABLE_LEAD_FIELDS = [
  'company', 'firstName', 'lastName', 'designation',
  'email', 'mobile', 'phone', 'website',
  'address', 'city', 'state', 'country',
  'eventName', 'remarks', 'createDate',
] as const;
export type MappableLeadField = (typeof MAPPABLE_LEAD_FIELDS)[number];

const MAX_ROWS = 20000;

// mapping: { leadField -> sheet column header }. Only known lead fields are allowed
// as keys; the value is whatever the rep named that column.
const mappingSchema = z
  .record(z.enum(MAPPABLE_LEAD_FIELDS), z.string().trim().max(300))
  .optional();

// One parsed sheet row: an object keyed by the sheet's own column headers.
const rowDataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const createUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sheetName: z.string().trim().max(255).optional(),
  columns: z.array(z.string().max(300)).min(1).max(200),
  mapping: mappingSchema,
  rows: z.array(rowDataSchema).min(1).max(MAX_ROWS),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const updateUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255).optional(),
    mapping: mappingSchema,
  })
  .refine((d) => d.fileName !== undefined || d.mapping !== undefined, {
    message: 'Nothing to update',
  });
export type UpdateUploadInput = z.infer<typeof updateUploadSchema>;

// Optional per-conversion overrides / classification.
const convertOverrides = z
  .object({
    company: z.string().trim().max(200).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    designation: z.string().trim().max(150).optional(),
    email: z.string().trim().max(200).optional(),
    mobile: z.string().trim().max(40).optional(),
    phone: z.string().trim().max(40).optional(),
    website: z.string().trim().max(200).optional(),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    eventName: z.string().trim().max(200).optional(),
    remarks: z.string().trim().max(4000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  })
  .partial();

export const convertRowSchema = z.object({
  overrides: convertOverrides.optional(),
});
export type ConvertRowInput = z.infer<typeof convertRowSchema>;

// Bulk convert: explicit rowIds, or all not-yet-converted rows when omitted.
export const convertBulkSchema = z.object({
  rowIds: z.array(z.string().uuid()).max(MAX_ROWS).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});
export type ConvertBulkInput = z.infer<typeof convertBulkSchema>;

export const listRowsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  converted: z.enum(['true', 'false']).optional(),
});
export type ListRowsQuery = z.infer<typeof listRowsQuery>;

export const idParam = z.object({ id: z.string().uuid() });
export const uploadRowParams = z.object({ id: z.string().uuid(), rowId: z.string().uuid() });

// -------- Historical leads (year-tagged archive of converted leads) --------

export const listHistoricalLeadsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  assigneeId: z.string().uuid().optional(), // managers: filter by team member
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListHistoricalLeadsQuery = z.infer<typeof listHistoricalLeadsQuery>;

// Move historical lead(s) back to Lead Management as fresh leads.
export const restoreHistoricalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5000),
});
export type RestoreHistoricalInput = z.infer<typeof restoreHistoricalSchema>;

// Manually add a historical lead (from the Add Lead page).
export const createHistoricalLeadSchema = z
  .object({
    company: z.string().trim().max(200).optional(),
    name: z.string().trim().max(200).optional(),
    designation: z.string().trim().max(150).optional(),
    email: z.string().email().optional().or(z.literal('')),
    mobile: z.string().trim().max(40).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    eventName: z.string().trim().max(200).optional(),
    eventYear: z.coerce.number().int().min(2000).max(2100).optional(),
    assignedUserId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.company || d.name || d.email || d.mobile), {
    message: 'Provide at least a company, name, email, or mobile',
  });
export type CreateHistoricalLeadInput = z.infer<typeof createHistoricalLeadSchema>;

// Edit any field on a historical lead. All optional; only provided fields change.
const exhHistoryEntry = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  sqm_spo: z.string().trim().max(200),
});
export const updateHistoricalLeadSchema = z.object({
  company: z.string().trim().max(200).nullable().optional(),
  name: z.string().trim().max(200).nullable().optional(),
  designation: z.string().trim().max(150).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  mobile: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  eventName: z.string().trim().max(200).nullable().optional(),
  eventYear: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
  industry: z.string().trim().max(150).nullable().optional(),
  branchOffice: z.string().trim().max(150).nullable().optional(),
  remark: z.string().trim().max(4000).nullable().optional(),
  specialRemarks: z.string().trim().max(4000).nullable().optional(),
  spaceSqm: z.string().trim().max(100).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  exhHistory: z.array(exhHistoryEntry).max(50).optional(),
});
export type UpdateHistoricalLeadInput = z.infer<typeof updateHistoricalLeadSchema>;
