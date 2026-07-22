import { Router } from 'express';
import { authController } from './auth.controller';
import { loginSchema } from './auth.validator';
import { validate } from '@middleware/validate.middleware';
import { authenticate } from '@middleware/auth.middleware';
import { authRateLimiter } from '@middleware/rateLimit.middleware';
import { asyncHandler } from '@utils/asyncHandler';

const router = Router();

router.post('/login', authRateLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
