import type { Request, Response } from 'express';
import { ok, created } from '@utils/response';
import { externalService } from './external.service';
import type { ListExternalQuery } from './external.validator';

export const externalController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await externalService.list(req.query as unknown as ListExternalQuery);
    return ok(res, items, meta);
  },

  async counts(_req: Request, res: Response) {
    const counts = await externalService.counts();
    return ok(res, counts);
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
