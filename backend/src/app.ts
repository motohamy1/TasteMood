import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';

import { env } from './config/env.js';
import { standardRateLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

import { restaurantRoutes } from './modules/restaurants/routes.js';
import { branchRoutes } from './modules/branches/routes.js';
import { menuRoutes } from './modules/menus/routes.js';
import { dishRoutes } from './modules/dishes/routes.js';
import { taxonomyRoutes } from './modules/taxonomies/routes.js';
import { searchRoutes } from './modules/search/routes.js';
import { preferenceRoutes } from './modules/preferences/routes.js';
import { interactionRoutes } from './modules/interactions/routes.js';
import { recommendationRoutes } from './modules/recommendations/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { adminRoutes } from './modules/admin/routes.js';

export function createApp(): Express {
  const app = express();

  // Security & standard middleware
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(standardRateLimiter);

  // Health Check
  app.get(`${env.API_PREFIX}/health`, (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  // Swagger Documentation
  try {
    const swaggerDocPath = join(__dirname, 'docs', 'openapi.json');
    const swaggerDocument = JSON.parse(readFileSync(swaggerDocPath, 'utf-8'));
    app.use(`${env.API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  } catch {
    // Fallback if running from dist or test
  }

  // Mount API v1 Routes
  app.use(`${env.API_PREFIX}/restaurants`, restaurantRoutes);
  app.use(`${env.API_PREFIX}/branches`, branchRoutes);
  app.use(`${env.API_PREFIX}/menus`, menuRoutes);
  app.use(`${env.API_PREFIX}/dishes`, dishRoutes);
  app.use(`${env.API_PREFIX}/taxonomies`, taxonomyRoutes);
  app.use(`${env.API_PREFIX}/search`, searchRoutes);
  app.use(`${env.API_PREFIX}/recommendations`, recommendationRoutes);
  app.use(`${env.API_PREFIX}/interactions`, interactionRoutes);
  app.use(`${env.API_PREFIX}/admin`, adminRoutes);
  app.use(`${env.API_PREFIX}`, preferenceRoutes);
  app.use(`${env.API_PREFIX}`, userRoutes);

  // 404 Route Catch-All
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Cannot ${req.method} ${req.originalUrl}`,
      },
    });
  });

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
