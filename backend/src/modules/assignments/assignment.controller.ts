import type { Request, Response } from 'express';
import { ok } from '@utils/response';
import { assignmentService } from './assignment.service';

export const assignmentController = {
  async single(req: Request, res: Response) {
    const result = await assignmentService.single(req.body, req.user!.id);
    return ok(res, result);
  },

  async bulk(req: Request, res: Response) {
    const result = await assignmentService.bulk(req.body, req.user!.id);
    return ok(res, result);
  },

  async auto(req: Request, res: Response) {
    const result = await assignmentService.auto(req.body, req.user!.id);
    return ok(res, result);
  },
};
