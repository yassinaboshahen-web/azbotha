import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import insightRoutes from './routes/insightRoutes';
import syncRoutes from './routes/syncRoutes';
import transferRoutes from './routes/transferRoutes';
import taskRoutes from './routes/taskRoutes';
import eventRoutes from './routes/eventRoutes';
import notificationRoutes from './routes/notificationRoutes';
import preferenceRoutes from './routes/preferenceRoutes';
import reminderRoutes from './routes/reminderRoutes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const tursoDbUrl = process.env.TURSO_DATABASE_URL || 'file:dev.db';
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoDbUrl) {
  console.error('❌ FATAL: TURSO_DATABASE_URL environment variable is missing.');
}

if (!tursoDbUrl.startsWith('file:') && !tursoAuthToken) {
  console.error('❌ FATAL: TURSO_AUTH_TOKEN environment variable is required when using remote Turso database.');
}

export const app = express();

// Trust reverse proxy hops for accurate client IP resolution in rate limiting
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);

// Production Security Headers & CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https: http:;"
  );
  
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://localhost,capacitor://localhost,http://localhost').split(',');
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Anonymous-User-Id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logger for API calls (sanitized)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

app.use(express.json({ limit: '100kb' }));

// API Routes (Mounted under /api/*)
app.use('/api/auth', authRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sync/transfer', transferRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/reminders', reminderRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: process.env.TURSO_DATABASE_URL ? 'turso_configured' : 'local_dev_libsql',
  });
});

// Centralized API Error Handling
app.use(errorHandler);

// Production static asset fallback if running via Node.js server
if (isProduction && !process.env.VERCEL) {
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}
