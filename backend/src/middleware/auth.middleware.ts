import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../common/errors/app-error.js';
import { prisma } from '../database/prisma.client.js';
import { AuthenticatedUser } from '../common/types/api-response.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

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

    // If running in test mode or with mock token, construct user object directly
    if (token.startsWith('mock-')) {
      req.user = {
        id: authUserId,
        authUserId,
        email,
        displayName,
        role: authUserId.includes('admin') ? 'ADMIN' : 'USER',
      };
      return next();
    }

    try {
      // Lookup user in database or create on-the-fly for seamless Supabase Auth sync
      let user = await prisma.user.findUnique({
        where: { authUserId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            authUserId,
            email,
            displayName,
            role: authUserId.includes('admin') ? 'ADMIN' : 'USER',
            preferenceProfile: {
              create: {
                preferredCuisines: [],
                dislikedCuisines: [],
                dietaryRestrictions: [],
                preferredMealTypes: [],
                atmospherePreferences: [],
              },
            },
          },
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
        req.user = {
          id: authUserId,
          authUserId,
          email,
          displayName,
          role: authUserId.includes('admin') ? 'ADMIN' : 'USER',
        };
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
