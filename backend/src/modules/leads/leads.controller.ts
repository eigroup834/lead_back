import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { ok, created } from '@utils/response';
import { leadsService } from './leads.service';
import type { ListLeadsQuery } from './leads.validator';

const EXPORT_COLUMNS = [
  { header: 'Company', key: 'company', width: 28 },
  { header: 'Title', key: 'title', width: 8 },
  { header: 'First Name', key: 'firstName', width: 16 },
  { header: 'Last Name', key: 'lastName', width: 16 },
  { header: 'Designation', key: 'designation', width: 20 },
  { header: 'Email', key: 'email', width: 26 },
  { header: 'Mobile', key: 'mobile', width: 16 },
  { header: 'Alt Email', key: 'altEmail', width: 26 },
  { header: 'Alt Mobile', key: 'altMobile', width: 16 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'City', key: 'city', width: 14 },
  { header: 'State', key: 'state', width: 14 },
  { header: 'Country', key: 'country', width: 14 },
  { header: 'Event', key: 'eventName', width: 24 },
  { header: 'Shell Space', key: 'shellSpace', width: 14 },
  { header: 'Source', key: 'source', width: 14 },
  { header: 'Lead Type', key: 'leadType', width: 14 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Assigned To', key: 'assignedTo', width: 20 },
  { header: 'Registered', key: 'createDate', width: 14 },
  { header: 'Added On', key: 'createdAt', width: 14 },
];

const dateOnly = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const leadsController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await leadsService.list(req.user!, req.query as unknown as ListLeadsQuery);
    return ok(res, items, meta);
  },

  async create(req: Request, res: Response) {
    const { external, record } = await leadsService.create(req.body, req.user!.id);
    return created(res, record, { external });
  },

  async exportXlsx(req: Request, res: Response) {
    const rows = await leadsService.exportRows(req.user!, req.query as unknown as ListLeadsQuery);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Leads');
    ws.columns = EXPORT_COLUMNS;
    ws.getRow(1).font = { bold: true };

    for (const r of rows) {
      ws.addRow({
        ...r,
        assignedTo: r.assignedUser ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}` : '',
        createDate: dateOnly(r.createDate),
        createdAt: dateOnly(r.createdAt),
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  },

  async get(req: Request, res: Response) {
    const lead = await leadsService.get(req.params.id);
    return ok(res, lead);
  },

  async update(req: Request, res: Response) {
    const lead = await leadsService.update(req.params.id, req.body, req.user!.id);
    return ok(res, lead);
  },

  async editHistory(req: Request, res: Response) {
    return ok(res, await leadsService.editHistory(req.params.id));
  },

  async changeStatus(req: Request, res: Response) {
    const lead = await leadsService.changeStatus(
      req.params.id, req.body.status, req.user!.id, req.body.reason, req.body.sqmSpace, req.body.sqmSpaceType,
    );
    return ok(res, lead);
  },

  async remove(req: Request, res: Response) {
    await leadsService.softDelete(req.params.id);
    return ok(res, { deleted: true });
  },

  async addNote(req: Request, res: Response) {
    const note = await leadsService.addNote(req.params.id, req.user!.id, req.body.body);
    return created(res, note);
  },

  async convertExternal(req: Request, res: Response) {
    const record = await leadsService.convertToExternal(req.params.id, req.body.type);
    return ok(res, record, { external: true });
  },

  async historicalMatches(req: Request, res: Response) {
    const result = await leadsService.historicalMatches(req.body);
    return ok(res, result);
  },

  async bulkImport(req: Request, res: Response) {
    const result = await leadsService.bulkImport(req.user!.id, req.body);
    return ok(res, result);
  },

  async archiveHistorical(req: Request, res: Response) {
    const result = await leadsService.archiveToHistorical(req.user!.id, req.body.leadIds, req.body.eventYear);
    return ok(res, result);
  },
};
