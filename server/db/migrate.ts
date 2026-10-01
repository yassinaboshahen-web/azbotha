import fs from 'fs';
import path from 'path';
import { db } from './client';

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Robustly parses multi-statement SQL text into individual statements,
 * taking into account single-line comments (--), block comments (/* *\/),
 * and string literals ('...' and "...").
 */
export function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inSingleLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1] || '';

    // Handle single line comments
    if (inSingleLineComment) {
      if (char === '\n') {
        inSingleLineComment = false;
      }
      continue;
    }

    // Handle block comments
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    // Check comment start outside strings
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        inSingleLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    // Handle quote toggling
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }

    // Statement boundary
    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trimmedEnd = current.trim();
  if (trimmedEnd.length > 0) {
    statements.push(trimmedEnd);
  }

  return statements;
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
 * Executes a single migration file atomically with idempotent fallback handling
 */
async function applyMigrationFile(fileName: string, statements: string[]): Promise<void> {
  if (statements.length === 0) return;

  try {
    // Attempt atomic execution using libSQL batch
    await db.batch(
      statements.map((stmt) => ({ sql: stmt, args: [] })),
      'write'
    );
  } catch (err: any) {
    const errMsg = String(err?.message || err).toLowerCase();
    
    // Idempotency check: if error is due to duplicate column name, execute statement by statement safely
    if (errMsg.includes('duplicate column name') || errMsg.includes('already exists')) {
      console.warn(`[Migrate] Retrying ${fileName} with statement-level idempotency fallback...`);
      for (const stmt of statements) {
        try {
          await db.execute(stmt);
        } catch (stmtErr: any) {
          const sMsg = String(stmtErr?.message || stmtErr).toLowerCase();
          if (!sMsg.includes('duplicate column name') && !sMsg.includes('already exists')) {
            throw stmtErr;
          }
        }
      }
    } else {
      throw err;
    }
  }

  // Record completed migration
  await db.execute({
    sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, datetime('now'))",
    args: [fileName],
  });
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
    const statements = splitSqlStatements(sqlContent);

    console.log(`🚀 Applying migration: ${file} (${statements.length} statement(s))...`);

    try {
      await applyMigrationFile(file, statements);
      console.log(`✅ Successfully applied: ${file}`);
    } catch (err) {
      console.error(`❌ Migration failed on ${file}:`, err);
      throw err; // Stop migration sequence immediately on error
    }
  }

  console.log('✨ All database migrations completed successfully.');
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
