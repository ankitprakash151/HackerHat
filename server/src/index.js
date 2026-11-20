import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  try {
    // 1. Initialize Database connection
    await connectDB();

    // 2. Initialize Express application
    const app = createApp();

    // 3. Start server with automatic port conflict fallback
    const startListening = (port, fallbackPort = 5001) => {
      const server = app.listen(port, () => {
        logger.info(`🛡️ VibeShield Security Server is running on port ${port} (${env.NODE_ENV})`);
        logger.info(`API Base URL: http://localhost:${port}/api`);
      });

      server.on('error', (err) => {
        if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && fallbackPort && port !== fallbackPort) {
          logger.warn(`Port ${port} unavailable (${err.code}). Attempting fallback port ${fallbackPort}...`);
          startListening(fallbackPort, null);
        } else {
          logger.error(`Server failed to bind to port ${port}: ${err.message}`);
          process.exit(1);
        }
      });

      const handleShutdown = (signal) => {
        logger.info(`Received ${signal}. Shutting down gracefully...`);
        server.close(() => {
          logger.info('VibeShield HTTP server closed.');
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
      process.on('SIGINT', () => handleShutdown('SIGINT'));

      return server;
    };

    startListening(env.PORT);
  } catch (err) {
    logger.error(`Fatal bootstrap error: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();
