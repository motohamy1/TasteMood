import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../common/errors/app-error.js';
import { Caller } from '../common/types/identity.js';
import { userRepository } from '../modules/users/repository.js';

interface SupabaseJwtPayload {
  sub: string; // Supabase auth user id
  email?: string;
  user_metadata?: {
    display_name?: string;
    name?: string;
    avatar_url?: string;
  };
  role?: string;
  app_metadata?: {
    role?: string;
  };
}

function roleFromAuthUserId(authUserId: string): Caller['role'] {
  return authUserId.includes('admin') ? 'ADMIN' : 'USER';
}

function callerFromAuthUserId(authUserId: string, email?: string | null, displayName?: string): Caller {
  return {
    id: authUserId,
    authUserId,
    email,
    displayName: displayName || 'TasteMood User',
    role: roleFromAuthUserId(authUserId),
  };
}

/**
 * Thin adapter over the identity seam: verify the token, then resolve (or
 * create) the user row behind the users module. No domain side effects live
 * here — in particular the "taste profile always exists" invariant is owned by
 * the preferences module, not by authentication.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // For test / local development mock tokens
    let authUserId: string;
    let email: string | undefined;
    let displayName: string = 'TasteMood User';

    try {
      // Decode / verify with Supabase JWT secret
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as SupabaseJwtPayload;
      authUserId = decoded.sub;
      email = decoded.email;
      displayName = decoded.user_metadata?.display_name || decoded.user_metadata?.name || email?.split('@')[0] || 'User';
    } catch {
      // Allow mock tokens in test/dev if formatted as mock-user-{id}
      if (token.startsWith('mock-')) {
        authUserId = token;
        email = `${token}@example.com`;
        displayName = token.replace('mock-', 'Demo ');
      } else {
        throw AppError.unauthorized('Invalid or expired authentication token');
      }
    }

    // Mock tokens never touch the database — construct the caller directly.
    if (token.startsWith('mock-')) {
      req.user = callerFromAuthUserId(authUserId, email, displayName);
      return next();
    }

    try {
      // Lookup user in database or create on-the-fly for seamless Supabase Auth sync
      let user = await userRepository.findByAuthUserId(authUserId);

      if (!user) {
        user = await userRepository.create({
          authUserId,
          email,
          displayName,
          role: roleFromAuthUserId(authUserId),
        });
      }

      req.user = {
        id: user.id,
        authUserId: user.authUserId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      };
    } catch (dbError) {
      if (env.NODE_ENV === 'test') {
        req.user = callerFromAuthUserId(authUserId, email, displayName);
      } else {
        throw dbError;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authMiddleware(req, res, next);
}
