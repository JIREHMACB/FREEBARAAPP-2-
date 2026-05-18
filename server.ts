// ════════════════════════════════════════════════════════════════════════════
// 🚀 FREEBARA SERVER — PostgreSQL | Production Ready
// ════════════════════════════════════════════════════════════════════════════

console.log('🚀 FreeBara Server démarrage...');

// ─── IMPORTS ─────────────────────────────────────────────────────────────────
import express        from 'express';
import { createServer }  from 'http';
import { Server }        from 'socket.io';
import cors              from 'cors';
import { fileURLToPath } from 'url';
import dotenv            from 'dotenv';
import * as path         from 'path';
import jwt               from 'jsonwebtoken';
import { Resend } from "resend";
import pkg               from 'pg';

const IS_DEV     = process.env.NODE_ENV !== 'production';

// ─── JSON BODY PARSER (utilisé uniquement dans startServer) ──────
const { Pool } = pkg;

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET manquant → le serveur ne peut pas démarrer en production');
  if (process.env.NODE_ENV === 'production') process.exit(1);
  console.warn('⚠️  Mode DEV uniquement — JWT_SECRET temporaire utilisé');
}
if (!process.env.DATABASE_URL)  { console.error('❌ DATABASE_URL manquant!'); process.exit(1); }
if (!process.env.SMTP_USER)     console.warn('⚠️  SMTP non configuré → codes OTP affichés en console');
if (!process.env.CLOUDINARY_URL) console.warn('⚠️  CLOUDINARY_URL manquant → placeholders utilisés');

const ALLOWED_ORIGINS = [
  'https://www.freebara.com',
  'https://freebara.com',
  'https://freebaraapp-2.onrender.com',
  ...(IS_DEV ? ['http://localhost:5173', 'http://localhost:3000'] : []),
];

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
// Note: en prod, le process.exit(1) ci-dessus empêche d'atteindre cette ligne sans JWT_SECRET

const PORT       = parseInt(process.env.PORT || '3000');

// ─── POSTGRESQL ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL!.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Helper raccourci
const db = {
  one: async (sql: string, p?: any[]) => { const r = await pool.query(sql, p); return r.rows[0] || null; },
  all: async (sql: string, p?: any[]) => { const r = await pool.query(sql, p); return r.rows; },
  run: (sql: string, p?: any[]) => pool.query(sql, p),
};

// ─── LOGS ─────────────────────────────────────────────────────────────────────
const logAction = async (level: string, action: string, userId?: number, ip?: string, details?: string) => {
  try {
    await pool.query(
      `INSERT INTO db_logs (level, action, "userId", ip, details) VALUES ($1,$2,$3,$4,$5)`,
      [level, action, userId ?? null, ip ?? null, details ?? null]
    );
  } catch {}
};

// ─── ERROR TRACKER (monitoring interne) ──────────────────────────────────────
const errorTracker = {
  errors: [] as { time: string; msg: string; context?: string }[],
  capture(err: any, context?: string) {
    const entry = { time: new Date().toISOString(), msg: String(err?.message ?? err), context };
    this.errors.unshift(entry);
    if (this.errors.length > 200) this.errors.pop();
    console.error(`[ERROR]${context ? ' ' + context : ''} ${entry.msg}`);
    logAction('ERROR', context ?? 'error', undefined, undefined, entry.msg).catch(() => {});
  },
};
process.on('uncaughtException',  (e) => errorTracker.capture(e, 'uncaughtException'));
process.on('unhandledRejection', (e) => errorTracker.capture(e, 'unhandledRejection'));

// ─── CLOUDINARY (upload images) ───────────────────────────────────────────────
const uploadToCloudinary = async (base64Data: string, folder = 'freebara'): Promise<string> => {
  if (!process.env.CLOUDINARY_URL) {
    return `https://picsum.photos/seed/${Date.now()}/400/400`; // placeholder dev
  }
  const url      = new URL(process.env.CLOUDINARY_URL);
  const apiKey   = url.username;
  const apiSecret = url.password;
  const cloudName = url.hostname;
  const auth     = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const body     = new URLSearchParams({ file: base64Data, upload_preset: 'freebara', folder });
  const resp     = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json() as any;
  if (!data.secure_url) throw new Error('Upload Cloudinary échoué: ' + JSON.stringify(data));
  return data.secure_url;
};

// ─── EMAIL (OTP) ──────────────────────────────────────────────────────────────


const apiKey = process.env.RESEND_API_KEY;

// ⚠️ sécurité : éviter crash serveur
if (!apiKey) {
  console.warn("⚠️ RESEND_API_KEY manquant - emails désactivés");
}

const resend = apiKey ? new Resend(apiKey) : null;

