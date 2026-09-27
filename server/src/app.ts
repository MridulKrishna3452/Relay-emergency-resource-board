import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './lib/env';
import { errorHandler, notFoundHandler } from './lib/errors';
import { attachUser } from './middleware/auth';
import { authRouter } from './routes/auth';
import { requestsRouter } from './routes/requests';
import { adminRouter } from './routes/admin';
import { metaRouter } from './routes/meta';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(attachUser);

  // This port only serves the API. Send people who open it in a browser to the web app.
  app.get('/', (_req, res) => res.redirect(env.CLIENT_ORIGIN));
  app.get('/api', (_req, res) => {
    res.json({ name: 'Relay API', status: 'ok', app: env.CLIENT_ORIGIN, health: '/api/health' });
  });

  app.use('/api', metaRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
