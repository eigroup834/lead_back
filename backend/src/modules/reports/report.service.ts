import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { prisma } from '@config/prisma';
import { env } from '@config/env';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ReportFilter {
  status?: string[];
  eventName?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
}

const COLUMNS = [
  { key: 'company', header: 'Company' },
  { key: 'firstName', header: 'First Name' },
  { key: 'lastName', header: 'Last Name' },
  { key: 'email', header: 'Email' },
  { key: 'mobile', header: 'Mobile' },
  { key: 'country', header: 'Country' },
  { key: 'eventName', header: 'Event' },
  { key: 'status', header: 'Status' },
  { key: 'createDate', header: 'Registered' },
];

function buildWhere(f: ReportFilter): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { deletedAt: null };
  if (f.status?.length) where.status = { in: f.status as never };
  if (f.eventName) where.eventName = f.eventName;
  if (f.country) where.country = f.country;
  if (f.dateFrom || f.dateTo) {
    where.createDate = {};
    if (f.dateFrom) (where.createDate as Prisma.DateTimeFilter).gte = new Date(f.dateFrom);
    if (f.dateTo) (where.createDate as Prisma.DateTimeFilter).lte = new Date(f.dateTo);
  }
  return where;
}

function storagePath(file: string): string {
  const dir = path.resolve(env.LOCAL_STORAGE_PATH, 'exports');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, file);
}

export const reportService = {
  async export(format: ExportFormat, filter: ReportFilter, jobId: string): Promise<{ file: string; rows: number }> {
    const where = buildWhere(filter);
    const fileName = `leads-${jobId}.${format === 'excel' ? 'xlsx' : format}`;
    const outPath = storagePath(fileName);
    let rows = 0;
    const BATCH = 5000;

    if (format === 'csv') {
      const stream = fs.createWriteStream(outPath);
      stream.write(COLUMNS.map((c) => c.header).join(',') + '\n');
      let cursor: string | undefined;
      for (;;) {
        const batch = await prisma.lead.findMany({
          where, take: BATCH, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
        });
        if (!batch.length) break;
        for (const lead of batch) {
          stream.write(COLUMNS.map((c) => csvCell((lead as never)[c.key])).join(',') + '\n');
        }
        rows += batch.length;
        cursor = batch[batch.length - 1].id;
        if (batch.length < BATCH) break;
      }
      await new Promise<void>((res) => stream.end(res));
    } else if (format === 'excel') {
      const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: outPath });
      const ws = wb.addWorksheet('Leads');
      ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 22 }));
      let cursor: string | undefined;
      for (;;) {
        const batch = await prisma.lead.findMany({
          where, take: BATCH, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' },
        });
        if (!batch.length) break;
        for (const lead of batch) ws.addRow(lead).commit();
        rows += batch.length;
        cursor = batch[batch.length - 1].id;
        if (batch.length < BATCH) break;
      }
      await wb.commit();
    } else {
      const grouped = await prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(fs.createWriteStream(outPath));
      doc.fontSize(18).text('Exhibitor CRM — Lead Report', { align: 'center' }).moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`).moveDown();
      grouped.forEach((g) => {
        rows += g._count._all;
        doc.fontSize(12).text(`${g.status}: ${g._count._all}`);
      });
      doc.moveDown().fontSize(12).text(`Total: ${rows}`);
      doc.end();
    }

    return { file: fileName, rows };
  },
};

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
