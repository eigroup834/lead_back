import { z } from 'zod';

export const EXTERNAL_CATEGORIES = ['VISITOR', 'DELEGATE', 'SPEAKER', 'OTHER'] as const;

export const listExternalQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  category: z.enum(EXTERNAL_CATEGORIES).optional(),
  sortBy: z.enum(['createdAt', 'createDate', 'company', 'category']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListExternalQuery = z.infer<typeof listExternalQuery>;

export const idParam = z.object({ id: z.string().uuid() });

export const bulkConvertSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});
export type BulkConvertInput = z.infer<typeof bulkConvertSchema>;
