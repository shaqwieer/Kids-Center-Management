/** Express application (no listen — see index.js). */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import api from './routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl.split(',').map((s) => s.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/', (req, res) => res.json({ service: 'Farfasha Play Center API', docs: '/api/health' }));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
