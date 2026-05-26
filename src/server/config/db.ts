import pkg from 'pg';
import { createHash } from 'crypto';

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL!.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
});

export const db = {
  one: async (sql: string, p?: any[]) => { const r = await pool.query(sql, p); return r.rows[0] || null; },
  all: async (sql: string, p?: any[]) => { const r = await pool.query(sql, p); return r.rows; },
  run: (sql: string, p?: any[]) => pool.query(sql, p),
};

const OTP_SALT = process.env.OTP_SALT || process.env.JWT_SECRET || 'freebara-otp-salt';
export const hashOtp = (code: string): string =>
  createHash('sha256').update(code + OTP_SALT).digest('hex');