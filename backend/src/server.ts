import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';
import { prisma } from './database/prisma.client.js';

async function startServer() {
  try {
    // Verify database connection
    await prisma.$connect();
    logger.info('Connected to database successfully.');

    const server = app.listen(env.PORT, () => {
      logger.info(`TasteMood API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
      logger.info(`Documentation available at http://localhost:${env.PORT}${env.API_PREFIX}/docs`);
    });

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected. Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
