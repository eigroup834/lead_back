import { z } from 'zod';

export const assignSingleSchema = z.object({
  leadId: z.string().uuid(),
  assignToId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const assignBulkSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
  assignToId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const autoAssignSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(5000),
  poolUserIds: z.array(z.string().uuid()).min(1).optional(),
  teamId: z.string().uuid().optional(),
  strategy: z.enum(['ROUND_ROBIN']).default('ROUND_ROBIN'),
});

export type AssignSingleInput = z.infer<typeof assignSingleSchema>;
export type AssignBulkInput = z.infer<typeof assignBulkSchema>;
export type AutoAssignInput = z.infer<typeof autoAssignSchema>;
