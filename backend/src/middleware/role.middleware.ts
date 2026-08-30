import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error.js';

export function requireRole(...allowedRoles: Array<'USER' | 'ADMIN' | 'RESTAURANT_OWNER'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden(`Requires one of roles: [${allowedRoles.join(', ')}]`));
    }

    next();
  };
}
