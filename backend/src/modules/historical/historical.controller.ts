import type { Request, Response } from 'express';
import { ok, created } from '@utils/response';
import { historicalService } from './historical.service';
import type { ListHistoricalLeadsQuery } from './historical.validator';

export const historicalController = {








  async listLeads(req: Request, res: Response) {
    const { items, meta } = await historicalService.listLeads(req.user!, req.query as unknown as ListHistoricalLeadsQuery);
    return ok(res, items, meta);
  },

  async years(_req: Request, res: Response) {
    const years = await historicalService.years();
    return ok(res, years);
  },

  async industries(req: Request, res: Response) {
    const industries = await historicalService.industries(req.user!);
    return ok(res, industries);
  },

  async leadHistory(req: Request, res: Response) {
    const edits = await historicalService.leadHistory(req.user!, req.params.id);
    return ok(res, edits);
  },

  async restore(req: Request, res: Response) {
    const result = await historicalService.restore(req.user!, req.body);
    return ok(res, result);
  },

  async removeLead(req: Request, res: Response) {
    const result = await historicalService.removeLead(req.user!, req.params.id);
    return ok(res, result);
  },

  async restoreRemovedLead(req: Request, res: Response) {
    const result = await historicalService.restoreRemovedLead(req.user!, req.params.id);
    return ok(res, result);
  },

  async createLead(req: Request, res: Response) {
    const lead = await historicalService.createLead(req.body);
    return created(res, lead);
  },

  async updateLead(req: Request, res: Response) {
    const lead = await historicalService.updateLead(req.user!, req.params.id, req.body);
    return ok(res, lead);
  },
};
