import { createClient, Client, InStatement } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:dev.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

// Create centralized libSQL/Turso client
export const db: Client = createClient({
  url,
  authToken: url.startsWith('file:') ? undefined : authToken,
});

/**
 * Execute multiple statements inside an atomic transaction
 */
export async function runTransaction(statements: InStatement[]) {
  return await db.batch(statements, 'write');
}

/**
 * Helper to safely query a single record
 */
export async function queryOne<T = Record<string, unknown>>(
  statement: InStatement
): Promise<T | null> {
  const result = await db.execute(statement);
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as T;
}

/**
 * Helper to safely query multiple records
 */
export async function queryMany<T = Record<string, unknown>>(
  statement: InStatement
): Promise<T[]> {
  const result = await db.execute(statement);
  return result.rows as unknown as T[];
}
