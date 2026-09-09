import { AppError } from '../errors/app-error.js';

export type CallerRole = 'USER' | 'ADMIN' | 'RESTAURANT_OWNER';

/**
 * The authenticated caller — the single concept behind the auth seam.
 * Controllers that run behind auth middleware receive one of these; they never
 * need to re-check "is there a user?" because requireCaller turns the absence
 * into the same AppError the middleware would have produced.
 */
export interface Caller {
  id: string;
  authUserId: string;
  email?: string | null;
  displayName: string;
  role: CallerRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: Caller;
    }
  }
}

/** Assert the auth middleware ran and attached a caller. */
export function requireCaller(req: { user?: Caller }): Caller {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
}
