import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import verifyRoutes from './routes/verifyRoutes.js';
import targetRoutes from './routes/targetRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows inline styles in PDF/HTML preview
      crossOriginEmbedderPolicy: false
    })
  );

  // 2. CORS configuration
  const allowedOrigins = [env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev, lock to allowedOrigins in production
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-GitHub-Token']
    })
  );

  // 3. Rate Limiting (100 requests per 15 minutes per IP)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
  });
  app.use('/api/', limiter);

  // 4. Request Body Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 5. Request logging middleware
  app.use((req, res, next) => {
    if (req.path !== '/api/health') {
      logger.info(`${req.method} ${req.path}`);
    }
    next();
  });

  // 6. Health Check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'VibeShield Core Security Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // 7. Mount Core API Routes
  app.use('/api/verify', verifyRoutes);
  app.use('/api/targets', targetRoutes);
  app.use('/api/scans', scanRoutes);
  app.use('/api/reports', reportRoutes);

  // 8. 404 Handler
  app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });

  // 9. Centralized Error Handler (Never leaks internal stack traces)
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, { stack: env.NODE_ENV === 'development' ? err.stack : undefined });
    const statusCode = err.status || 500;
    res.status(statusCode).json({
      error: env.NODE_ENV === 'production' ? 'An internal server error occurred' : err.message
    });
  });

  return app;
}
