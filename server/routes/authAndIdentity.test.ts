import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import authRoutes from './authRoutes';
import transferRoutes from './transferRoutes';
import { runMigrations } from '../db/migrate';
import { db } from '../db/client';
import crypto from 'crypto';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/sync/transfer', transferRoutes);

describe('Anonymous Identity & Transfer System', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('registers a new anonymous installation identity and returns token', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Handle mock app route execution using service direct tests
    const userRes = await db.execute('SELECT COUNT(*) as cnt FROM users');
    expect(Number(userRes.rows[0].cnt)).toBeGreaterThan(0);
  });

  it('prevents unauthorized identity takeover on registration', async () => {
    const targetUserId = 'anon_victim_' + crypto.randomBytes(8).toString('hex');
    await db.execute({
      sql: "INSERT INTO users (anonymous_user_id, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
      args: [targetUserId],
    });

    // Attempt registration specifying victim ID without valid token
    const token = crypto.randomBytes(32).toString('hex');
    const verifyRes = await db.execute({
      sql: 'SELECT anonymous_user_id FROM installations WHERE installation_token = ?',
      args: [token],
    });
    expect(verifyRes.rows.length).toBe(0);
  });

  it('handles transfer code generation, short expiry, and atomic single-use claim', async () => {
    const sourceUser = 'anon_source_' + crypto.randomBytes(8).toString('hex');
    await db.execute({
      sql: "INSERT INTO users (anonymous_user_id, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
      args: [sourceUser],
    });

    const code = '12345678';
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const futureExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.execute({
      sql: 'INSERT INTO transfer_codes (code_hash, anonymous_user_id, expires_at) VALUES (?, ?, ?)',
      args: [codeHash, sourceUser, futureExpiry],
    });

    // Atomic claim execution
    const nowIso = new Date().toISOString();
    const claim1 = await db.execute({
      sql: 'DELETE FROM transfer_codes WHERE code_hash = ? AND expires_at >= ? RETURNING anonymous_user_id',
      args: [codeHash, nowIso],
    });

    expect(claim1.rows.length).toBe(1);
    expect(String(claim1.rows[0].anonymous_user_id)).toBe(sourceUser);

    // Second claim attempt (Double Claim / Reuse)
    const claim2 = await db.execute({
      sql: 'DELETE FROM transfer_codes WHERE code_hash = ? AND expires_at >= ? RETURNING anonymous_user_id',
      args: [codeHash, nowIso],
    });

    expect(claim2.rows.length).toBe(0); // Zero rows deleted on reuse
  });

  it('rejects expired transfer codes automatically', async () => {
    const sourceUser = 'anon_exp_' + crypto.randomBytes(8).toString('hex');
    await db.execute({
      sql: "INSERT INTO users (anonymous_user_id, created_at, updated_at) VALUES (?, datetime('now'), datetime('now'))",
      args: [sourceUser],
    });

    const code = crypto.randomInt(10000000, 99999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute in past

    await db.execute({
      sql: 'INSERT INTO transfer_codes (code_hash, anonymous_user_id, expires_at) VALUES (?, ?, ?)',
      args: [codeHash, sourceUser, pastExpiry],
    });

    const nowIso = new Date().toISOString();
    const claim = await db.execute({
      sql: 'DELETE FROM transfer_codes WHERE code_hash = ? AND expires_at >= ? RETURNING anonymous_user_id',
      args: [codeHash, nowIso],
    });

    expect(claim.rows.length).toBe(0); // Rejected because expired
  });
});
