import fs from 'fs';
import path from 'path';
import { db } from './client';

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Initializes the _migrations table if not already present
 */
async function initMigrationsTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Retrieves list of already applied migrations
 */
export async function getAppliedMigrations(): Promise<string[]> {
  await initMigrationsTable();
  const res = await db.execute('SELECT name FROM _migrations ORDER BY id ASC');
  return res.rows.map((r) => String(r.name));
}

/**
 * Runs all pending migrations in alphabetical order
 */
export async function runMigrations() {
  console.log('🔄 Checking database migrations...');
  await initMigrationsTable();

  const migrationsDir = path.resolve(process.cwd(), 'server/db/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn('⚠️ No migrations directory found at', migrationsDir);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();
  const pending = files.filter((f) => !applied.includes(f));

  if (pending.length === 0) {
    console.log('✅ Database is already up to date. (No pending migrations)');
    return;
  }

  console.log(`📦 Found ${pending.length} pending migration(s): ${pending.join(', ')}`);

  for (const file of pending) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    // Strip SQL comments cleanly
    const cleanedSql = sqlContent
      .split('\n')
      .map((line) => {
        const commentIdx = line.indexOf('--');
        return commentIdx !== -1 ? line.substring(0, commentIdx) : line;
      })
      .join('\n');

    const statements = cleanedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`🚀 Applying migration: ${file} (${statements.length} statements)...`);

    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.execute(stmt);
      }
    }

    await db.execute({
      sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, datetime('now'))",
      args: [file],
    });

    console.log(`✅ Successfully applied: ${file}`);
  }

  console.log('✨ All migrations completed successfully.');
}

/**
 * Inspect migration status
 */
export async function checkMigrationStatus() {
  await initMigrationsTable();
  const migrationsDir = path.resolve(process.cwd(), 'server/db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = await getAppliedMigrations();

  console.log('\n📋 Database Migration Status:');
  console.log('--------------------------------------------------');
  for (const file of files) {
    const isApplied = applied.includes(file);
    console.log(`${isApplied ? '✅ [APPLIED]' : '⏳ [PENDING]'} ${file}`);
  }
  console.log('--------------------------------------------------\n');
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const isStatusCheck = process.argv.includes('--status');
  if (isStatusCheck) {
    checkMigrationStatus()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('❌ Migration status check failed:', err);
        process.exit(1);
      });
  } else {
    runMigrations()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
      });
  }
}
