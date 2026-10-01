import dotenv from 'dotenv';
import { app } from './server/app';
import { runMigrations } from './server/db/migrate';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  try {
    // Run pending migrations on local startup (deployment-safe migration strategy)
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
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ صاحب يومك Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
