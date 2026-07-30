import { z } from 'zod';

export const EXTERNAL_CATEGORIES = ['VISITOR', 'DELEGATE', 'SPEAKER', 'OTHER'] as const;

export const EXTERNAL_SORTABLE = [
  'createdAt', 'createDate', 'company', 'category', 'email', 'mobile',
  'designation', 'eventName', 'assignedUser',
] as const;

export const listExternalQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  category: z.enum(EXTERNAL_CATEGORIES).optional(),
  sortBy: z.enum(EXTERNAL_SORTABLE).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListExternalQuery = z.infer<typeof listExternalQuery>;

export const idParam = z.object({ id: z.string().uuid() });

export const bulkConvertSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});
export type BulkConvertInput = z.infer<typeof bulkConvertSchema>;

export const reclassifySchema = z.object({
  category: z.enum(EXTERNAL_CATEGORIES),
});
export type ReclassifyInput = z.infer<typeof reclassifySchema>;

export const assignExternalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  assignToId: z.string().uuid(),
});
export type AssignExternalInput = z.infer<typeof assignExternalSchema>;

export const syncExternalSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});
export type SyncExternalInput = z.infer<typeof syncExternalSchema>;
