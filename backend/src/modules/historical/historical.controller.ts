import type { Request, Response } from 'express';
import { ok, created } from '@utils/response';
import { historicalService } from './historical.service';
import type { ListHistoricalLeadsQuery, ListRowsQuery } from './historical.validator';

export const historicalController = {
  async create(req: Request, res: Response) {
    const upload = await historicalService.create(req.user!, req.body);
    return created(res, upload);
  },

  async list(req: Request, res: Response) {
    const uploads = await historicalService.listUploads(req.user!);
    return ok(res, uploads);
  },

  async get(req: Request, res: Response) {
    const upload = await historicalService.getUpload(req.user!, req.params.id);
    return ok(res, upload);
  },

  async rows(req: Request, res: Response) {
    const { items, meta } = await historicalService.listRows(
      req.user!,
      req.params.id,
      req.query as unknown as ListRowsQuery,
    );
    return ok(res, items, meta);
  },

  async update(req: Request, res: Response) {
    const upload = await historicalService.update(req.user!, req.params.id, req.body);
    return ok(res, upload);
  },

  async remove(req: Request, res: Response) {
    await historicalService.remove(req.user!, req.params.id);
    return ok(res, { deleted: true });
  },

  async convertRow(req: Request, res: Response) {
    const lead = await historicalService.convertRow(req.user!, req.params.id, req.params.rowId, req.body);
    return created(res, lead);
  },

  async convertBulk(req: Request, res: Response) {
    const result = await historicalService.convertBulk(req.user!, req.params.id, req.body);
    return ok(res, result);
  },

  // -------- Historical leads (year-tagged archive) --------

  async listLeads(req: Request, res: Response) {
    const { items, meta } = await historicalService.listLeads(req.user!, req.query as unknown as ListHistoricalLeadsQuery);
    return ok(res, items, meta);
  },

  async years(_req: Request, res: Response) {
    const years = await historicalService.years();
    return ok(res, years);
  },

  async restore(req: Request, res: Response) {
    const result = await historicalService.restore(req.user!.id, req.body);
    return ok(res, result);
  },

  async removeLead(req: Request, res: Response) {
    const result = await historicalService.removeLead(req.params.id);
    return ok(res, result);
  },

  async createLead(req: Request, res: Response) {
    const lead = await historicalService.createLead(req.body);
    return created(res, lead);
  },

  async updateLead(req: Request, res: Response) {
    const lead = await historicalService.updateLead(req.params.id, req.body);
    return ok(res, lead);
  },
};
