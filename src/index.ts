import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import api from './routes/api';
import home from './routes/home';
import settings from './routes/settings';

const app = new Hono<{ Bindings: Env }>();

// CORS middleware for Chrome extension
app.use('/api/*', cors({
  origin: (origin) => {
    if (origin?.startsWith('chrome-extension://')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// API routes
app.route('/api', api);

// Page routes
app.route('/', home);
app.route('/', settings);

export default app;
