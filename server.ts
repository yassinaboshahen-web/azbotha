import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './server/routes/authRoutes';
import insightRoutes from './server/routes/insightRoutes';
import syncRoutes from './server/routes/syncRoutes';
import transferRoutes from './server/routes/transferRoutes';
import { errorHandler } from './server/middleware/errorHandler';
import { runMigrations } from './server/db/migrate';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const tursoDbUrl = process.env.TURSO_DATABASE_URL || 'file:dev.db';
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoDbUrl) {
  console.error('❌ FATAL: TURSO_DATABASE_URL environment variable is missing.');
  process.exit(1);
}

if (!tursoDbUrl.startsWith('file:') && !tursoAuthToken) {
  console.error('❌ FATAL: TURSO_AUTH_TOKEN environment variable is required when using remote Turso database.');
  process.exit(1);
}

console.log('🔒 Environment configuration validated successfully (secrets masked).');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Production Security Headers & CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
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

// Request logger for API calls (sanitized without logging credentials/tokens)
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

async function startServer() {
  try {
    // Run pending migrations on startup (development or production)
    await runMigrations();
  } catch (migErr) {
    console.warn('⚠️ Migration notice:', migErr);
  }

  if (!isProduction) {
    // Development mode: Vite middleware integration
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built static assets from dist
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ صاحب يومك Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
