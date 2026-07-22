import type { Job } from 'bullmq';
import { reportService, type ExportFormat, type ReportFilter } from '@modules/reports/report.service';
import { notificationQueue } from '@queues/index';
import { logger } from '@config/logger';

export interface ExportJobData {
  format: ExportFormat;
  filter: ReportFilter;
  requestedBy: string;
}

export async function exportProcessor(job: Job<ExportJobData>): Promise<unknown> {
  const { format, filter, requestedBy } = job.data;
  logger.info(`[export] job ${job.id} (${format}) started`);
  const result = await reportService.export(format, filter, String(job.id));

  // Notify the requester that their export is ready (in-app).
  await notificationQueue.add('export-ready', {
    userId: requestedBy,
    title: 'Export ready',
    body: `Your ${format.toUpperCase()} export (${result.rows} rows) is ready.`,
    data: { file: result.file, jobId: job.id },
  });

  return result;
}
