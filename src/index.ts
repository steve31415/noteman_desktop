import { Hono } from 'hono';
import type { Env } from './types';
import api from './routes/api';
import home from './routes/home';
import settings from './routes/settings';

const app = new Hono<{ Bindings: Env }>();

// API routes
app.route('/api', api);

// Page routes
app.route('/', home);
app.route('/', settings);

export default app;
