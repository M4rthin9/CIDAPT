import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestIdMiddleware } from './middleware/request-id';
import { toErrorResponse, getErrorStatus } from './errors';
import { getLogger, createLogger } from './logger';
import { loadEnv } from './config';
import health from './routes/health';
import authRoutes from './routes/auth';
import settings from './routes/settings';
import upload from './routes/upload';

const env = loadEnv();
createLogger(env);
const log = getLogger();
const app = new Hono();

// Global middleware
app.use('*', requestIdMiddleware);
app.use('*', cors({ origin: env.APP_URL, credentials: true }));

// Health
app.route('/', health);

// Auth
app.route('/api/v1/auth', authRoutes);

// Settings (superadmin only)
app.route('/api/v1/settings', settings);

// Upload (admin+)
app.route('/api/v1/upload', upload);

// Global error handler
app.onError((err, c) => {
  const requestId = c.get('requestId');
  const status = getErrorStatus(err);
  const body = toErrorResponse(err, requestId);
  return c.json(body, status as any);
});

// 404
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'not_found',
        message_th: 'ไม่พบหน้า',
        message_en: 'Not found',
        request_id: c.get('requestId'),
      },
    },
    404,
  );
});

const port = env.PORT;
log.info({ port, env: env.NODE_ENV }, `API server starting on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