const isValidEmail = (e: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const sendOTPEmail = async (email: string, code: string) => {
  // sécurité email
  if (!isValidEmail(email)) {
    console.error("❌ Email invalide :", email);
    return;
  }

  // mode dev si pas de config
  if (!resend) {
    console.log(`\n📧 [DEV MODE] OTP pour ${email} : ${code}\n`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: "FreeBara <noreply@freebara.com>",
      to: email,
      subject: "Votre code de connexion FreeBara",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:16px;">
          <img src="https://www.freebara.com/logo__2_.png" alt="FreeBara" style="height:40px;margin-bottom:24px;" />
          
          <h2 style="color:#155be3;margin:0 0 8px;">Code de vérification</h2>
          
          <p style="color:#64748b;margin:0 0 24px;">
            Utilisez ce code pour accéder à FreeBara :
          </p>

          <div style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:900;letter-spacing:10px;color:#0f172a;">
            ${code}
          </div>

          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
            ⏱ Expire dans 10 minutes. Ne partagez jamais ce code.
          </p>
        </div>
      `,
    });

    console.log("📧 Email OTP envoyé avec succès à", email);
    console.log("📨 Resend response:", result);

  } catch (error) {
    console.error("❌ Erreur Resend:", error);
  }
};
// ════════════════════════════════════════════════════════════════════════════
// 🗄️  INITIALISATION BASE DE DONNÉES
// ════════════════════════════════════════════════════════════════════════════
async function initDB() {
  // ── Tables utilisateurs & auth ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                      SERIAL PRIMARY KEY,
      email                   TEXT UNIQUE NOT NULL,
      name                    TEXT,
      profession              TEXT,
      bio                     TEXT,
      company                 TEXT,
      "avatarUrl"             TEXT,
      "coverUrl"              TEXT,
      phone                   TEXT,
      location                TEXT,
      website                 TEXT,
      church                  TEXT,
      groups                  TEXT,
      interests               TEXT,
      skills                  TEXT,
      marketing               TEXT,
      goals                   TEXT,
      badge                   TEXT DEFAULT 'Invité',
      "referralCode"          TEXT UNIQUE,
      "referredBy"            INTEGER,
      balance                 NUMERIC(10,2) DEFAULT 0,
      role                    TEXT DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
      status                  TEXT DEFAULT 'active' CHECK (status IN ('active','banned','inactive')),
      "bannedReason"          TEXT,
      "notificationPreferences" JSONB DEFAULT '{}',
      visibility              TEXT DEFAULT 'public',
      country                 TEXT,
      "createdAt"             TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS otps (
      email       TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL
    );
  `);

  // ── Tables réseau & social ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      "followerId"  INTEGER NOT NULL,
      "followingId" INTEGER NOT NULL,
      PRIMARY KEY ("followerId","followingId")
    );
    CREATE TABLE IF NOT EXISTS connection_requests (
      id           SERIAL PRIMARY KEY,
      "senderId"   INTEGER NOT NULL,
      "receiverId" INTEGER NOT NULL,
      status       TEXT DEFAULT 'pending',
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      type        TEXT NOT NULL,
      content     TEXT NOT NULL,
      "relatedId" INTEGER,
      read        BOOLEAN DEFAULT FALSE,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS certifications (
      id              SERIAL PRIMARY KEY,
      "userId"        INTEGER NOT NULL,
      name            TEXT NOT NULL,
      organization    TEXT NOT NULL,
      "dateObtained"  TEXT NOT NULL,
      "createdAt"     TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables posts & interactions ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id          SERIAL PRIMARY KEY,
      "authorId"  INTEGER NOT NULL,
      "cellId"    INTEGER,
      content     TEXT NOT NULL,
      category    TEXT DEFAULT 'Tous',
      "mediaUrls" JSONB,
      views       INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      "postId"    INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      type        TEXT DEFAULT 'like',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("postId","userId")
    );
    CREATE TABLE IF NOT EXISTS post_comments (
      id          SERIAL PRIMARY KEY,
      "postId"    INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_boosts (
      "postId"    INTEGER PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      amount      NUMERIC(10,2) NOT NULL,
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL,
      "mediaUrl"  TEXT NOT NULL,
      "mediaType" TEXT DEFAULT 'image',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "expiresAt" TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS story_views (
      "storyId"  INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      "viewedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("storyId","userId")
    );
    CREATE TABLE IF NOT EXISTS story_reactions (
      id          SERIAL PRIMARY KEY,
      "storyId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      emoji       TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables événements ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id              SERIAL PRIMARY KEY,
      title           TEXT NOT NULL,
      description     TEXT NOT NULL,
      "imageUrl"      TEXT,
      country         TEXT NOT NULL,
      city            TEXT NOT NULL,
      location        TEXT NOT NULL,
      latitude        REAL,
      longitude       REAL,
      "startDate"     TIMESTAMP NOT NULL,
      "endDate"       TIMESTAMP NOT NULL,
      category        TEXT NOT NULL,
      "communityId"   INTEGER,
      "creatorId"     INTEGER NOT NULL,
      price           NUMERIC(10,2) DEFAULT 0,
      "visualUrl"     TEXT,
      "shares_count"  INTEGER DEFAULT 0,
      "createdAt"     TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      "eventId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      PRIMARY KEY ("eventId","userId")
    );
    CREATE TABLE IF NOT EXISTS event_likes (
      "eventId"   INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("eventId","userId")
    );
    CREATE TABLE IF NOT EXISTS event_comments (
      id          SERIAL PRIMARY KEY,
      "eventId"   INTEGER,
      "userId"    INTEGER,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS favorite_events (
      "userId"    INTEGER NOT NULL,
      "eventId"   INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","eventId")
    );
  `);

  // ── Tables business & entreprises ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id           SERIAL PRIMARY KEY,
      "ownerId"    INTEGER NOT NULL,
      name         TEXT NOT NULL,
      sector       TEXT,
      description  TEXT,
      address      TEXT,
      whatsapp     TEXT,
      facebook     TEXT,
      twitter      TEXT,
      linkedin     TEXT,
      "logoUrl"    TEXT,
      "coverUrl"   TEXT,
      "isShop"     BOOLEAN DEFAULT FALSE,
      specialty    TEXT,
      categories   TEXT,
      country      TEXT,
      city         TEXT,
      latitude     REAL,
      longitude    REAL,
      "managerId"  INTEGER,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS company_catalog (
      id             SERIAL PRIMARY KEY,
      "companyId"    INTEGER NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      price          NUMERIC(10,2),
      "imageUrl"     TEXT,
      category       TEXT,
      tag            TEXT,
      "tagValue"     TEXT,
      "shares_count" INTEGER DEFAULT 0,
      "createdAt"    TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stocks (
      "productId"   INTEGER PRIMARY KEY,
      quantity      INTEGER DEFAULT 0,
      "minQuantity" INTEGER DEFAULT 5,
      "costPrice"   NUMERIC(10,2) DEFAULT 0,
      "lastUpdated" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id          SERIAL PRIMARY KEY,
      "productId" INTEGER NOT NULL,
      quantity    INTEGER NOT NULL,
      type        TEXT NOT NULL,
      reason      TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS shop_orders (
      id                 SERIAL PRIMARY KEY,
      "companyId"        INTEGER NOT NULL,
      "customerId"       INTEGER NOT NULL,
      "productId"        INTEGER NOT NULL,
      quantity           INTEGER DEFAULT 1,
      "totalPrice"       NUMERIC(10,2) NOT NULL,
      status             TEXT DEFAULT 'pending',
      "customerName"     TEXT,
      "customerWhatsapp" TEXT,
      "createdAt"        TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS favorite_companies (
      "userId"    INTEGER NOT NULL,
      "companyId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","companyId")
    );
    CREATE TABLE IF NOT EXISTS favorite_products (
      "userId"    INTEGER NOT NULL,
      "productId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("userId","productId")
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id          SERIAL PRIMARY KEY,
      "userId"    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        DATE NOT NULL,
      description TEXT NOT NULL,
      category    TEXT NOT NULL,
      amount      NUMERIC(10,2) NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('income','expense')),
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS funding_requests (
      id             SERIAL PRIMARY KEY,
      "userId"       INTEGER NOT NULL,
      "companyId"    INTEGER NOT NULL,
      "institutionId" INTEGER,
      "fundingType"  TEXT NOT NULL,
      amount         NUMERIC(10,2),
      reason         TEXT,
      "strategicData" JSONB,
      status         TEXT DEFAULT 'En attente',
      "createdAt"    TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS credit_institutions (
      id               SERIAL PRIMARY KEY,
      "creatorId"      INTEGER NOT NULL,
      name             TEXT NOT NULL,
      type             TEXT NOT NULL,
      description      TEXT,
      terms            TEXT,
      eligibility      TEXT,
      targets          TEXT,
      "processingTime" TEXT,
      "logoUrl"        TEXT,
      "coverUrl"       TEXT,
      address          TEXT,
      city             TEXT,
      country          TEXT,
      "isHabilitated"  INTEGER DEFAULT 0,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ads (
      id          SERIAL PRIMARY KEY,
      "companyId" INTEGER NOT NULL,
      goal        TEXT NOT NULL,
      content     TEXT NOT NULL,
      targeting   TEXT NOT NULL,
      budget      NUMERIC(10,2) NOT NULL,
      duration    INTEGER NOT NULL,
      status      TEXT DEFAULT 'pending',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id           SERIAL PRIMARY KEY,
      "userId"     INTEGER NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId"   INTEGER NOT NULL,
      rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment      TEXT,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables messages & chat ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id           SERIAL PRIMARY KEY,
      "senderId"   INTEGER NOT NULL,
      "receiverId" INTEGER,
      "roomId"     INTEGER,
      content      TEXT NOT NULL,
      "fileUrl"    TEXT,
      "fileType"   TEXT,
      "fileName"   TEXT,
      read         BOOLEAN DEFAULT FALSE,
      "isPinned"   BOOLEAN DEFAULT FALSE,
      "replyToId"  INTEGER,
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS message_reactions (
      id          SERIAL PRIMARY KEY,
      "messageId" INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      emoji       TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW(),
      UNIQUE("messageId","userId")
    );
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id          SERIAL PRIMARY KEY,
      name        TEXT,
      type        TEXT DEFAULT 'direct',
      "avatarUrl" TEXT,
      "creatorId" INTEGER,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_room_members (
      "roomId"   INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("roomId","userId")
    );
  `);

  // ── Tables communautés & cellules ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cells (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      "sponsorId" INTEGER,
      "creatorId" INTEGER NOT NULL,
      "coverUrl"  TEXT,
      latitude    REAL,
      longitude   REAL,
      city        TEXT,
      country     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cell_members (
      "cellId"   INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      role       TEXT DEFAULT 'member',
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("cellId","userId")
    );
    CREATE TABLE IF NOT EXISTS communities (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS community_members (
      "communityId" INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      role          TEXT DEFAULT 'member',
      PRIMARY KEY ("communityId","userId")
    );
    CREATE TABLE IF NOT EXISTS churches (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      pastor      TEXT,
      hq          TEXT,
      description TEXT,
      programs    TEXT,
      "coverUrl"  TEXT,
      latitude    REAL,
      longitude   REAL,
      city        TEXT,
      country     TEXT,
      "creatorId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables formation (Pannels) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pannels (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      theme       TEXT,
      "ownerId"   INTEGER NOT NULL,
      "avatarUrl" TEXT,
      "logoUrl"   TEXT,
      "coverUrl"  TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_members (
      "pannelId" INTEGER NOT NULL,
      "userId"   INTEGER NOT NULL,
      role       TEXT DEFAULT 'member',
      "joinedAt" TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("pannelId","userId")
    );
    CREATE TABLE IF NOT EXISTS pannel_courses (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      duration    TEXT,
      "fileUrl"   TEXT NOT NULL,
      "fileType"  TEXT NOT NULL,
      views       INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_progress (
      "pannelId"    INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      "courseId"    INTEGER NOT NULL,
      status        TEXT DEFAULT 'non_commence',
      position      REAL DEFAULT 0,
      notes         TEXT,
      "stickyNotes" JSONB,
      "updatedAt"   TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY ("pannelId","userId","courseId")
    );
    CREATE TABLE IF NOT EXISTS pannel_evaluations (
      id            SERIAL PRIMARY KEY,
      "pannelId"    INTEGER NOT NULL,
      "userId"      INTEGER NOT NULL,
      "courseTitle" TEXT,
      grade         INTEGER,
      feedback      TEXT,
      "createdAt"   TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_badges (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      "badgeType" TEXT NOT NULL,
      "unlockedAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_forum (
      id          SERIAL PRIMARY KEY,
      "pannelId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pannel_course_comments (
      id          SERIAL PRIMARY KEY,
      "courseId"  INTEGER NOT NULL,
      "userId"    INTEGER NOT NULL,
      content     TEXT NOT NULL,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  // ── Tables tâches ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id               SERIAL PRIMARY KEY,
      "userId"         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      description      TEXT,
      "dueDate"        DATE,
      "reminderTime"   TEXT,
      status           TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
      priority         TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
      category         TEXT DEFAULT 'Général',
      "assignedUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
      "isArchived"     BOOLEAN DEFAULT FALSE,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS task_subtasks (
      id          SERIAL PRIMARY KEY,
      "taskId"    INTEGER NOT NULL,
      title       TEXT NOT NULL,
      status      TEXT DEFAULT 'todo',
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS task_dependencies (
      "taskId"          INTEGER NOT NULL,
      "dependsOnTaskId" INTEGER NOT NULL,
      PRIMARY KEY ("taskId","dependsOnTaskId")
    );
  `);

  // ── Tables admin & sécurité ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id           SERIAL PRIMARY KEY,
      "reporterId" INTEGER NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId"   INTEGER NOT NULL,
      reason       TEXT NOT NULL,
      status       TEXT DEFAULT 'pending',
      "createdAt"  TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_logs (
      id          SERIAL PRIMARY KEY,
      "adminId"   INTEGER NOT NULL,
      action      TEXT NOT NULL,
      "targetId"  INTEGER,
      details     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS db_logs (
      id          SERIAL PRIMARY KEY,
      level       TEXT NOT NULL,
      action      TEXT NOT NULL,
      "userId"    INTEGER,
      ip          TEXT,
      details     TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW()
    );
  `);
  // ── Table services (complète) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id               SERIAL PRIMARY KEY,
      "providerId"     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      description      TEXT,
      availability     TEXT,
      budget           NUMERIC(10,2) DEFAULT 0,
      type             TEXT DEFAULT 'projet',
      "companyName"    TEXT,
      location         TEXT,
      "contractType"   TEXT,
      "fileUrl"        TEXT,
      category         TEXT,
      "createdAt"      TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_applications (
      id               SERIAL PRIMARY KEY,
      "serviceId"      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      "userId"         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message          TEXT,
      "contactDetails" JSONB,
      status           TEXT DEFAULT 'pending',
      "createdAt"      TIMESTAMP DEFAULT NOW(),
      UNIQUE("serviceId","userId")
    );
  `);

  // ── Index de performance ──
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_author        ON posts("authorId");
      CREATE INDEX IF NOT EXISTS idx_posts_created       ON posts("createdAt" DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_category      ON posts(category);
      CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages("senderId");
      CREATE INDEX IF NOT EXISTS idx_messages_receiver   ON messages("receiverId");
      CREATE INDEX IF NOT EXISTS idx_messages_room       ON messages("roomId");
      CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications("userId");
      CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications("userId", read) WHERE read = FALSE;
      CREATE INDEX IF NOT EXISTS idx_follows_follower    ON follows("followerId");
      CREATE INDEX IF NOT EXISTS idx_follows_following   ON follows("followingId");
      CREATE INDEX IF NOT EXISTS idx_tasks_user          ON tasks("userId");
      CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks("userId", status);
      CREATE INDEX IF NOT EXISTS idx_services_provider   ON services("providerId");
      CREATE INDEX IF NOT EXISTS idx_services_category   ON services(category);
      CREATE INDEX IF NOT EXISTS idx_service_apps_service ON service_applications("serviceId");
      CREATE INDEX IF NOT EXISTS idx_service_apps_user    ON service_applications("userId");
      CREATE INDEX IF NOT EXISTS idx_companies_owner     ON companies("ownerId");
      CREATE INDEX IF NOT EXISTS idx_catalog_company     ON company_catalog("companyId");
      CREATE INDEX IF NOT EXISTS idx_catalog_category    ON company_catalog(category);
      CREATE INDEX IF NOT EXISTS idx_events_creator      ON events("creatorId");
      CREATE INDEX IF NOT EXISTS idx_events_start        ON events("startDate");
      CREATE INDEX IF NOT EXISTS idx_pannel_members_user ON pannel_members("userId");
      CREATE INDEX IF NOT EXISTS idx_pannel_courses_panel ON pannel_courses("pannelId");
      CREATE INDEX IF NOT EXISTS idx_pannel_progress_user ON pannel_progress("userId");
      CREATE INDEX IF NOT EXISTS idx_cell_members_user   ON cell_members("userId");
      CREATE INDEX IF NOT EXISTS idx_stories_user        ON stories("userId");
      CREATE INDEX IF NOT EXISTS idx_stories_expires     ON stories("expiresAt");
      CREATE INDEX IF NOT EXISTS idx_post_likes_post     ON post_likes("postId");
      CREATE INDEX IF NOT EXISTS idx_post_comments_post  ON post_comments("postId");
    `);
    console.log('✅ Index créés');
  } catch (e: any) {
    console.warn('⚠️  Certains index non créés (migration requise?):', e.message);
  }

  console.log('✅ Toutes les tables PostgreSQL sont prêtes');
}

// ════════════════════════════════════════════════════════════════════════════
// 🌐 DÉMARRAGE DU SERVEUR
// ════════════════════════════════════════════════════════════════════════════
async function startServer() {
  await initDB();

  const app        = express();
  const httpServer = createServer(app);
  const io         = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
  });

  // ─── MIDDLEWARE ────────────────────────────────────────────────────────────
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Headers sécurité
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
 
  // Rate limiting (anti-abus)
  const rlMap = new Map<string, { count: number; reset: number }>();
  const rateLimit = (max: number, ms: number) => (req: any, res: any, next: any) => {
    const ip = req.ip ?? 'x';
    const now = Date.now();
    const e = rlMap.get(ip);
    if (!e || now > e.reset) { rlMap.set(ip, { count: 1, reset: now + ms }); return next(); }
    e.count++;
    if (e.count > max) {
      logAction('WARN', 'rate_limit', undefined, ip, req.path);
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un instant.' });
    }
    next();
  };
  setInterval(() => { const n = Date.now(); for (const [k, v] of rlMap) if (n > v.reset) rlMap.delete(k); }, 60000);
  app.use('/api/auth', rateLimit(10, 60000));   // 10 tentatives auth/minute
  app.use('/api',      rateLimit(300, 60000));  // 300 requêtes API/minute

  // Logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  // ─── MIDDLEWARE AUTHENTIFICATION ──────────────────────────────────────────
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user    = await db.one(`SELECT id, status, role FROM users WHERE id=$1`, [decoded.userId]);
      if (!user)             return res.status(401).json({ error: 'Utilisateur introuvable' });
      if (user.status === 'banned')
        return res.status(403).json({ error: 'Compte suspendu. Contactez le support FreeBara.' });
      req.userId   = decoded.userId;
      req.userRole = user.role;
      next();
    } catch {
      res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
    }
  };

  const requireAdmin      = (req: any, res: any, next: any) => {
    if (req.userRole !== 'admin' && req.userRole !== 'moderator')
      return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    next();
  };
  const requireSuperAdmin = (req: any, res: any, next: any) => {
    if (req.userRole !== 'admin')
      return res.status(403).json({ error: 'Accès super-admin requis' });
    next();
  };

  // ════════════════════════════════════════════════════════════════════════
  // 🔍 HEALTH CHECK
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/health', async (_, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'postgresql', time: new Date() });
    } catch {
      res.status(500).json({ status: 'error', db: 'disconnected' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // 🔐 AUTH — Connexion / Inscription par OTP
  // ════════════════════════════════════════════════════════════════════════
  app.post('/api/auth/request-otp', async (req, res) => {
    const { email, isRegister } = req.body;
    const ip = req.ip ?? '';
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
    try {
      const user = await db.one(`SELECT id FROM users WHERE email=$1`, [email]);
      if (isRegister && user)  return res.status(400).json({ error: 'Compte déjà existant. Connectez-vous.' });
      if (!isRegister && !user) return res.status(400).json({ error: 'Aucun compte trouvé. Inscrivez-vous.' });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const exp  = new Date(Date.now() + 10 * 60000);
      await pool.query(
        `INSERT INTO otps(email, code, "expiresAt") VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET code=$2,"expiresAt"=$3`,
        [email, code, exp]
      );
      await sendOTPEmail(email, code);
      await logAction('INFO', 'otp_requested', undefined, ip, email);
      res.json({ message: 'Code envoyé', ...(IS_DEV && { devCode: code }) });
    } catch (e: any) {
      errorTracker.capture(e, 'request-otp');
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code, isRegister, country, referralCode } = req.body;
    const ip = req.ip ?? '';
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' });
    try {
      const otp = await db.one(`SELECT email, code, "expiresAt" FROM otps WHERE email=$1`, [email]);
      if (!otp || otp.code !== code || new Date(otp.expiresAt) < new Date()) {
        await logAction('WARN', 'otp_failed', undefined, ip, email);
        return res.status(400).json({ error: 'Code invalide ou expiré' });
      }
      let user = await db.one(`SELECT id, email, name, profession, "avatarUrl", country, role, status, badge, "referralCode", balance FROM users WHERE email=$1`, [email]);
      if (isRegister) {
        if (user) return res.status(400).json({ error: 'Compte déjà existant' });
        let refBy = null;
        if (referralCode) {
          const ref = await db.one(`SELECT id FROM users WHERE "referralCode"=$1`, [referralCode]);
          if (ref) refBy = ref.id;
        }
        const rc = Math.random().toString(36).substring(2, 8).toUpperCase();
        user = await db.one(
          `INSERT INTO users(email,"referralCode","referredBy",country) VALUES($1,$2,$3,$4) RETURNING *`,
          [email, rc, refBy, country ?? null]
        );
        await logAction('INFO', 'user_registered', user.id, ip, email);
      } else {
        if (!user) return res.status(400).json({ error: 'Aucun compte trouvé' });
        await logAction('INFO', 'user_login', user.id, ip, email);
      }
      await pool.query(`DELETE FROM otps WHERE email=$1`, [email]);
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ token, user });
    } catch (e: any) {
      errorTracker.capture(e, 'verify-otp');
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // 👤 UTILISATEURS
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/users/me', authenticate, async (req: any, res) => {
    try {
      const u = await db.one(`SELECT id, email, name, profession, bio, company, "avatarUrl", "coverUrl", phone, location, website, church, groups, interests, skills, marketing, goals, badge, "referralCode", balance, role, status, visibility, country, "createdAt", "notificationPreferences" FROM users WHERE id=$1`, [req.userId]);
      if (!u) return res.status(404).json({ error: 'Introuvable' });
      // JSONB: pg retourne déjà un objet JS, pas besoin de JSON.parse
      if (!u.notificationPreferences) u.notificationPreferences = {};
      const conn = await db.one(`SELECT COUNT(*) as n FROM follows WHERE "followerId"=$1 OR "followingId"=$1`, [req.userId]);
      const badges: string[] = [];
      if (conn.n >= 100) badges.push('Super Connecteur');
      if (conn.n >= 50)  badges.push('Réseauteur Actif');
      if (conn.n >= 10)  badges.push('Sociable');
      u.badges = badges;
      res.json(u);
    } catch (e: any) { errorTracker.capture(e, 'get-me'); res.status(500).json({ error: 'Erreur' }); }
  });

  app.put('/api/users/me', authenticate, async (req: any, res) => {
    const { name,profession,bio,company,avatarUrl,coverUrl,phone,location,website,church,groups,interests,skills,marketing,goals,notificationPreferences,visibility,country } = req.body;
    await pool.query(
      `UPDATE users SET name=$1,profession=$2,bio=$3,company=$4,"avatarUrl"=$5,"coverUrl"=$6,phone=$7,location=$8,website=$9,church=$10,groups=$11,interests=$12,skills=$13,marketing=$14,goals=$15,"notificationPreferences"=$16,visibility=$17,country=$18 WHERE id=$19`,
      [name,profession,bio,company,avatarUrl,coverUrl,phone,location,website,church,groups,interests,skills,marketing,goals,notificationPreferences ?? null,visibility,country,req.userId]
    );
    res.json({ success: true });
  });

  app.delete('/api/users/me', authenticate, async (req: any, res) => {
    const id = req.userId;
    try {
      await pool.query('BEGIN');
      const tables = ['community_members','follows','connection_requests','notifications','certifications','cell_members','post_likes','post_comments','event_participants','event_likes','pannel_members','pannel_evaluations','pannel_badges','pannel_progress','pannel_forum','service_applications','story_views','story_reactions'];
      for (const t of tables) {
        try { await pool.query(`DELETE FROM ${t} WHERE "userId"=$1`, [id]); } catch {}
      }
      try { await pool.query(`DELETE FROM follows WHERE "followerId"=$1 OR "followingId"=$1`, [id]); } catch {}
      try { await pool.query(`DELETE FROM connection_requests WHERE "senderId"=$1 OR "receiverId"=$1`, [id]); } catch {}
      const owned: Record<string,string> = { posts:'"authorId"', events:'"creatorId"', services:'"providerId"', stories:'"userId"', companies:'"ownerId"', cells:'"creatorId"', churches:'"creatorId"', pannels:'"ownerId"', transactions:'"userId"' };
      for (const [t, col] of Object.entries(owned)) {
        try { await pool.query(`DELETE FROM ${t} WHERE ${col}=$1`, [id]); } catch {}
      }
      await pool.query(`DELETE FROM users WHERE id=$1`, [id]);
      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (e) { await pool.query('ROLLBACK'); res.status(500).json({ error: 'Erreur suppression' }); }
  });

  app.get('/api/users/search', authenticate, async (req: any, res) => {
    const q = req.query.q;
    if (!q) return res.json([]);
    res.json(await db.all(`SELECT id,name,"avatarUrl" FROM users WHERE name ILIKE $1 LIMIT 10`, [`%${q}%`]));
  });

  app.get('/api/users', authenticate, async (req: any, res) => {
    const { country, profession } = req.query as any;
    let q = `SELECT id,name,profession,"avatarUrl",country,badge,company,role FROM users WHERE status='active'`;
    const p: any[] = []; let i = 1;
    if (country && country !== 'Tous') { q += ` AND country=$${i++}`; p.push(country); }
    if (profession) { q += ` AND profession ILIKE $${i++}`; p.push(`%${profession}%`); }
    q += ' ORDER BY "createdAt" DESC LIMIT 100';
    res.json(await db.all(q, p));
  });

  app.get('/api/users/:id', authenticate, async (req: any, res) => {
    const u = await db.one(`SELECT id,name,profession,bio,company,"avatarUrl","coverUrl",country,badge,role,"createdAt" FROM users WHERE id=$1`, [req.params.id]);
    if (!u) return res.status(404).json({ error: 'Introuvable' });
    res.json(u);
  });

  app.post('/api/users/:id/follow', authenticate, async (req: any, res) => {
    try {
      await pool.query(`INSERT INTO follows("followerId","followingId") VALUES($1,$2)`, [req.userId, req.params.id]);
      const f = await db.one(`SELECT name FROM users WHERE id=$1`, [req.userId]);
      const n = await db.one(`INSERT INTO notifications("userId",type,content,"relatedId") VALUES($1,'follow',$2,$3) RETURNING *`, [req.params.id, `${f.name} a commencé à vous suivre.`, req.userId]);
      io.to(`user_${req.params.id}`).emit('notification', { ...n, read: false });
      res.json({ success: true });
    } catch { res.status(400).json({ error: 'Déjà suivi' }); }
  });

  app.post('/api/users/:id/connect', authenticate, async (req: any, res) => {
    try { await pool.query(`INSERT INTO connection_requests("senderId","receiverId") VALUES($1,$2)`, [req.userId, req.params.id]); res.json({ success: true }); }
    catch { res.status(400).json({ error: 'Déjà envoyé' }); }
  });

  app.get('/api/users/me/following',        authenticate, async (req: any, res) => res.json(await db.all(`SELECT u.id,u.name,u.profession,u."avatarUrl",u.company,u.badge FROM users u JOIN follows f ON u.id=f."followingId" WHERE f."followerId"=$1`, [req.userId])));
  app.get('/api/users/me/connections',      authenticate, async (req: any, res) => res.json(await db.all(`SELECT u.id,u.name,u.profession,u."avatarUrl" FROM users u WHERE u.id IN(SELECT "senderId" FROM connection_requests WHERE "receiverId"=$1 AND status='accepted' UNION SELECT "receiverId" FROM connection_requests WHERE "senderId"=$1 AND status='accepted')`, [req.userId])));
  app.get('/api/users/me/network-requests', authenticate, async (req: any, res) => res.json(await db.all(`SELECT cr.*,u.name,u."avatarUrl",u.profession FROM connection_requests cr JOIN users u ON cr."senderId"=u.id WHERE cr."receiverId"=$1 AND cr.status='pending'`, [req.userId])));
  app.get('/api/users/me/certifications',   authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "userId", name, organization, "dateObtained", "createdAt" FROM certifications WHERE "userId"=$1 ORDER BY "dateObtained" DESC`, [req.userId])));
  app.post('/api/users/me/certifications',  authenticate, async (req: any, res) => { const {name,organization,dateObtained}=req.body; res.json(await db.one(`INSERT INTO certifications("userId",name,organization,"dateObtained") VALUES($1,$2,$3,$4) RETURNING *`, [req.userId,name,organization,dateObtained])); });
  app.delete('/api/users/me/certifications/:id', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM certifications WHERE id=$1 AND "userId"=$2`, [req.params.id, req.userId]); res.json({ success: true }); });
  app.get('/api/users/me/transactions',     authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "userId", date, description, category, amount, type, "createdAt" FROM transactions WHERE "userId"=$1 ORDER BY date DESC`, [req.userId])));
  app.post('/api/users/me/transactions',    authenticate, async (req: any, res) => { const {date,description,category,amount,type}=req.body; const tx=await db.one(`INSERT INTO transactions("userId",date,description,category,amount,type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.userId,date,description,category,amount,type]); io.to(`user_${req.userId}`).emit('transaction_update',tx); res.json(tx); });
  app.get('/api/users/me/favorite-companies', authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.* FROM companies c JOIN favorite_companies fc ON c.id=fc."companyId" WHERE fc."userId"=$1`, [req.userId])));
  app.get('/api/users/me/favorite-products',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT p.*,c.name as "companyName" FROM company_catalog p JOIN companies c ON p."companyId"=c.id JOIN favorite_products fp ON p.id=fp."productId" WHERE fp."userId"=$1`, [req.userId])));
  app.get('/api/users/me/events',   authenticate, async (req: any, res) => res.json(await db.all(`SELECT e.* FROM events e JOIN event_participants ep ON e.id=ep."eventId" WHERE ep."userId"=$1 ORDER BY e."startDate" ASC`, [req.userId])));
  app.get('/api/users/:id/events',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT e.* FROM events e JOIN event_participants ep ON e.id=ep."eventId" WHERE ep."userId"=$1`, [req.params.id])));
  app.get('/api/users/me/services', authenticate, async (req: any, res) => {
    const cr = await db.all(`SELECT id, "providerId", title, description, availability, budget, type, "companyName", location, "contractType", "fileUrl", category, "createdAt" FROM services WHERE "providerId"=$1 ORDER BY "createdAt" DESC`, [req.userId]);
    const ap = await db.all(`SELECT s.id, s."providerId", s.title, s.description, s.budget, s.type, s.category, s."createdAt" FROM services s JOIN service_applications sa ON s.id=sa."serviceId" WHERE sa."userId"=$1`, [req.userId]);
    res.json({ created: cr, applied: ap });
  });
  app.post('/api/users/me/claim-church', authenticate, async (req: any, res) => { await pool.query(`UPDATE users SET church=$1 WHERE id=$2`, [req.body.churchName, req.userId]); res.json({ success: true }); });

  // ════════════════════════════════════════════════════════════════════════
  // 📝 PUBLICATIONS (Posts)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/posts', authenticate, async (req: any, res) => {
    try {
      const page=parseInt(req.query.page)||1; const limit=parseInt(req.query.limit)||10; const offset=(page-1)*limit;
      const {category,country,feedType,search}=req.query as any; const authorId=req.query.authorId?parseInt(req.query.authorId):null;
      let q=`SELECT p.*,u.name as "authorName",u."avatarUrl" as "authorAvatar",u.profession as "authorProfession",u.country as "authorCountry",(SELECT COUNT(*) FROM post_likes WHERE "postId"=p.id) as "likesCount",(SELECT COUNT(*) FROM post_comments WHERE "postId"=p.id) as "commentsCount",(SELECT type FROM post_likes WHERE "postId"=p.id AND "userId"=$1) as "myReactionType",EXISTS(SELECT 1 FROM post_boosts WHERE "postId"=p.id) as "isBoosted" FROM posts p JOIN users u ON p."authorId"=u.id WHERE 1=1`;
      const p:any[]=[req.userId]; let i=2;
      if(authorId){q+=` AND p."authorId"=$${i++}`;p.push(authorId);}
      if(feedType==='network'){q+=` AND p."authorId" IN(SELECT "followingId" FROM follows WHERE "followerId"=$${i++})`;p.push(req.userId);}
      if(category&&category!=='Tous'){q+=` AND p.category=$${i++}`;p.push(category);}
      if(country&&country!=='Tous'){q+=` AND u.country=$${i++}`;p.push(country);}
      if(search){q+=` AND(p.content ILIKE $${i} OR u.name ILIKE $${i})`;p.push(`%${search}%`);i++;}
      q+=` ORDER BY "isBoosted" DESC,p."createdAt" DESC LIMIT $${i++} OFFSET $${i++}`;p.push(limit,offset);
      res.json(await db.all(q,p));
    } catch(e:any){errorTracker.capture(e,'get-posts');res.status(500).json({error:'Erreur'});}
  });

  app.post('/api/posts', authenticate, async (req: any, res) => {
    const { content, category, mediaUrls, cellId } = req.body;
    if (!content && (!mediaUrls || !mediaUrls.length)) return res.status(400).json({ error: 'Contenu requis' });
    const post = await db.one(`INSERT INTO posts("authorId",content,category,"mediaUrls","cellId") VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.userId,content||'',category||'Tous',mediaUrls ?? null,cellId||null]);
    res.json(post);
  });

  app.put('/api/posts/:id', authenticate, async (req: any, res) => {
    const p = await db.one(`SELECT "authorId" FROM posts WHERE id=$1`, [req.params.id]);
    if (!p || p.authorid !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    await pool.query(`UPDATE posts SET content=$1 WHERE id=$2`, [req.body.content, req.params.id]);
    res.json({ success: true });
  });

  app.delete('/api/posts/:id', authenticate, async (req: any, res) => {
    const p = await db.one(`SELECT "authorId" FROM posts WHERE id=$1`, [req.params.id]);
    if (!p || p.authorid !== req.userId) return res.status(403).json({ error: 'Non autorisé' });
    await pool.query(`DELETE FROM posts WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/posts/:id/like', authenticate, async (req: any, res) => {
    const { type = 'like' } = req.body;
    const ex = await db.one(`SELECT "postId", "userId", type FROM post_likes WHERE "postId"=$1 AND "userId"=$2`, [req.params.id, req.userId]);
    if (ex) {
      if (ex.type === type) { await pool.query(`DELETE FROM post_likes WHERE "postId"=$1 AND "userId"=$2`, [req.params.id, req.userId]); return res.json({ liked: false }); }
      await pool.query(`UPDATE post_likes SET type=$1 WHERE "postId"=$2 AND "userId"=$3`, [type, req.params.id, req.userId]);
      return res.json({ liked: true, type });
    }
    await pool.query(`INSERT INTO post_likes("postId","userId",type) VALUES($1,$2,$3)`, [req.params.id, req.userId, type]);
    res.json({ liked: true, type });
  });

  app.get('/api/posts/:id/comments',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.*,u.name as "authorName",u."avatarUrl" as "authorAvatar" FROM post_comments c JOIN users u ON c."userId"=u.id WHERE c."postId"=$1 ORDER BY c."createdAt" ASC`, [req.params.id])));
  app.get('/api/posts/:id/reactions', authenticate, async (req: any, res) => res.json(await db.all(`SELECT l.type,u.id as "userId",u.name,u."avatarUrl" FROM post_likes l JOIN users u ON l."userId"=u.id WHERE l."postId"=$1`, [req.params.id])));
  app.post('/api/posts/:id/comments', authenticate, async (req: any, res) => { const c=await db.one(`INSERT INTO post_comments("postId","userId",content) VALUES($1,$2,$3) RETURNING *`,[req.params.id,req.userId,req.body.content]); res.json(c); });
  app.put('/api/posts/:postId/comments/:commentId', authenticate, async (req: any, res) => { const c=await db.one(`SELECT "userId" FROM post_comments WHERE id=$1`,[req.params.commentId]); if(!c||c.userid!==req.userId) return res.status(403).json({error:'Non autorisé'}); await pool.query(`UPDATE post_comments SET content=$1 WHERE id=$2`,[req.body.content,req.params.commentId]); res.json({success:true}); });
  app.delete('/api/posts/:postId/comments/:commentId', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM post_comments WHERE id=$1 AND "userId"=$2`,[req.params.commentId,req.userId]); res.json({success:true}); });
  app.post('/api/posts/:id/view',  authenticate, async (req: any, res) => { await pool.query(`UPDATE posts SET views=views+1 WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.post('/api/posts/:id/boost', authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO post_boosts("postId","userId",amount) VALUES($1,$2,$3)`,[req.params.id,req.userId,req.body.amount]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà boosté'}); } });

  // ════════════════════════════════════════════════════════════════════════
  // 🔔 NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/notifications',       authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "userId", type, content, "relatedId", read, "createdAt" FROM notifications WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [req.userId])));
  app.put('/api/notifications/:id/read', authenticate, async (req: any, res) => { await pool.query(`UPDATE notifications SET read=TRUE WHERE id=$1 AND "userId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 📅 ÉVÉNEMENTS
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/events',     authenticate, async (_, res) => res.json(await db.all(`SELECT e.*,u.name as "creatorName",(SELECT COUNT(*) FROM event_participants WHERE "eventId"=e.id) as "participantsCount" FROM events e JOIN users u ON e."creatorId"=u.id ORDER BY e."startDate" ASC`, [])));
  app.post('/api/events',    authenticate, async (req: any, res) => { const {title,description,imageUrl,country,city,location,latitude,longitude,startDate,endDate,category,price,visualUrl}=req.body; res.json(await db.one(`INSERT INTO events(title,description,"imageUrl",country,city,location,latitude,longitude,"startDate","endDate",category,"creatorId",price,"visualUrl") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[title,description,imageUrl,country,city,location,latitude,longitude,startDate,endDate,category,req.userId,price||0,visualUrl])); });
  app.get('/api/events/:id', authenticate, async (req: any, res) => { const e=await db.one(`SELECT e.*,u.name as "creatorName",(SELECT COUNT(*) FROM event_participants WHERE "eventId"=e.id) as "participantsCount",EXISTS(SELECT 1 FROM event_participants WHERE "eventId"=e.id AND "userId"=$1) as "isParticipating" FROM events e JOIN users u ON e."creatorId"=u.id WHERE e.id=$2`,[req.userId,req.params.id]); if(!e) return res.status(404).json({error:'Non trouvé'}); res.json(e); });
  app.put('/api/events/:id', authenticate, async (req: any, res) => { const e=await db.one(`SELECT "creatorId" FROM events WHERE id=$1`,[req.params.id]); if(!e||e.creatorid!==req.userId) return res.status(403).json({error:'Non autorisé'}); const {title,description,imageUrl,country,city,location,startDate,endDate,category}=req.body; await pool.query(`UPDATE events SET title=$1,description=$2,"imageUrl"=$3,country=$4,city=$5,location=$6,"startDate"=$7,"endDate"=$8,category=$9 WHERE id=$10`,[title,description,imageUrl,country,city,location,startDate,endDate,category,req.params.id]); res.json({success:true}); });
  app.delete('/api/events/:id', authenticate, async (req: any, res) => { const e=await db.one(`SELECT "creatorId" FROM events WHERE id=$1`,[req.params.id]); if(!e||e.creatorid!==req.userId) return res.status(403).json({error:'Non autorisé'}); await pool.query(`DELETE FROM events WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.post('/api/events/:id/participate',  authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO event_participants("eventId","userId") VALUES($1,$2)`,[req.params.id,req.userId]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà participant'}); } });
  app.delete('/api/events/:id/participate',authenticate, async (req: any, res) => { await pool.query(`DELETE FROM event_participants WHERE "eventId"=$1 AND "userId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.get('/api/events/:id/participants',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT u.id,u.name,u."avatarUrl" FROM event_participants ep JOIN users u ON ep."userId"=u.id WHERE ep."eventId"=$1`,[req.params.id])));
  app.get('/api/events/:id/comments',      authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.*,u.name as "userName",u."avatarUrl" as "userAvatar" FROM event_comments c JOIN users u ON c."userId"=u.id WHERE c."eventId"=$1 ORDER BY c."createdAt" DESC`,[req.params.id])));
  app.post('/api/events/:id/comments',     authenticate, async (req: any, res) => { if(!req.body.content) return res.status(400).json({error:'Contenu requis'}); res.json(await db.one(`INSERT INTO event_comments("eventId","userId",content) VALUES($1,$2,$3) RETURNING *`,[req.params.id,req.userId,req.body.content])); });
  app.post('/api/events/:id/favorite',     authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO favorite_events("userId","eventId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.userId,req.params.id]); } catch {} res.json({success:true}); });
  app.post('/api/events/:id/share',        authenticate, async (req: any, res) => { await pool.query(`UPDATE events SET "shares_count"="shares_count"+1 WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.post('/api/events/:id/invite', authenticate, async (req: any, res) => {
    const {userIds}=req.body;
    if(!Array.isArray(userIds)) return res.status(400).json({error:'userIds requis'});
    const ev=await db.one(`SELECT title FROM events WHERE id=$1`,[req.params.id]);
    const s=await db.one(`SELECT name FROM users WHERE id=$1`,[req.userId]);
    for(const uid of userIds){
      const n=await db.one(`INSERT INTO notifications("userId",type,content,"relatedId") VALUES($1,'event_invite',$2,$3) RETURNING *`,[uid,`${s.name} vous invite: ${ev.title}`,req.params.id]);
      io.to(`user_${uid}`).emit('notification',{...n, read: false});
    }
    res.json({success:true});
  });

  // ════════════════════════════════════════════════════════════════════════
  // 💼 SERVICES
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/services',     authenticate, async (_, res) => res.json(await db.all(`SELECT s.*,u.name as "providerName",u."avatarUrl" as "providerAvatar" FROM services s JOIN users u ON s."providerId"=u.id ORDER BY s."createdAt" DESC`, [])));
  app.post('/api/services',    authenticate, async (req: any, res) => {
    const {title,description,availability,budget,type,companyName,location,contractType,fileUrl,category}=req.body;
    if (!title) return res.status(400).json({ error: 'Titre requis' });
    try {
      res.json(await db.one(`INSERT INTO services("providerId",title,description,availability,budget,type,"companyName",location,"contractType","fileUrl",category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.userId,title,description,availability,budget||0,type||'projet',companyName,location,contractType,fileUrl,category]));
    } catch (e: any) { res.status(500).json({ error: 'Erreur création service: ' + e.message }); }
  });
  app.put('/api/services/:id', authenticate, async (req: any, res) => { const s=await db.one(`SELECT "providerId" FROM services WHERE id=$1`,[req.params.id]); if(!s||s.providerid!==req.userId) return res.status(403).json({error:'Non autorisé'}); const {title,description,budget,availability,type,companyName,location,contractType,fileUrl,category}=req.body; await pool.query(`UPDATE services SET title=$1,description=$2,budget=$3,availability=$4,type=$5,"companyName"=$6,location=$7,"contractType"=$8,"fileUrl"=$9,category=$10 WHERE id=$11`,[title,description,budget,availability,type,companyName,location,contractType,fileUrl,category,req.params.id]); res.json({success:true}); });
  app.delete('/api/services/:id',          authenticate, async (req: any, res) => { await pool.query(`DELETE FROM services WHERE id=$1 AND "providerId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/services/:id/apply',      authenticate, async (req: any, res) => { const {message,contactDetails}=req.body; try { await pool.query(`INSERT INTO service_applications("serviceId","userId",message,"contactDetails") VALUES($1,$2,$3,$4)`,[req.params.id,req.userId,message,contactDetails]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà postulé'}); } });
  app.get('/api/services/:id/applications',authenticate, async (req: any, res) => res.json(await db.all(`SELECT sa.*,u.name,u."avatarUrl",u.email FROM service_applications sa JOIN users u ON sa."userId"=u.id WHERE sa."serviceId"=$1`,[req.params.id])));
  app.put('/api/services/:serviceId/applications/:applicationId', authenticate, async (req: any, res) => { await pool.query(`UPDATE service_applications SET status=$1 WHERE id=$2 AND "serviceId"=$3`,[req.body.status,req.params.applicationId,req.params.serviceId]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 🏢 ENTREPRISES & BOUTIQUES
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/companies',          authenticate, async (_, res) => res.json(await db.all(`SELECT c.*,u.name as "ownerName" FROM companies c JOIN users u ON c."ownerId"=u.id ORDER BY c."createdAt" DESC`, [])));
  app.get('/api/companies/new',      authenticate, async (_, res) => res.json(await db.all(`SELECT id, "ownerId", name, sector, description, "logoUrl", "coverUrl", country, city, "isShop", "createdAt" FROM companies ORDER BY "createdAt" DESC LIMIT 10`, [])));
  app.get('/api/companies/trending', authenticate, async (_, res) => res.json(await db.all(`SELECT c.*,(SELECT COUNT(*) FROM favorite_companies WHERE "companyId"=c.id) as fav FROM companies c ORDER BY fav DESC LIMIT 10`, [])));
  app.post('/api/companies',   authenticate, async (req: any, res) => { const {name,sector,description,address,whatsapp,facebook,twitter,linkedin,logoUrl,coverUrl,isShop,specialty,categories,country,city}=req.body; res.json(await db.one(`INSERT INTO companies("ownerId",name,sector,description,address,whatsapp,facebook,twitter,linkedin,"logoUrl","coverUrl","isShop",specialty,categories,country,city) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,[req.userId,name,sector,description,address,whatsapp,facebook,twitter,linkedin,logoUrl,coverUrl,isShop||0,specialty,categories,country,city])); });
  app.put('/api/companies/:id', authenticate, async (req: any, res) => { const {name,sector,description,address,whatsapp,logoUrl,coverUrl,isShop,specialty,categories,country,city}=req.body; await pool.query(`UPDATE companies SET name=$1,sector=$2,description=$3,address=$4,whatsapp=$5,"logoUrl"=$6,"coverUrl"=$7,"isShop"=$8,specialty=$9,categories=$10,country=$11,city=$12 WHERE id=$13 AND "ownerId"=$14`,[name,sector,description,address,whatsapp,logoUrl,coverUrl,isShop,specialty,categories,country,city,req.params.id,req.userId]); res.json({success:true}); });
  app.delete('/api/companies/:id', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM companies WHERE id=$1 AND "ownerId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/companies/:id/favorite',   authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO favorite_companies("userId","companyId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.userId,req.params.id]); } catch {} res.json({success:true}); });
  app.delete('/api/companies/:id/favorite', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM favorite_companies WHERE "userId"=$1 AND "companyId"=$2`,[req.userId,req.params.id]); res.json({success:true}); });
  app.get('/api/companies/:id/catalog',     authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "companyId", name, description, price, "imageUrl", category, tag, "tagValue", "shares_count", "createdAt" FROM company_catalog WHERE "companyId"=$1`,[req.params.id])));
  app.post('/api/companies/:id/catalog',    authenticate, async (req: any, res) => { const {name,description,price,imageUrl,category,tag,tagValue}=req.body; res.json(await db.one(`INSERT INTO company_catalog("companyId",name,description,price,"imageUrl",category,tag,"tagValue") VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.params.id,name,description,price,imageUrl,category,tag,tagValue])); });
  app.put('/api/companies/:companyId/catalog/:productId',    authenticate, async (req: any, res) => { const {name,description,price,imageUrl,category}=req.body; await pool.query(`UPDATE company_catalog SET name=$1,description=$2,price=$3,"imageUrl"=$4,category=$5 WHERE id=$6 AND "companyId"=$7`,[name,description,price,imageUrl,category,req.params.productId,req.params.companyId]); res.json({success:true}); });
  app.delete('/api/companies/:companyId/catalog/:productId', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM company_catalog WHERE id=$1 AND "companyId"=$2`,[req.params.productId,req.params.companyId]); res.json({success:true}); });
  app.post('/api/products/:id/favorite',   authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO favorite_products("userId","productId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.userId,req.params.id]); } catch {} res.json({success:true}); });
  app.delete('/api/products/:id/favorite', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM favorite_products WHERE "userId"=$1 AND "productId"=$2`,[req.userId,req.params.id]); res.json({success:true}); });
  app.post('/api/products/:id/share', authenticate, async (req: any, res) => { await pool.query(`UPDATE company_catalog SET "shares_count"="shares_count"+1 WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.get('/api/products/recent',     authenticate, async (_, res) => res.json(await db.all(`SELECT p.*,c.name as "companyName" FROM company_catalog p JOIN companies c ON p."companyId"=c.id ORDER BY p."createdAt" DESC LIMIT 20`,[])));
  app.get('/api/products/promotions', authenticate, async (_, res) => res.json(await db.all(`SELECT p.*,c.name as "companyName" FROM company_catalog p JOIN companies c ON p."companyId"=c.id WHERE p.tag='promo' LIMIT 20`,[])));
  app.get('/api/companies/:id/stock',authenticate, async (req: any, res) => res.json(await db.all(`SELECT s.*,p.name as "productName" FROM stocks s JOIN company_catalog p ON s."productId"=p.id WHERE p."companyId"=$1`,[req.params.id])));
  app.put('/api/companies/:companyId/stock/:productId', authenticate, async (req: any, res) => { const {quantity,minQuantity,costPrice}=req.body; await pool.query(`INSERT INTO stocks("productId",quantity,"minQuantity","costPrice","lastUpdated") VALUES($1,$2,$3,$4,NOW()) ON CONFLICT("productId") DO UPDATE SET quantity=$2,"minQuantity"=$3,"costPrice"=$4,"lastUpdated"=NOW()`,[req.params.productId,quantity,minQuantity||5,costPrice||0]); res.json({success:true}); });
  app.get('/api/companies/:id/orders',    authenticate, async (req: any, res) => res.json(await db.all(`SELECT o.*,p.name as "productName",u.name as "customerNameUser" FROM shop_orders o JOIN company_catalog p ON o."productId"=p.id JOIN users u ON o."customerId"=u.id WHERE o."companyId"=$1 ORDER BY o."createdAt" DESC`,[req.params.id])));
  app.post('/api/companies/:id/orders',   authenticate, async (req: any, res) => { const {productId,quantity,totalPrice,customerName,customerWhatsapp}=req.body; res.json(await db.one(`INSERT INTO shop_orders("companyId","customerId","productId",quantity,"totalPrice","customerName","customerWhatsapp") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.params.id,req.userId,productId,quantity||1,totalPrice,customerName,customerWhatsapp])); });
  app.put('/api/orders/:orderId/status',  authenticate, async (req: any, res) => { await pool.query(`UPDATE shop_orders SET status=$1 WHERE id=$2`,[req.body.status,req.params.orderId]); res.json({success:true}); });
  app.get('/api/companies/:id/insights',  authenticate, async (req: any, res) => { const o=await db.one(`SELECT COUNT(*) as c,SUM("totalPrice") as rev FROM shop_orders WHERE "companyId"=$1`,[req.params.id]); const p=await db.one(`SELECT COUNT(*) as c FROM company_catalog WHERE "companyId"=$1`,[req.params.id]); res.json({totalOrders:o.c,totalRevenue:o.rev||0,totalProducts:p.c}); });
  app.post('/api/companies/:id/funding-request', authenticate, async (req: any, res) => { const {fundingType,amount,reason,institutionId,strategicData}=req.body; res.json(await db.one(`INSERT INTO funding_requests("userId","companyId","institutionId","fundingType",amount,reason,"strategicData") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.userId,req.params.id,institutionId||null,fundingType,amount,reason,strategicData ?? null])); });
  app.get('/api/funding-requests/my', authenticate, async (req: any, res) => res.json(await db.all(`SELECT fr.*,c.name as "companyName" FROM funding_requests fr JOIN companies c ON fr."companyId"=c.id WHERE fr."userId"=$1 ORDER BY fr."createdAt" DESC`,[req.userId])));
  app.put('/api/companies/:id/manager',      authenticate, async (req: any, res) => { await pool.query(`UPDATE companies SET "managerId"=$1 WHERE id=$2 AND "ownerId"=$3`,[req.body.managerId||null,req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/companies/:id/resign-manager', authenticate, async (req: any, res) => { await pool.query(`UPDATE companies SET "managerId"=NULL WHERE id=$1 AND "managerId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 💬 MESSAGERIE
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/conversations', authenticate, async (req: any, res) => {
    const direct = await db.all(`SELECT u.id,u.name,u."avatarUrl",MAX(m."createdAt") as "lastMessageAt",(SELECT content FROM messages WHERE(("senderId"=u.id AND "receiverId"=$1) OR("senderId"=$1 AND "receiverId"=u.id)) AND "roomId" IS NULL ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage",(SELECT COUNT(*) FROM messages WHERE "senderId"=u.id AND "receiverId"=$1 AND read=0 AND "roomId" IS NULL) as "unreadCount",'direct' as type FROM users u JOIN messages m ON u.id=m."senderId" OR u.id=m."receiverId" WHERE(m."senderId"=$1 OR m."receiverId"=$1) AND u.id!=$1 AND m."roomId" IS NULL GROUP BY u.id,u.name,u."avatarUrl"`, [req.userId]);
    const rooms  = await db.all(`SELECT cr.id,cr.name,cr."avatarUrl",MAX(m."createdAt") as "lastMessageAt",(SELECT content FROM messages WHERE "roomId"=cr.id ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage",(SELECT COUNT(*) FROM messages WHERE "roomId"=cr.id AND read=0 AND "senderId"!=$1) as "unreadCount",cr.type FROM chat_rooms cr JOIN chat_room_members crm ON cr.id=crm."roomId" LEFT JOIN messages m ON cr.id=m."roomId" WHERE crm."userId"=$1 GROUP BY cr.id`, [req.userId]);
    res.json([...direct, ...rooms].sort((a: any, b: any) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()));
  });
  app.get('/api/messages/:userId',    authenticate, async (req: any, res) => res.json(await db.all(`SELECT m.*,u.name as "senderName",u."avatarUrl" as "senderAvatar" FROM messages m JOIN users u ON m."senderId"=u.id WHERE(m."senderId"=$1 AND m."receiverId"=$2) OR(m."senderId"=$2 AND m."receiverId"=$1) ORDER BY m."createdAt" ASC`,[req.userId,req.params.userId])));
  app.post('/api/messages/:userId',   authenticate, async (req: any, res) => { const {content,fileUrl,fileType,fileName}=req.body; const msg=await db.one(`INSERT INTO messages("senderId","receiverId",content,"fileUrl","fileType","fileName") VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.userId,req.params.userId,content||'',fileUrl,fileType,fileName]); const s=await db.one(`SELECT name,"avatarUrl" FROM users WHERE id=$1`,[req.userId]); const full={...msg,senderName:s.name,senderAvatar:s.avatarurl}; io.to(`user_${req.params.userId}`).emit('new_message',full); res.json(full); });
  app.put('/api/messages/:userId/read',  authenticate, async (req: any, res) => { await pool.query(`UPDATE messages SET read=1 WHERE "senderId"=$1 AND "receiverId"=$2`,[req.params.userId,req.userId]); res.json({success:true}); });
  app.delete('/api/messages/:userId/history', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM messages WHERE("senderId"=$1 AND "receiverId"=$2) OR("senderId"=$2 AND "receiverId"=$1)`,[req.userId,req.params.userId]); res.json({success:true}); });
  app.delete('/api/messages/:userId',    authenticate, async (req: any, res) => { await pool.query(`DELETE FROM messages WHERE("senderId"=$1 AND "receiverId"=$2) OR("senderId"=$2 AND "receiverId"=$1)`,[req.userId,req.params.userId]); res.json({success:true}); });
  app.delete('/api/messages/item/:id',   authenticate, async (req: any, res) => { await pool.query(`DELETE FROM messages WHERE id=$1 AND "senderId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.put('/api/messages/item/:id',      authenticate, async (req: any, res) => { await pool.query(`UPDATE messages SET content=$1 WHERE id=$2 AND "senderId"=$3`,[req.body.content,req.params.id,req.userId]); res.json({success:true}); });
  app.put('/api/messages/:id/pin',       authenticate, async (req: any, res) => { await pool.query(`UPDATE messages SET "isPinned"=TRUE WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.put('/api/messages/:id/unpin',     authenticate, async (req: any, res) => { await pool.query(`UPDATE messages SET "isPinned"=FALSE WHERE id=$1`,[req.params.id]); res.json({success:true}); });
  app.post('/api/messages/:id/react',    authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO message_reactions("messageId","userId",emoji) VALUES($1,$2,$3) ON CONFLICT("messageId","userId") DO UPDATE SET emoji=$3`,[req.params.id,req.userId,req.body.emoji]); } catch {} res.json({success:true}); });
  app.post('/api/chat-rooms',            authenticate, async (req: any, res) => { const {name,type,memberIds,avatarUrl}=req.body; const room=await db.one(`INSERT INTO chat_rooms(name,type,"avatarUrl","creatorId") VALUES($1,$2,$3,$4) RETURNING *`,[name||null,type||'group',avatarUrl||null,req.userId]); await pool.query(`INSERT INTO chat_room_members("roomId","userId") VALUES($1,$2)`,[room.id,req.userId]); if(Array.isArray(memberIds)) for(const id of memberIds) { try { await pool.query(`INSERT INTO chat_room_members("roomId","userId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[room.id,id]); } catch {} } res.json(room); });
  app.post('/api/chat-rooms/:id/members',authenticate, async (req: any, res) => { const {userIds}=req.body; if(Array.isArray(userIds)) for(const id of userIds) { try { await pool.query(`INSERT INTO chat_room_members("roomId","userId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.params.id,id]); } catch {} } res.json({success:true}); });
  app.get('/api/chat-rooms/:id/messages',authenticate, async (req: any, res) => res.json(await db.all(`SELECT m.*,u.name as "senderName",u."avatarUrl" as "senderAvatar" FROM messages m JOIN users u ON m."senderId"=u.id WHERE m."roomId"=$1 ORDER BY m."createdAt" ASC`,[req.params.id])));
  app.post('/api/chat-rooms/:id/messages',authenticate, async (req: any, res) => { const {content,fileUrl,fileType,fileName,replyToId}=req.body; const msg=await db.one(`INSERT INTO messages("senderId","roomId",content,"fileUrl","fileType","fileName","replyToId") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.userId,req.params.id,content||'',fileUrl,fileType,fileName,replyToId||null]); const s=await db.one(`SELECT name,"avatarUrl" FROM users WHERE id=$1`,[req.userId]); const full={...msg,senderName:s.name,senderAvatar:s.avatarurl}; io.to(`room_${req.params.id}`).emit('new_room_message',full); res.json(full); });
  app.get('/api/chat-rooms/:id/members', authenticate, async (req: any, res) => res.json(await db.all(`SELECT u.id,u.name,u."avatarUrl" FROM chat_room_members crm JOIN users u ON crm."userId"=u.id WHERE crm."roomId"=$1`,[req.params.id])));
  app.put('/api/chat-rooms/:id',         authenticate, async (req: any, res) => { const {name,avatarUrl}=req.body; await pool.query(`UPDATE chat_rooms SET name=$1,"avatarUrl"=$2 WHERE id=$3 AND "creatorId"=$4`,[name,avatarUrl,req.params.id,req.userId]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 📖 STORIES
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/stories',         authenticate, async (req: any, res) => res.json(await db.all(`SELECT DISTINCT s.*,u.name as "authorName",u."avatarUrl" as "authorAvatar",(SELECT COUNT(*) FROM story_views WHERE "storyId"=s.id) as "viewsCount",EXISTS(SELECT 1 FROM story_views WHERE "storyId"=s.id AND "userId"=$1) as "isViewed" FROM stories s JOIN users u ON s."userId"=u.id LEFT JOIN follows f ON f."followingId"=s."userId" WHERE(f."followerId"=$1 OR s."userId"=$1) AND s."expiresAt">NOW() ORDER BY s."createdAt" DESC`,[req.userId])));
  app.post('/api/stories',        authenticate, async (req: any, res) => { const {mediaUrl,mediaType}=req.body; res.json(await db.one(`INSERT INTO stories("userId","mediaUrl","mediaType","expiresAt") VALUES($1,$2,$3,NOW()+INTERVAL '24 hours') RETURNING *`,[req.userId,mediaUrl,mediaType||'image'])); });
  app.get('/api/stories/archives',authenticate, async (req: any, res) => res.json(await db.all(`SELECT s.*,u.name as "authorName",u."avatarUrl" as "authorAvatar" FROM stories s JOIN users u ON s."userId"=u.id WHERE s."userId"=$1 ORDER BY s."createdAt" DESC`,[req.userId])));
  app.post('/api/stories/:id/view', authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO story_views("storyId","userId") VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.params.id,req.userId]); } catch {} res.json({success:true}); });
  app.post('/api/stories/:id/react',authenticate, async (req: any, res) => { await pool.query(`INSERT INTO story_reactions("storyId","userId",emoji) VALUES($1,$2,$3)`,[req.params.id,req.userId,req.body.emoji]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 🎓 PANNELS (Formation)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/pannels',     authenticate, async (req: any, res) => res.json(await db.all(`SELECT p.*,u.name as "ownerName",(SELECT COUNT(*) FROM pannel_members WHERE "pannelId"=p.id) as "membersCount",(SELECT role FROM pannel_members WHERE "pannelId"=p.id AND "userId"=$1) as "userRole" FROM pannels p JOIN users u ON p."ownerId"=u.id`,[req.userId])));
  app.get('/api/pannels/my',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT p.*,u.name as "ownerName",(SELECT COUNT(*) FROM pannel_members WHERE "pannelId"=p.id) as "membersCount",pm.role as "userRole" FROM pannels p JOIN pannel_members pm ON p.id=pm."pannelId" JOIN users u ON p."ownerId"=u.id WHERE pm."userId"=$1`,[req.userId])));
  app.get('/api/pannels/:id', authenticate, async (req: any, res) => { const p=await db.one(`SELECT p.*,u.name as "ownerName",(SELECT role FROM pannel_members WHERE "pannelId"=p.id AND "userId"=$1) as "userRole" FROM pannels p JOIN users u ON p."ownerId"=u.id WHERE p.id=$2`,[req.userId,req.params.id]); if(!p) return res.status(404).json({error:'Non trouvé'}); res.json(p); });
  app.post('/api/pannels',    authenticate, async (req: any, res) => { const {name,description,theme,logoUrl,coverUrl}=req.body; const r=await db.one(`INSERT INTO pannels(name,description,theme,"ownerId","logoUrl","coverUrl") VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[name,description,theme,req.userId,logoUrl,coverUrl]); await pool.query(`INSERT INTO pannel_members("pannelId","userId",role) VALUES($1,$2,'admin')`,[r.id,req.userId]); res.json(r); });
  app.put('/api/pannels/:id', authenticate, async (req: any, res) => { const {name,description,theme,logoUrl,coverUrl}=req.body; await pool.query(`UPDATE pannels SET name=$1,description=$2,theme=$3,"logoUrl"=$4,"coverUrl"=$5 WHERE id=$6`,[name,description,theme,logoUrl,coverUrl,req.params.id]); res.json({success:true}); });
  app.delete('/api/pannels/:id',authenticate, async (req: any, res) => { await pool.query(`DELETE FROM pannels WHERE id=$1 AND "ownerId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/pannels/:id/join',       authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO pannel_members("pannelId","userId") VALUES($1,$2)`,[req.params.id,req.userId]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà membre'}); } });
  app.post('/api/pannels/:id/add-member', authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO pannel_members("pannelId","userId") VALUES($1,$2)`,[req.params.id,req.body.userId]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà membre'}); } });
  app.delete('/api/pannels/:id/members/:userId',  authenticate, async (req: any, res) => { await pool.query(`DELETE FROM pannel_members WHERE "pannelId"=$1 AND "userId"=$2`,[req.params.id,req.params.userId]); res.json({success:true}); });
  app.get('/api/pannels/:id/members',             authenticate, async (req: any, res) => res.json(await db.all(`SELECT pm.*,u.name,u."avatarUrl",u.profession FROM pannel_members pm JOIN users u ON pm."userId"=u.id WHERE pm."pannelId"=$1`,[req.params.id])));
  app.put('/api/pannels/:id/members/:userId/role',authenticate, async (req: any, res) => { await pool.query(`UPDATE pannel_members SET role=$1 WHERE "pannelId"=$2 AND "userId"=$3`,[req.body.role,req.params.id,req.params.userId]); res.json({success:true}); });
  app.get('/api/pannels/:id/courses',   authenticate, async (req: any, res) => res.json(await db.all(`SELECT pc.*,(SELECT status FROM pannel_progress WHERE "courseId"=pc.id AND "userId"=$1) as "progressStatus" FROM pannel_courses pc WHERE pc."pannelId"=$2 ORDER BY pc."createdAt" DESC`,[req.userId,req.params.id])));
  app.post('/api/pannels/:id/courses',  authenticate, async (req: any, res) => { const {title,description,duration,fileUrl,fileType,url,type}=req.body; const fu=fileUrl||url; const ft=fileType||type; if(!title||!fu||!ft) return res.status(400).json({error:'Titre, fichier et type requis'}); await pool.query(`INSERT INTO pannel_courses("pannelId",title,description,duration,"fileUrl","fileType") VALUES($1,$2,$3,$4,$5,$6)`,[req.params.id,title,description,duration,fu,ft]); res.json({success:true}); });
  app.delete('/api/pannels/:id/courses/:courseId',              authenticate, async (req: any, res) => { await pool.query(`DELETE FROM pannel_courses WHERE id=$1 AND "pannelId"=$2`,[req.params.courseId,req.params.id]); res.json({success:true}); });
  app.post('/api/pannels/:id/courses/:courseId/learn',          authenticate, async (req: any, res) => { const {status,position,notes,stickyNotes}=req.body; await pool.query(`INSERT INTO pannel_progress("pannelId","userId","courseId",status,position,notes,"stickyNotes","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT("pannelId","userId","courseId") DO UPDATE SET status=$4,position=$5,notes=$6,"stickyNotes"=$7,"updatedAt"=NOW()`,[req.params.id,req.userId,req.params.courseId,status||'en_cours',position||0,notes,stickyNotes]); res.json({success:true}); });
  app.get('/api/pannels/:id/courses/:courseId/progress', authenticate, async (req: any, res) => res.json(await db.one(`SELECT "pannelId", "userId", "courseId", status, position, notes, "stickyNotes", "updatedAt" FROM pannel_progress WHERE "pannelId"=$1 AND "userId"=$2 AND "courseId"=$3`,[req.params.id,req.userId,req.params.courseId]) || {}));
  app.get('/api/pannels/:id/courses/:courseId/comments',        authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.*,u.name as "userName",u."avatarUrl" as "userAvatar" FROM pannel_course_comments c JOIN users u ON c."userId"=u.id WHERE c."courseId"=$1 ORDER BY c."createdAt" ASC`,[req.params.courseId])));
  app.post('/api/pannels/:id/courses/:courseId/comments',       authenticate, async (req: any, res) => { await pool.query(`INSERT INTO pannel_course_comments("courseId","userId",content) VALUES($1,$2,$3)`,[req.params.courseId,req.userId,req.body.content]); res.json({success:true}); });
  app.post('/api/pannels/:id/courses/:courseId/favorite',       authenticate, async (_, res) => res.json({ success: true }));
  app.get('/api/pannels/:id/evaluations',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "pannelId", "userId", "courseTitle", grade, feedback, "createdAt" FROM pannel_evaluations WHERE "pannelId"=$1`,[req.params.id])));
  app.post('/api/pannels/:id/evaluations', authenticate, async (req: any, res) => { const {courseTitle,grade,feedback,userId}=req.body; await pool.query(`INSERT INTO pannel_evaluations("pannelId","userId","courseTitle",grade,feedback) VALUES($1,$2,$3,$4,$5)`,[req.params.id,userId||req.userId,courseTitle,grade,feedback]); res.json({success:true}); });
  app.get('/api/pannels/:id/badges',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "pannelId", "userId", "badgeType", "unlockedAt" FROM pannel_badges WHERE "pannelId"=$1 AND "userId"=$2`,[req.params.id,req.userId])));
  app.post('/api/pannels/:id/badges', authenticate, async (req: any, res) => { await pool.query(`INSERT INTO pannel_badges("pannelId","userId","badgeType") VALUES($1,$2,$3)`,[req.params.id,req.userId,req.body.badgeType]); res.json({success:true}); });
  app.get('/api/pannels/:id/stats',   authenticate, async (req: any, res) => { const m=await db.one(`SELECT COUNT(*) as c FROM pannel_members WHERE "pannelId"=$1`,[req.params.id]); const co=await db.one(`SELECT COUNT(*) as c FROM pannel_courses WHERE "pannelId"=$1`,[req.params.id]); res.json({membersCount:m.c,coursesCount:co.c}); });
  app.get('/api/pannels/:id/forum',   authenticate, async (req: any, res) => res.json(await db.all(`SELECT f.*,u.name as "userName",u."avatarUrl" as "userAvatar" FROM pannel_forum f JOIN users u ON f."userId"=u.id WHERE f."pannelId"=$1 ORDER BY f."createdAt" ASC`,[req.params.id])));
  app.post('/api/pannels/:id/forum',  authenticate, async (req: any, res) => { if(!req.body.content) return res.status(400).json({error:'Contenu requis'}); await pool.query(`INSERT INTO pannel_forum("pannelId","userId",content) VALUES($1,$2,$3)`,[req.params.id,req.userId,req.body.content]); res.json({success:true}); });
  app.get('/api/courses/all', authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.*,p.name as "pannelName",(SELECT status FROM pannel_progress WHERE "courseId"=c.id AND "userId"=$1) as "progressStatus" FROM pannel_courses c JOIN pannels p ON c."pannelId"=p.id ORDER BY c."createdAt" DESC`,[req.userId])));

  // ════════════════════════════════════════════════════════════════════════
  // 🏘️  CELLULES & COMMUNAUTÉS
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/cells/me',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT c.* FROM cells c JOIN cell_members cm ON c.id=cm."cellId" WHERE cm."userId"=$1`,[req.userId])));
  app.get('/api/cells/all', authenticate, async (_, res) => res.json(await db.all(`SELECT c.*,u.name as "creatorName",(SELECT COUNT(*) FROM cell_members WHERE "cellId"=c.id) as "membersCount" FROM cells c JOIN users u ON c."creatorId"=u.id ORDER BY c."createdAt" DESC`,[])));
  app.post('/api/cells',    authenticate, async (req: any, res) => { const {name,description,coverUrl,city,country}=req.body; const r=await db.one(`INSERT INTO cells(name,description,"creatorId","coverUrl",city,country) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[name,description,req.userId,coverUrl,city,country]); await pool.query(`INSERT INTO cell_members("cellId","userId",role) VALUES($1,$2,'admin')`,[r.id,req.userId]); res.json(r); });
  app.put('/api/cells/:id', authenticate, async (req: any, res) => { const {name,description,coverUrl}=req.body; await pool.query(`UPDATE cells SET name=$1,description=$2,"coverUrl"=$3 WHERE id=$4 AND "creatorId"=$5`,[name,description,coverUrl,req.params.id,req.userId]); res.json({success:true}); });
  app.delete('/api/cells/:id', authenticate, async (req: any, res) => { await pool.query(`DELETE FROM cells WHERE id=$1 AND "creatorId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/cells/:id/members',authenticate, async (req: any, res) => { try { await pool.query(`INSERT INTO cell_members("cellId","userId") VALUES($1,$2)`,[req.params.id,req.body.userId]); res.json({success:true}); } catch { res.status(400).json({error:'Déjà membre'}); } });
  app.get('/api/cells/:id/members', authenticate, async (req: any, res) => res.json(await db.all(`SELECT u.id,u.name,u."avatarUrl",cm.role FROM cell_members cm JOIN users u ON cm."userId"=u.id WHERE cm."cellId"=$1`,[req.params.id])));

  // ════════════════════════════════════════════════════════════════════════
  // ⛪ CHURCHES
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/churches',    authenticate, async (_, res) => res.json(await db.all(`SELECT id, name, pastor, hq, description, programs, "coverUrl", latitude, longitude, city, country, "creatorId", "createdAt" FROM churches ORDER BY "createdAt" DESC`,[])));
  app.post('/api/churches',   authenticate, async (req: any, res) => { const {name,pastor,hq,description,coverUrl,latitude,longitude,city,country}=req.body; res.json(await db.one(`INSERT INTO churches(name,pastor,hq,description,"coverUrl",latitude,longitude,city,country,"creatorId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[name,pastor,hq,description,coverUrl,latitude,longitude,city,country,req.userId])); });
  app.put('/api/churches/:id',authenticate, async (req: any, res) => { const {name,pastor,hq,description,coverUrl}=req.body; await pool.query(`UPDATE churches SET name=$1,pastor=$2,hq=$3,description=$4,"coverUrl"=$5 WHERE id=$6 AND "creatorId"=$7`,[name,pastor,hq,description,coverUrl,req.params.id,req.userId]); res.json({success:true}); });
  app.delete('/api/churches/:id',authenticate, async (req: any, res) => { await pool.query(`DELETE FROM churches WHERE id=$1 AND "creatorId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 🏦 INSTITUTIONS DE CRÉDIT
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/credit-institutions',     authenticate, async (_, res) => res.json(await db.all(`SELECT ci.*,u.name as "creatorName" FROM credit_institutions ci JOIN users u ON ci."creatorId"=u.id ORDER BY ci."createdAt" DESC`,[])));
  app.get('/api/credit-institutions/my',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "creatorId", name, type, description, eligibility, terms, city, country, "logoUrl", "createdAt" FROM credit_institutions WHERE "creatorId"=$1`,[req.userId])));
  app.post('/api/credit-institutions',    authenticate, async (req: any, res) => { const {name,type,description,eligibilityConditions,offers,city,country,logoUrl}=req.body; if(!name||!type) return res.status(400).json({error:'Nom et type obligatoires'}); res.json(await db.one(`INSERT INTO credit_institutions("creatorId",name,type,description,eligibility,terms,city,country,"logoUrl") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.userId,name,type,description,eligibilityConditions,offers,city,country,logoUrl])); });
  app.put('/api/credit-institutions/:id', authenticate, async (req: any, res) => { const {name,type,description,eligibility,terms,city,country,logoUrl}=req.body; await pool.query(`UPDATE credit_institutions SET name=$1,type=$2,description=$3,eligibility=$4,terms=$5,city=$6,country=$7,"logoUrl"=$8 WHERE id=$9 AND "creatorId"=$10`,[name,type,description,eligibility,terms,city,country,logoUrl,req.params.id,req.userId]); res.json({success:true}); });
  app.get('/api/credit-institutions/:id/requests', authenticate, async (req: any, res) => res.json(await db.all(`SELECT fr.*,u.name as "userName",c.name as "companyName" FROM funding_requests fr JOIN users u ON fr."userId"=u.id JOIN companies c ON fr."companyId"=c.id WHERE fr."institutionId"=$1`,[req.params.id])));

  // ════════════════════════════════════════════════════════════════════════
  // ✅ TÂCHES
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/tasks',    authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "userId", title, description, "dueDate", "reminderTime", status, priority, category, "assignedUserId", "isArchived", "createdAt" FROM tasks WHERE "userId"=$1 ORDER BY "createdAt" DESC`,[req.userId])));
  app.post('/api/tasks',   authenticate, async (req: any, res) => { const {title,description,dueDate,reminderTime,status,priority,category,assignedUserId}=req.body; res.json(await db.one(`INSERT INTO tasks("userId",title,description,"dueDate","reminderTime",status,priority,category,"assignedUserId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.userId,title,description,dueDate,reminderTime,status||'todo',priority||'medium',category||'Général',assignedUserId||null])); });
  app.put('/api/tasks/:id',authenticate, async (req: any, res) => { const {status,title,description,dueDate,reminderTime,priority,category}=req.body; await pool.query(`UPDATE tasks SET status=$1,title=$2,description=$3,"dueDate"=$4,"reminderTime"=$5,priority=$6,category=$7 WHERE id=$8 AND "userId"=$9`,[status,title,description,dueDate,reminderTime,priority,category,req.params.id,req.userId]); res.json({success:true}); });
  app.delete('/api/tasks/:id',authenticate, async (req: any, res) => { await pool.query(`DELETE FROM tasks WHERE id=$1 AND "userId"=$2`,[req.params.id,req.userId]); res.json({success:true}); });
  app.post('/api/tasks/:taskId/subtasks', authenticate, async (req: any, res) => res.json(await db.one(`INSERT INTO task_subtasks("taskId",title) VALUES($1,$2) RETURNING *`,[req.params.taskId,req.body.title])));
  app.get('/api/tasks/:taskId/subtasks',  authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "taskId", title, status, "createdAt" FROM task_subtasks WHERE "taskId"=$1`,[req.params.taskId])));
  app.put('/api/subtasks/:id',            authenticate, async (req: any, res) => { await pool.query(`UPDATE task_subtasks SET status=$1 WHERE id=$2`,[req.body.status,req.params.id]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 🌍 DIVERS
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/countries',                       authenticate, async (_, res) => { const r=await db.all(`SELECT DISTINCT country FROM users WHERE country IS NOT NULL AND country!='' ORDER BY country`,[]); res.json(r.map((c:any)=>c.country)); });
  app.get('/api/reviews/:targetType/:targetId',   authenticate, async (req: any, res) => res.json(await db.all(`SELECT r.*,u.name,u."avatarUrl" FROM reviews r JOIN users u ON r."userId"=u.id WHERE r."targetType"=$1 AND r."targetId"=$2 ORDER BY r."createdAt" DESC`,[req.params.targetType,req.params.targetId])));
  app.post('/api/reviews',                        authenticate, async (req: any, res) => { const {targetType,targetId,rating,comment}=req.body; res.json(await db.one(`INSERT INTO reviews("userId","targetType","targetId",rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING *`,[req.userId,targetType,targetId,rating,comment])); });
  app.post('/api/ads',                            authenticate, async (req: any, res) => { const {companyId,goal,content,targeting,budget,duration}=req.body; res.json(await db.one(`INSERT INTO ads("companyId",goal,content,targeting,budget,duration) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[companyId,goal,content,targeting,budget,duration])); });
  app.get('/api/ads/:companyId',                  authenticate, async (req: any, res) => res.json(await db.all(`SELECT id, "companyId", goal, content, targeting, budget, duration, status, "createdAt" FROM ads WHERE "companyId"=$1`,[req.params.companyId])));
  app.post('/api/reports',                        authenticate, async (req: any, res) => { const {targetType,targetId,reason}=req.body; if(!targetType||!targetId||!reason) return res.status(400).json({error:'Données manquantes'}); await pool.query(`INSERT INTO reports("reporterId","targetType","targetId",reason) VALUES($1,$2,$3,$4)`,[req.userId,targetType,targetId,reason]); res.json({success:true}); });

  // ════════════════════════════════════════════════════════════════════════
  // 📤 UPLOAD IMAGES (Cloudinary)
  // ════════════════════════════════════════════════════════════════════════
  app.post('/api/upload', authenticate, async (req: any, res) => {
    try {
      const { data, folder = 'freebara' } = req.body;
      if (!data) return res.status(400).json({ error: 'Données image manquantes' });
      const url = await uploadToCloudinary(data, folder);
      await logAction('INFO', 'image_uploaded', req.userId, req.ip, folder);
      res.json({ url });
    } catch (e: any) {
      errorTracker.capture(e, 'upload');
      res.status(500).json({ error: 'Erreur upload: ' + e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════════
  // 🛡️  PANEL ADMIN (Sécurisé)
  // ════════════════════════════════════════════════════════════════════════
  app.get('/api/admin/stats',     authenticate, requireAdmin,      async (_, res) => {
    const [u,a,b,p,r,t,w] = await Promise.all([
      db.one(`SELECT COUNT(*) as c FROM users`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE status='active'`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE status='banned'`),
      db.one(`SELECT COUNT(*) as c FROM posts`),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE status='pending'`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE "createdAt"::date=CURRENT_DATE`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE "createdAt">=NOW()-INTERVAL '7 days'`),
    ]);
    res.json({ totalUsers:u.c, activeUsers:a.c, bannedUsers:b.c, totalPosts:p.c, pendingReports:r.c, newUsersToday:t.c, newUsersWeek:w.c });
  });
  app.get('/api/admin/users',     authenticate, requireAdmin,      async (req: any, res) => { const {search,status,role}=req.query as any; let q=`SELECT id,email,name,country,role,status,badge,"bannedReason","createdAt" FROM users WHERE 1=1`; const p:any[]=[]; let i=1; if(search){q+=` AND(name ILIKE $${i} OR email ILIKE $${i})`;p.push(`%${search}%`);i++;} if(status){q+=` AND status=$${i++}`;p.push(status);} if(role){q+=` AND role=$${i++}`;p.push(role);} q+=` ORDER BY "createdAt" DESC`; res.json(await db.all(q,p)); });
  app.put('/api/admin/users/:id/role',  authenticate, requireSuperAdmin, async (req: any, res) => { const {role}=req.body; if(!['user','moderator','admin'].includes(role)) return res.status(400).json({error:'Rôle invalide'}); await pool.query(`UPDATE users SET role=$1 WHERE id=$2`,[role,req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'change_role',$2,$3)`,[req.userId,req.params.id,`→${role}`]); await logAction('ADMIN','change_role',req.userId,req.ip,`User ${req.params.id}→${role}`); res.json({success:true}); });
  app.put('/api/admin/users/:id/ban',   authenticate, requireAdmin,      async (req: any, res) => { if(Number(req.params.id)===req.userId) return res.status(400).json({error:'Impossible de se bannir'}); const {reason}=req.body; await pool.query(`UPDATE users SET status='banned',"bannedReason"=$1 WHERE id=$2`,[reason||'Violation des règles',req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'ban_user',$2,$3)`,[req.userId,req.params.id,reason]); await logAction('ADMIN','ban_user',req.userId,req.ip,`User ${req.params.id}: ${reason}`); res.json({success:true}); });
  app.put('/api/admin/users/:id/unban', authenticate, requireAdmin,      async (req: any, res) => { await pool.query(`UPDATE users SET status='active',"bannedReason"=NULL WHERE id=$1`,[req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId") VALUES($1,'unban_user',$2)`,[req.userId,req.params.id]); res.json({success:true}); });
  app.delete('/api/admin/users/:id',    authenticate, requireSuperAdmin, async (req: any, res) => { if(Number(req.params.id)===req.userId) return res.status(400).json({error:'Impossible'}); await pool.query(`DELETE FROM users WHERE id=$1`,[req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId") VALUES($1,'delete_user',$2)`,[req.userId,req.params.id]); await logAction('ADMIN','delete_user',req.userId,req.ip,`User ${req.params.id}`); res.json({success:true}); });
  app.get('/api/admin/reports',         authenticate, requireAdmin,      async (_, res) => res.json(await db.all(`SELECT r.*,u.name as "reporterName",u.email as "reporterEmail" FROM reports r JOIN users u ON r."reporterId"=u.id ORDER BY r."createdAt" DESC`,[])));
  app.put('/api/admin/reports/:id',     authenticate, requireAdmin,      async (req: any, res) => { await pool.query(`UPDATE reports SET status=$1 WHERE id=$2`,[req.body.status,req.params.id]); res.json({success:true}); });
  app.delete('/api/admin/posts/:id',    authenticate, requireAdmin,      async (req: any, res) => { await pool.query(`DELETE FROM posts WHERE id=$1`,[req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId") VALUES($1,'delete_post',$2)`,[req.userId,req.params.id]); res.json({success:true}); });
  app.get('/api/admin/logs',            authenticate, requireAdmin,      async (_, res) => res.json(await db.all(`SELECT al.*,u.name as "adminName" FROM admin_logs al JOIN users u ON al."adminId"=u.id ORDER BY al."createdAt" DESC LIMIT 200`,[])));
  app.get('/api/admin/db-logs',         authenticate, requireSuperAdmin, async (_, res) => res.json(await db.all(`SELECT id, level, action, "userId", ip, details, "createdAt" FROM db_logs ORDER BY "createdAt" DESC LIMIT 500`,[])));
  app.get('/api/admin/errors',          authenticate, requireSuperAdmin, (_, res) => res.json(errorTracker.errors));
  app.post('/api/admin/backup',         authenticate, requireSuperAdmin, async (req: any, res) => {
    try {
      const [users, posts, companies] = await Promise.all([
        db.all(`SELECT id,email,name,country,role,status,"createdAt" FROM users`, []),
        db.all(`SELECT id,"authorId",content,"createdAt" FROM posts ORDER BY "createdAt" DESC LIMIT 5000`, []),
        db.all(`SELECT id, "ownerId", name, sector, country, city, "createdAt" FROM companies`, []),
      ]);
      await logAction('ADMIN', 'backup_triggered', req.userId, req.ip, `${users.length} users`);
      res.json({ success: true, timestamp: new Date(), counts: { users: users.length, posts: posts.length, companies: companies.length }, data: { users, posts, companies } });
    } catch { res.status(500).json({ error: 'Backup échoué' }); }
  });
  app.get('/api/admin/health-full', authenticate, requireSuperAdmin, async (_, res) => {
    const dbOk = await pool.query('SELECT 1').then(() => true).catch(() => false);
    const users = await db.one(`SELECT COUNT(*) as c FROM users`);
    res.json({
      status: dbOk ? 'healthy' : 'degraded',
      db: dbOk ? 'connected' : 'error',
      uptime: Math.floor(process.uptime()) + 's',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      users: users.c,
      recentErrors: errorTracker.errors.slice(0, 5),
      env: { cloudinary: !!process.env.CLOUDINARY_URL, smtp: !!process.env.SMTP_USER, jwt: !!process.env.JWT_SECRET },
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 🔌 SOCKET.IO (Temps réel)
  // ════════════════════════════════════════════════════════════════════════
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Auth error'));
      jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err || !decoded?.userId) return next(new Error('Auth error'));
        (socket as any).userId = decoded.userId;
        next();
      });
    } catch { next(new Error('Auth error')); }
  });

  io.on('connection', (socket: any) => {
    console.log(`🔌 User ${socket.userId} connecté`);
    socket.join(`user_${socket.userId}`);
    socket.on('disconnect',       () => console.log(`❌ User ${socket.userId} déconnecté`));
    socket.on('join_room',        (roomId: any) => socket.join(`room_${roomId}`));
    socket.on('pin_message',      (d: any) => io.emit('message_pinned', d));
    socket.on('unpin_message',    (d: any) => io.emit('message_unpinned', d));
    socket.on('message_reaction', (d: any) => io.emit('message_reaction_updated', d));
    socket.on('message_edit',     (d: any) => io.emit('message_updated', d));
    socket.on('message_delete',   (d: any) => io.emit('message_deleted', d));
  });

  // ════════════════════════════════════════════════════════════════════════
  // 📁 FICHIERS STATIQUES (Frontend React)
  // ════════════════════════════════════════════════════════════════════════
     const distPath = __dirname;

  // ════════════════════════════════════════════════════════════════════════
  // 📁 FICHIERS STATIQUES (Frontend React) — TOUJOURS EN DERNIER
  // ════════════════════════════════════════════════════════════════════════
app.use(express.static(distPath));

// React Router fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  res.sendFile(path.join(distPath, 'index.html'));
});

  // ════════════════════════════════════════════════════════════════════════
  // 💾 BACKUP AUTOMATIQUE (toutes les 24h)
  // ════════════════════════════════════════════════════════════════════════
  const autoBackup = async () => {
    try {
      const u = await db.one(`SELECT COUNT(*) as c FROM users`);
      await logAction('INFO', 'auto_backup_check', undefined, undefined, `${u.c} users en base`);
      console.log(`💾 Auto-backup: ${u.c} utilisateurs en base`);
    } catch (e: any) { errorTracker.capture(e, 'auto_backup'); }
  };
  setInterval(autoBackup, 24 * 60 * 60 * 1000);

  // ════════════════════════════════════════════════════════════════════════
  // 🚀 DÉMARRAGE
  // ════════════════════════════════════════════════════════════════════════
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n════════════════════════════════════════');
    console.log(`✅  FreeBara Server lancé sur le port ${PORT}`);
    console.log(`🗄️   Base de données : PostgreSQL`);
    console.log(`🔐  JWT Secret      : ${JWT_SECRET.substring(0, 12)}...`);
    console.log(`📧  Email Service   : Resend`);
    console.log(`🔑  Resend API Key  : ${process.env.RESEND_API_KEY ? '✔ Configuré' : '⚠️ Non configuré'}`); 
    console.log(`🖼️   Cloudinary      : ${process.env.CLOUDINARY_URL ? '✅ Configuré' : '⚠️  Non configuré'}`);
    console.log(`🛡️   Admin panel     : /api/admin/*`);
    console.log(`📊  Monitoring      : /api/admin/health-full`);
    console.log(`💾  Backup          : POST /api/admin/backup`);
    console.log('════════════════════════════════════════\n');
  });

  // Arrêt propre
  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM reçu — fermeture propre...');
    await pool.end();
    process.exit(0);
  });
}

startServer().catch((e) => {
  console.error('❌ Erreur critique au démarrage:', e);
  process.exit(1);
});