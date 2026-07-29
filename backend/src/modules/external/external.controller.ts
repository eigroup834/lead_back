import type { Request, Response } from 'express';
import { ok, created } from '@utils/response';
import { externalService } from './external.service';
import type { ListExternalQuery } from './external.validator';

export const externalController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await externalService.list(req.user!, req.query as unknown as ListExternalQuery);
    return ok(res, items, meta);
  },

  async counts(req: Request, res: Response) {
    const counts = await externalService.counts(req.user!);
    return ok(res, counts);
  },

  async assign(req: Request, res: Response) {
    const result = await externalService.assign(req.body.ids, req.body.assignToId);
    return ok(res, result);
  },

  async sync(req: Request, res: Response) {
    const result = await externalService.sync(req.body.ids);
    return ok(res, result);
  },

  async reclassify(req: Request, res: Response) {
    const lead = await externalService.reclassify(req.params.id, req.body.category);
    return ok(res, lead);
  },

  async convertToExhibitor(req: Request, res: Response) {
    const lead = await externalService.convertToExhibitor(req.params.id);
    return created(res, lead);
  },

  async bulkConvertToExhibitor(req: Request, res: Response) {
    const result = await externalService.bulkConvertToExhibitor(req.body.ids);
    return ok(res, result);
  },
};
