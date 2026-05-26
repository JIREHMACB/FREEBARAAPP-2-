import { pool } from '../config/db.js';

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         SERIAL PRIMARY KEY,
      name       TEXT UNIQUE NOT NULL,
      "appliedAt" TIMESTAMP DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await pool.query(`SELECT name FROM migrations`)).rows.map((r: any) => r.name)
  );

  const migrations: { name: string; sql: string }[] = [
    { name: '001_add_last_seen_users', sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "loginCount" INTEGER DEFAULT 0;` },
    { name: '002_add_permissions_table', sql: `
        CREATE TABLE IF NOT EXISTS permissions (
          id SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          resource TEXT NOT NULL, action TEXT NOT NULL, granted BOOLEAN DEFAULT TRUE,
          "grantedBy" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW(), UNIQUE("userId",resource,action)
        );` },
    { name: '003_add_user_sessions', sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          ip TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP DEFAULT NOW(),
          "lastActiveAt" TIMESTAMP DEFAULT NOW(), active BOOLEAN DEFAULT TRUE
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions("userId");` },
    { name: '004_add_audit_trail', sql: `
        CREATE TABLE IF NOT EXISTS audit_trail (
          id SERIAL PRIMARY KEY, "userId" INTEGER, action TEXT NOT NULL, resource TEXT,
          "resourceId" INTEGER, ip TEXT, "userAgent" TEXT, before JSONB, after JSONB,
          "createdAt" TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_trail("userId");
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_trail("createdAt" DESC);` },
    { name: '005_add_metrics_table', sql: `
        CREATE TABLE IF NOT EXISTS metrics (
          id SERIAL PRIMARY KEY, name TEXT NOT NULL, value NUMERIC(10,2) NOT NULL,
          tags JSONB, "createdAt" TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name,"createdAt" DESC);` },
    { name: '006_placeholder', sql: `SELECT 1` },
    { name: '007_add_profile_fields', sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "externalPortfolioUrl" TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES companies(id) ON DELETE SET NULL;` },
    { name: '008_otp_security_index', sql: `
        CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps("expiresAt");
        DELETE FROM otps WHERE "expiresAt" < NOW();` },
    { name: '009_moderation_system', sql: `
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "autoFlag" BOOLEAN DEFAULT FALSE;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "aiScore" NUMERIC(4,2);
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "aiReason" TEXT;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "reviewedBy" INTEGER;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP;
        ALTER TABLE reports ADD COLUMN IF NOT EXISTS "moderatorNote" TEXT;
        CREATE TABLE IF NOT EXISTS moderation_rules (
          id SERIAL PRIMARY KEY, pattern TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
          severity TEXT DEFAULT 'medium', action TEXT DEFAULT 'flag',
          "isActive" BOOLEAN DEFAULT TRUE, "createdBy" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS moderation_actions (
          id SERIAL PRIMARY KEY, "moderatorId" INTEGER, "targetType" TEXT NOT NULL,
          "targetId" INTEGER NOT NULL, action TEXT NOT NULL, reason TEXT,
          "automated" BOOLEAN DEFAULT FALSE, "reportId" INTEGER, "createdAt" TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS spam_counters (
          "userId" INTEGER PRIMARY KEY, "postCount" INTEGER DEFAULT 0,
          "messageCount" INTEGER DEFAULT 0, "reportCount" INTEGER DEFAULT 0,
          "flagCount" INTEGER DEFAULT 0, "lastReset" TIMESTAMP DEFAULT NOW(),
          "isMuted" BOOLEAN DEFAULT FALSE, "mutedUntil" TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status,"createdAt" DESC);
        CREATE INDEX IF NOT EXISTS idx_reports_target ON reports("targetType","targetId");
        INSERT INTO moderation_rules(pattern,type,severity,action) VALUES
          ('bit.ly','spam','medium','flag'),('tinyurl','spam','medium','flag'),
          ('buy followers','spam','high','block'),('viagra','spam','high','block'),
          ('nudes','adult','critical','block'),('terroriste','danger','critical','block'),
          ('explosif','danger','critical','block'),('arnaque','scam','high','flag'),
          ('envoie argent','scam','high','block'),('wire transfer','scam','high','flag')
        ON CONFLICT(pattern) DO NOTHING;` },
    { name: '010_privacy_policy', sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "privacyAccepted" BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS "privacyVersion" TEXT DEFAULT '1.0';` },
    { name: '011_backup_snapshots', sql: `
        CREATE TABLE IF NOT EXISTS backup_snapshots (
          id SERIAL PRIMARY KEY, type TEXT NOT NULL, counts JSONB NOT NULL,
          "sizeBytes" BIGINT, status TEXT DEFAULT 'ok', note TEXT,
          "createdAt" TIMESTAMP DEFAULT NOW()
        );` },
  ];

  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    try {
      await pool.query(m.sql);
      await pool.query(`INSERT INTO migrations(name) VALUES($1)`, [m.name]);
      console.log(`✅ Migration: ${m.name}`);
    } catch (e: any) {
      console.warn(`⚠️  Migration échouée (${m.name}): ${e.message}`);
    }
  }
}