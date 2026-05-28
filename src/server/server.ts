// ════════════════════════════════════════════════════════════════════════════
// 🚀 FREEBARA SERVER v2 — Architecture modulaire | PostgreSQL | Production
// ════════════════════════════════════════════════════════════════════════════
console.log('🚀 FreeBara Server démarrage...');

import express        from 'express';
import { createServer }  from 'http';
import { Server }        from 'socket.io';
import cors              from 'cors';
import { fileURLToPath } from 'url';
import dotenv            from 'dotenv';
import * as path         from 'path';
import jwt               from 'jsonwebtoken';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_DEV    = process.env.NODE_ENV !== 'production';
const PORT      = parseInt(process.env.PORT || '3000');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

// ─── Validation config ───────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') { console.error('❌ JWT_SECRET manquant'); process.exit(1); }
  console.warn('⚠️  Mode DEV — JWT_SECRET temporaire');
}
if (!process.env.DATABASE_URL) { console.error('❌ DATABASE_URL manquant'); process.exit(1); }
if (!process.env.SMTP_USER)     console.warn('⚠️  SMTP non configuré');
if (!process.env.CLOUDINARY_URL) console.warn('⚠️  CLOUDINARY_URL manquant');

// ─── CORS ───────────────────────────────────────────────────────────────────
export const ALLOWED_ORIGINS = [
  'https://www.freebara.com',
  'https://freebara.com',
  'https://freebaraapp-2.onrender.com',
  ...(IS_DEV ? ['http://localhost:5173', 'http://localhost:3000'] : []),
];

// ─── Imports modules ─────────────────────────────────────────────────────────
import { pool, db }          from './config/db.js';
import { initDB }            from './database/init.js';
import { runMigrations }     from './database/migrations.js';
import { cacheGet, cacheSet, cacheDel, cacheSize } from './services/cache.js';
import { metrics, errorTracker } from './services/metrics.js';
import { enqueueJob, jobQueue }  from './services/Queue.js';
import { uploadToCloudinary }    from './services/cloudinary.js';
import { startBackupJobs, getBackupHistory, snapshotCounts } from './services/backup.js';
import { analyzeContent, autoModerate, incrementSpamCounter, moderationCache } from './middleware/moderation.js';
import { authenticate, requireAdmin, requireSuperAdmin } from './middleware/auth.js';
import { rateLimit }         from './middleware/rateLimit.js';
import { validate, schemas } from './middleware/validate.js';
import { isValidEmail, sendOTPEmail } from './services/email.js';
import { hashOtp }           from './config/db.js';

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  user:      ['posts:read','posts:write','messages:read','messages:write','profile:read','profile:write','companies:read','events:read'],
  moderator: ['posts:read','posts:write','posts:delete','messages:read','users:read','reports:read','reports:write','companies:read','events:read','events:delete'],
  admin:     ['*'],
};
const hasPermission = async (userId: number, role: string, resource: string, action: string) => {
  const key = `${resource}:${action}`;
  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  if (rolePerms.includes('*') || rolePerms.includes(key)) return true;
  try { const p = await db.one(`SELECT granted FROM permissions WHERE "userId"=$1 AND resource=$2 AND action=$3`, [userId, resource, action]); return p?.granted === true; } catch { return false; }
};

// ─── AUDIT ───────────────────────────────────────────────────────────────────
const audit = async (req: any, action: string, resource: string, resourceId?: number, before?: any, after?: any) => {
  try { await pool.query(`INSERT INTO audit_trail("userId",action,resource,"resourceId",ip,"userAgent",before,after) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [req.userId ?? null, action, resource, resourceId ?? null, req.ip ?? null, req.headers?.['user-agent'] ?? null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]); } catch {}
};
const logAction = async (level: string, action: string, userId?: number, ip?: string, details?: string) => {
  try { await pool.query(`INSERT INTO db_logs(level,action,"userId",ip,details) VALUES($1,$2,$3,$4,$5)`, [level, action, userId ?? null, ip ?? null, details ?? null]); } catch {}
};

// ════════════════════════════════════════════════════════════════════════════
async function startServer() {
  await initDB();
  await runMigrations();
  await startBackupJobs();

  const app        = express();
  const httpServer = createServer(app);
  const io         = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET','POST'], credentials: true },
  });

  // ─── MIDDLEWARE ────────────────────────────────────────────────────────────
  app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ─── SÉCURITÉ HEADERS ─────────────────────────────────────────────────────
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options',    'nosniff');
    res.setHeader('X-Frame-Options',           'DENY');
    res.setHeader('X-XSS-Protection',          '1; mode=block');
    res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy',        'camera=(), microphone=(), geolocation=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy',   "default-src 'self'; connect-src 'self' https://api.cloudinary.com wss://www.freebara.com");
    next();
  });

  // ─── MONITORING MIDDLEWARE ─────────────────────────────────────────────────
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    metrics.requests++;
    res.on('finish', () => {
      const ms = Date.now() - start;
      metrics.recordResponseTime(ms);
      if (res.statusCode >= 400) metrics.errors++;
      const log = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
      if (res.statusCode >= 500) console.error('🔴 ' + log);
      else if (res.statusCode >= 400) console.warn('🟡 ' + log);
      else if (ms > 3000) console.warn('🐢 SLOW ' + log);
    });
    next();
  });

  // ─── RATE LIMITING ─────────────────────────────────────────────────────────
  app.use('/api/auth/request-otp', rateLimit(5,  10*60000, 60*60000));
  app.use('/api/auth/verify-otp',  rateLimit(10, 10*60000, 30*60000));
  app.use('/api/auth',             rateLimit(20, 60000));
  app.use('/api',                  rateLimit(300, 60000));

  // ─── HEALTH CHECK ──────────────────────────────────────────────────────────
  app.get('/api/health', async (_, res) => {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      res.json({ status:'ok', db:'postgresql', dbLatency:`${Date.now()-start}ms`, uptime:`${Math.floor(process.uptime())}s`, memory:`${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB`, cacheSize:cacheSize(), queueSize:jobQueue.length, time:new Date() });
    } catch { res.status(500).json({ status:'error', db:'disconnected' }); }
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
        [email, hashOtp(code), exp]
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
      const otp = await db.one(
        `SELECT email, code FROM otps WHERE email=$1 AND "expiresAt" > NOW()`,
        [email]
      );
      if (!otp || otp.code !== hashOtp(code)) {
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
      await pool.query(`UPDATE users SET "loginCount"=COALESCE("loginCount",0)+1,"lastSeen"=NOW() WHERE id=$1`, [user.id]);
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
      const cacheKey = `profile:${req.userId}`;
      let u = cacheGet(cacheKey);
      if (!u) {
        u = await db.one(`SELECT id, email, name, profession, bio, company, "companyId", "avatarUrl", "coverUrl", phone, location, website, church, groups, interests, skills, marketing, goals, badge, "referralCode", balance, role, status, visibility, country, age, "maritalStatus", whatsapp, "externalPortfolioUrl", "createdAt", "notificationPreferences", "lastSeen", "loginCount" FROM users WHERE id=$1`, [req.userId]);
        if (!u) return res.status(404).json({ error: 'Introuvable' });
        if (!u.notificationPreferences) u.notificationPreferences = {};
        // Calcul badges (mis en cache aussi)
        const conn = await db.one(`SELECT COUNT(*) as n FROM follows WHERE "followerId"=$1 OR "followingId"=$1`, [req.userId]);
        const badges: string[] = [];
        if (conn.n >= 100) badges.push('Super Connecteur');
        if (conn.n >= 50)  badges.push('Réseauteur Actif');
        if (conn.n >= 10)  badges.push('Sociable');
        u.badges = badges;
        cacheSet(cacheKey, u, 60000); // cache 60s
      }
      res.json(u);
    } catch (e: any) { errorTracker.capture(e, 'get-me'); res.status(500).json({ error: 'Erreur' }); }
  });

  app.put('/api/users/me', authenticate, async (req: any, res) => {
    const {
      name, profession, bio, company, companyId, avatarUrl, coverUrl,
      phone, location, website, church, groups, interests, skills,
      marketing, goals, notificationPreferences, visibility, country,
      age, maritalStatus, whatsapp, externalPortfolioUrl
    } = req.body;
    await pool.query(
      `UPDATE users SET
        name=$1, profession=$2, bio=$3, company=$4, "companyId"=$5,
        "avatarUrl"=$6, "coverUrl"=$7, phone=$8, location=$9, website=$10,
        church=$11, groups=$12, interests=$13, skills=$14, marketing=$15,
        goals=$16, "notificationPreferences"=$17, visibility=$18, country=$19,
        age=$20, "maritalStatus"=$21, whatsapp=$22, "externalPortfolioUrl"=$23
       WHERE id=$24`,
      [name, profession, bio, company, companyId ?? null,
       avatarUrl, coverUrl, phone, location, website,
       church, groups, interests, skills, marketing,
       goals, notificationPreferences ?? null, visibility, country,
       age ?? null, maritalStatus ?? null, whatsapp ?? null, externalPortfolioUrl ?? null,
       req.userId]
    );
    cacheDel(`profile:${req.userId}`, `auth:${req.userId}`);
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
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    let q = `SELECT id,name,profession,"avatarUrl",country,badge,company,role FROM users WHERE status='active'`;
    const p: any[] = []; let i = 1;
    if (country && country !== 'Tous') { q += ` AND country=$${i++}`; p.push(country); }
    if (profession) { q += ` AND profession ILIKE $${i++}`; p.push(`%${profession}%`); }
    q += ` ORDER BY "createdAt" DESC LIMIT $${i++} OFFSET $${i++}`;
    p.push(limit, offset);
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
      // Notification via queue (non-bloquant)
      enqueueJob('notif', { userId: req.params.id, type: 'follow', content: `${f.name} a commencé à vous suivre.`, relatedId: req.userId });
      const n = { type: 'follow', content: `${f.name} a commencé à vous suivre.`, read: false, createdAt: new Date() };
      io.to(`user_${req.params.id}`).emit('notification', n);
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
      const page=parseInt(req.query.page as string)||1;
      const limit=Math.min(parseInt(req.query.limit as string)||10, 50); // max 50
      const offset=(page-1)*limit;
      const {category,country,feedType,search}=req.query as any;
      const authorId=req.query.authorId?parseInt(req.query.authorId as string):null;

      // Cache uniquement le feed public page 1 sans filtres (le plus chargé)
      const isPublicFeed = !authorId && !feedType && !category && !country && !search && page === 1;
      const cacheKey = `posts:public:${req.userId}`;
      if (isPublicFeed) {
        const cached = cacheGet(cacheKey);
        if (cached) return res.json(cached);
      }

      let q=`SELECT p.id,p."authorId",p.content,p.category,p."mediaUrls",p.views,p."createdAt",p."cellId",u.name as "authorName",u."avatarUrl" as "authorAvatar",u.profession as "authorProfession",u.country as "authorCountry",(SELECT COUNT(*) FROM post_likes WHERE "postId"=p.id) as "likesCount",(SELECT COUNT(*) FROM post_comments WHERE "postId"=p.id) as "commentsCount",(SELECT type FROM post_likes WHERE "postId"=p.id AND "userId"=$1) as "myReactionType",EXISTS(SELECT 1 FROM post_boosts WHERE "postId"=p.id) as "isBoosted" FROM posts p JOIN users u ON p."authorId"=u.id WHERE 1=1`;
      const p:any[]=[req.userId]; let i=2;
      if(authorId){q+=` AND p."authorId"=$${i++}`;p.push(authorId);}
      if(feedType==='network'){q+=` AND p."authorId" IN(SELECT "followingId" FROM follows WHERE "followerId"=$${i++})`;p.push(req.userId);}
      if(category&&category!=='Tous'){q+=` AND p.category=$${i++}`;p.push(category);}
      if(country&&country!=='Tous'){q+=` AND u.country=$${i++}`;p.push(country);}
      if(search){q+=` AND(p.content ILIKE $${i} OR u.name ILIKE $${i})`;p.push(`%${search}%`);i++;}
      q+=` ORDER BY "isBoosted" DESC,p."createdAt" DESC LIMIT $${i++} OFFSET $${i++}`;p.push(limit,offset);

      const result = await db.all(q, p);
      if (isPublicFeed) cacheSet(cacheKey, result, 15000); // cache 15s
      res.json(result);
    } catch(e:any){errorTracker.capture(e,'get-posts');res.status(500).json({error:'Erreur'});}
  });

  app.post('/api/posts', authenticate, async (req: any, res) => {
    const { content, category, mediaUrls, cellId } = req.body;
    if (!content && (!mediaUrls || !mediaUrls.length)) return res.status(400).json({ error: 'Contenu requis' });

    // ── Modération automatique ─────────────────────────────────────────
    if (content) {
      const mod = await analyzeContent(content, req.userId);
      if (mod.action === 'block') {
        await incrementSpamCounter(req.userId, 'post');
        return res.status(400).json({
          error: 'Publication refusée : contenu inapproprié détecté.',
          reasons: mod.reasons,
        });
      }
    }

    const post = await db.one(
      `INSERT INTO posts("authorId",content,category,"mediaUrls","cellId") VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId, content || '', category || 'Tous', mediaUrls ?? null, cellId || null]
    );

    // Si flagué (mais pas bloqué), enregistrer en arrière-plan
    if (content) {
      autoModerate(content, req.userId, 'post', post.id, req.ip).catch(() => {});
      incrementSpamCounter(req.userId, 'post').catch(() => {});
    }

    cacheDel('posts:public:');
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
  app.get('/api/companies',          authenticate, async (_, res) => {
    const cached = cacheGet('companies:all');
    if (cached) return res.json(cached);
    const data = await db.all(`SELECT c.*,u.name as "ownerName" FROM companies c JOIN users u ON c."ownerId"=u.id ORDER BY c."createdAt" DESC`, []);
    cacheSet('companies:all', data, 60000);
    res.json(data);
  });
  app.get('/api/companies/new',      authenticate, async (_, res) => {
    const cached = cacheGet('companies:new');
    if (cached) return res.json(cached);
    const data = await db.all(`SELECT id, "ownerId", name, sector, description, "logoUrl", "coverUrl", country, city, "isShop", "createdAt" FROM companies ORDER BY "createdAt" DESC LIMIT 10`, []);
    cacheSet('companies:new', data, 60000);
    res.json(data);
  });
  app.get('/api/companies/trending', authenticate, async (_, res) => {
    const cached = cacheGet('companies:trending');
    if (cached) return res.json(cached);
    const data = await db.all(`SELECT c.*,(SELECT COUNT(*) FROM favorite_companies WHERE "companyId"=c.id) as fav FROM companies c ORDER BY fav DESC LIMIT 10`, []);
    cacheSet('companies:trending', data, 120000); // 2min
    res.json(data);
  });
  app.post('/api/companies',   authenticate, async (req: any, res) => { const {name,sector,description,address,whatsapp,facebook,twitter,linkedin,logoUrl,coverUrl,isShop,specialty,categories,country,city}=req.body; const r=await db.one(`INSERT INTO companies("ownerId",name,sector,description,address,whatsapp,facebook,twitter,linkedin,"logoUrl","coverUrl","isShop",specialty,categories,country,city) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,[req.userId,name,sector,description,address,whatsapp,facebook,twitter,linkedin,logoUrl,coverUrl,isShop||false,specialty,categories,country,city]); cacheDel('companies:'); res.json(r); });
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
    try {
      const direct = await db.all(`
        SELECT u.id,u.name,u."avatarUrl",
          MAX(m."createdAt") as "lastMessageAt",
          (SELECT content FROM messages WHERE(("senderId"=u.id AND "receiverId"=$1) OR("senderId"=$1 AND "receiverId"=u.id)) AND "roomId" IS NULL ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage",
          (SELECT COUNT(*) FROM messages WHERE "senderId"=u.id AND "receiverId"=$1 AND read=FALSE AND "roomId" IS NULL) as "unreadCount",
          'direct' as type
        FROM users u
        JOIN messages m ON (u.id=m."senderId" OR u.id=m."receiverId")
        WHERE (m."senderId"=$1 OR m."receiverId"=$1) AND u.id!=$1 AND m."roomId" IS NULL
        GROUP BY u.id,u.name,u."avatarUrl"`, [req.userId]);

      const rooms = await db.all(`
        SELECT cr.id,cr.name,cr."avatarUrl",
          MAX(m."createdAt") as "lastMessageAt",
          (SELECT content FROM messages WHERE "roomId"=cr.id ORDER BY "createdAt" DESC LIMIT 1) as "lastMessage",
          (SELECT COUNT(*) FROM messages WHERE "roomId"=cr.id AND read=FALSE AND "senderId"!=$1) as "unreadCount",
          cr.type
        FROM chat_rooms cr
        JOIN chat_room_members crm ON cr.id=crm."roomId"
        LEFT JOIN messages m ON cr.id=m."roomId"
        WHERE crm."userId"=$1
        GROUP BY cr.id`, [req.userId]);

      res.json([...direct, ...rooms].sort((a: any, b: any) =>
        new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
      ));
    } catch (e: any) { errorTracker.capture(e, 'conversations'); res.status(500).json({ error: 'Erreur' }); }
  });
  app.get('/api/messages/:userId',    authenticate, async (req: any, res) => res.json(await db.all(`SELECT m.*,u.name as "senderName",u."avatarUrl" as "senderAvatar" FROM messages m JOIN users u ON m."senderId"=u.id WHERE(m."senderId"=$1 AND m."receiverId"=$2) OR(m."senderId"=$2 AND m."receiverId"=$1) ORDER BY m."createdAt" ASC`,[req.userId,req.params.userId])));
  app.post('/api/messages/:userId', authenticate, async (req: any, res) => {
    const { content, fileUrl, fileType, fileName } = req.body;

    // ── Modération automatique ─────────────────────────────────────────
    if (content) {
      const mod = await analyzeContent(content, req.userId);
      if (mod.action === 'block') {
        await incrementSpamCounter(req.userId, 'message');
        return res.status(400).json({ error: 'Message refusé : contenu inapproprié.', reasons: mod.reasons });
      }
    }

    const msg = await db.one(
      `INSERT INTO messages("senderId","receiverId",content,"fileUrl","fileType","fileName") VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, req.params.userId, content || '', fileUrl, fileType, fileName]
    );
    const s = await db.one(`SELECT name,"avatarUrl" FROM users WHERE id=$1`, [req.userId]);
    const full = { ...msg, senderName: s.name, senderAvatar: s.avatarurl };
    io.to(`user_${req.params.userId}`).emit('new_message', full);

    if (content) incrementSpamCounter(req.userId, 'message').catch(() => {});
    res.json(full);
  });
  app.put('/api/messages/:userId/read',  authenticate, async (req: any, res) => { await pool.query(`UPDATE messages SET read=TRUE WHERE "senderId"=$1 AND "receiverId"=$2`,[req.params.userId,req.userId]); res.json({success:true}); });
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
  app.post('/api/reports', authenticate, async (req: any, res) => {
    const { targetType, targetId, reason, details } = req.body;
    if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Données manquantes' });

    // Anti-abus : max 10 signalements par heure par utilisateur
    const recentReports = await db.one(
      `SELECT COUNT(*) as c FROM reports WHERE "reporterId"=$1 AND "createdAt">NOW()-INTERVAL '1 hour'`,
      [req.userId]
    );
    if (parseInt(recentReports?.c ?? 0) >= 10) {
      return res.status(429).json({ error: 'Trop de signalements. Réessayez plus tard.' });
    }

    await pool.query(
      `INSERT INTO reports("reporterId","targetType","targetId",reason) VALUES($1,$2,$3,$4)`,
      [req.userId, targetType, targetId, details ? `${reason} — ${details}` : reason]
    );
    await incrementSpamCounter(req.userId, 'flag');

    // Vérifier si ce contenu a été signalé +3 fois → auto-escalade
    const reportCount = await db.one(
      `SELECT COUNT(*) as c FROM reports WHERE "targetType"=$1 AND "targetId"=$2 AND status='pending'`,
      [targetType, targetId]
    );
    if (parseInt(reportCount?.c ?? 0) >= 3) {
      await pool.query(
        `UPDATE reports SET severity='high' WHERE "targetType"=$1 AND "targetId"=$2 AND status='pending'`,
        [targetType, targetId]
      );
      await logAction('WARN', 'multi_report_escalated', req.userId, req.ip, `${targetType}:${targetId}`);
    }

    res.json({ success: true });
  });

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
  app.get('/api/admin/stats',     authenticate, requireAdmin, async (_, res) => {
    const [u,a,b,p,r,t,w,msg,comp] = await Promise.all([
      db.one(`SELECT COUNT(*) as c FROM users`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE status='active'`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE status='banned'`),
      db.one(`SELECT COUNT(*) as c FROM posts`),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE status='pending'`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE "createdAt"::date=CURRENT_DATE`),
      db.one(`SELECT COUNT(*) as c FROM users WHERE "createdAt">=NOW()-INTERVAL '7 days'`),
      db.one(`SELECT COUNT(*) as c FROM messages WHERE "createdAt">=NOW()-INTERVAL '24 hours'`),
      db.one(`SELECT COUNT(*) as c FROM companies`),
    ]);
    res.json({ totalUsers:u.c, activeUsers:a.c, bannedUsers:b.c, totalPosts:p.c, pendingReports:r.c, newUsersToday:t.c, newUsersWeek:w.c, messagesLast24h:msg.c, totalCompanies:comp.c });
  });
  app.get('/api/admin/users',     authenticate, requireAdmin,      async (req: any, res) => { const {search,status,role}=req.query as any; let q=`SELECT id,email,name,country,role,status,badge,"bannedReason","createdAt" FROM users WHERE 1=1`; const p:any[]=[]; let i=1; if(search){q+=` AND(name ILIKE $${i} OR email ILIKE $${i})`;p.push(`%${search}%`);i++;} if(status){q+=` AND status=$${i++}`;p.push(status);} if(role){q+=` AND role=$${i++}`;p.push(role);} q+=` ORDER BY "createdAt" DESC`; res.json(await db.all(q,p)); });
  app.put('/api/admin/users/:id/role',  authenticate, requireSuperAdmin, async (req: any, res) => { const {role}=req.body; if(!['user','moderator','admin'].includes(role)) return res.status(400).json({error:'Rôle invalide'}); await pool.query(`UPDATE users SET role=$1 WHERE id=$2`,[role,req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'change_role',$2,$3)`,[req.userId,req.params.id,`→${role}`]); await logAction('ADMIN','change_role',req.userId,req.ip,`User ${req.params.id}→${role}`); res.json({success:true}); });
  app.put('/api/admin/users/:id/ban',   authenticate, requireAdmin, async (req: any, res) => {
    if(Number(req.params.id)===req.userId) return res.status(400).json({error:'Impossible de se bannir'});
    const {reason}=req.body;
    const before = await db.one(`SELECT status FROM users WHERE id=$1`,[req.params.id]);
    await pool.query(`UPDATE users SET status='banned',"bannedReason"=$1 WHERE id=$2`,[reason||'Violation des règles',req.params.id]);
    await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'ban_user',$2,$3)`,[req.userId,req.params.id,reason]);
    await audit(req,'ban','users',Number(req.params.id),before,{status:'banned',reason});
    cacheDel(`auth:${req.params.id}`,`profile:${req.params.id}`);
    await logAction('ADMIN','ban_user',req.userId,req.ip,`User ${req.params.id}: ${reason}`);
    res.json({success:true});
  });
  app.put('/api/admin/users/:id/unban', authenticate, requireAdmin,      async (req: any, res) => { await pool.query(`UPDATE users SET status='active',"bannedReason"=NULL WHERE id=$1`,[req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId") VALUES($1,'unban_user',$2)`,[req.userId,req.params.id]); res.json({success:true}); });
  app.delete('/api/admin/users/:id',    authenticate, requireSuperAdmin, async (req: any, res) => { if(Number(req.params.id)===req.userId) return res.status(400).json({error:'Impossible'}); await pool.query(`DELETE FROM users WHERE id=$1`,[req.params.id]); await pool.query(`INSERT INTO admin_logs("adminId",action,"targetId") VALUES($1,'delete_user',$2)`,[req.userId,req.params.id]); await logAction('ADMIN','delete_user',req.userId,req.ip,`User ${req.params.id}`); res.json({success:true}); });
  // ════════════════════════════════════════════════════════════════════════
  // 🛡️  MODÉRATION — Panel admin complet
  // ════════════════════════════════════════════════════════════════════════

  // ── Liste des signalements (filtrable) ───────────────────────────────────
  app.get('/api/admin/reports', authenticate, requireAdmin, async (req: any, res) => {
    const { status = 'pending', severity, autoFlag, targetType, limit = 50 } = req.query as any;
    let q = `SELECT r.*,
               u.name as "reporterName", u.email as "reporterEmail",
               m.name as "reviewerName"
             FROM reports r
             JOIN users u ON r."reporterId"=u.id
             LEFT JOIN users m ON r."reviewedBy"=m.id
             WHERE 1=1`;
    const p: any[] = []; let i = 1;
    if (status)     { q += ` AND r.status=$${i++}`;      p.push(status); }
    if (severity)   { q += ` AND r.severity=$${i++}`;    p.push(severity); }
    if (autoFlag)   { q += ` AND r."autoFlag"=$${i++}`;  p.push(autoFlag === 'true'); }
    if (targetType) { q += ` AND r."targetType"=$${i++}`; p.push(targetType); }
    q += ` ORDER BY r."createdAt" DESC LIMIT $${i}`; p.push(Math.min(parseInt(limit), 200));
    res.json(await db.all(q, p));
  });

  // ── Résoudre un signalement ──────────────────────────────────────────────
  app.put('/api/admin/reports/:id', authenticate, requireAdmin, async (req: any, res) => {
    const { status, moderatorNote } = req.body;
    if (!['pending','reviewed','action_taken','dismissed'].includes(status))
      return res.status(400).json({ error: 'Statut invalide' });
    await pool.query(
      `UPDATE reports SET status=$1,"reviewedBy"=$2,"reviewedAt"=NOW(),"moderatorNote"=$3 WHERE id=$4`,
      [status, req.userId, moderatorNote ?? null, req.params.id]
    );
    await pool.query(
      `INSERT INTO moderation_actions("moderatorId","targetType","targetId",action,reason,"reportId")
       SELECT $1,"targetType","targetId",$2,$3,id FROM reports WHERE id=$4`,
      [req.userId, status, moderatorNote ?? '', req.params.id]
    );
    res.json({ success: true });
  });

  // ── Supprimer un post (admin) ────────────────────────────────────────────
  app.delete('/api/admin/posts/:id', authenticate, requireAdmin, async (req: any, res) => {
    const post = await db.one(`SELECT "authorId", content FROM posts WHERE id=$1`, [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    await pool.query(`DELETE FROM posts WHERE id=$1`, [req.params.id]);
    await pool.query(
      `INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'delete_post',$2,$3)`,
      [req.userId, req.params.id, `authorId:${post.authorid}`]
    );
    await audit(req, 'delete_post', 'posts', Number(req.params.id), post, null);
    cacheDel('posts:public:');
    res.json({ success: true });
  });

  // ── Supprimer un message (admin) ─────────────────────────────────────────
  app.delete('/api/admin/messages/:id', authenticate, requireAdmin, async (req: any, res) => {
    const msg = await db.one(`SELECT "senderId", content FROM messages WHERE id=$1`, [req.params.id]);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    await pool.query(`DELETE FROM messages WHERE id=$1`, [req.params.id]);
    await pool.query(
      `INSERT INTO admin_logs("adminId",action,"targetId",details) VALUES($1,'delete_message',$2,$3)`,
      [req.userId, req.params.id, `senderId:${msg.senderid}`]
    );
    res.json({ success: true });
  });

  // ── Muter un utilisateur ─────────────────────────────────────────────────
  app.put('/api/admin/users/:id/mute', authenticate, requireAdmin, async (req: any, res) => {
    const { hours = 24, reason } = req.body;
    const mutedUntil = new Date(Date.now() + Math.min(hours, 720) * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO spam_counters("userId","isMuted","mutedUntil")
       VALUES($1,TRUE,$2)
       ON CONFLICT("userId") DO UPDATE SET "isMuted"=TRUE,"mutedUntil"=$2`,
      [req.params.id, mutedUntil]
    );
    await pool.query(
      `INSERT INTO moderation_actions("moderatorId","targetType","targetId",action,reason)
       VALUES($1,'user',$2,'mute',$3)`,
      [req.userId, req.params.id, reason ?? '']
    );
    await logAction('ADMIN', 'mute_user', req.userId, req.ip, `User ${req.params.id} muté ${hours}h`);
    res.json({ success: true, mutedUntil });
  });

  // ── Démuter un utilisateur ───────────────────────────────────────────────
  app.put('/api/admin/users/:id/unmute', authenticate, requireAdmin, async (req: any, res) => {
    await pool.query(
      `UPDATE spam_counters SET "isMuted"=FALSE,"mutedUntil"=NULL WHERE "userId"=$1`,
      [req.params.id]
    );
    res.json({ success: true });
  });

  // ── Stats modération ─────────────────────────────────────────────────────
  app.get('/api/admin/moderation/stats', authenticate, requireAdmin, async (_, res) => {
    const [pending, critical, autoFlagged, actionsToday, mutedUsers, topOffenders] = await Promise.all([
      db.one(`SELECT COUNT(*) as c FROM reports WHERE status='pending'`),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE severity='critical' AND status='pending'`),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE "autoFlag"=TRUE AND status='pending'`),
      db.one(`SELECT COUNT(*) as c FROM moderation_actions WHERE "createdAt">=NOW()-INTERVAL '24 hours'`),
      db.one(`SELECT COUNT(*) as c FROM spam_counters WHERE "isMuted"=TRUE AND "mutedUntil">NOW()`),
      db.all(`SELECT u.id,u.name,u.email,sc."flagCount",sc."isMuted"
              FROM spam_counters sc JOIN users u ON sc."userId"=u.id
              ORDER BY sc."flagCount" DESC LIMIT 10`),
    ]);
    res.json({
      pendingReports:   parseInt(pending?.c   ?? 0),
      criticalReports:  parseInt(critical?.c  ?? 0),
      autoFlaggedToday: parseInt(autoFlagged?.c ?? 0),
      actionsToday:     parseInt(actionsToday?.c ?? 0),
      mutedUsers:       parseInt(mutedUsers?.c  ?? 0),
      topOffenders,
    });
  });

  // ── Historique actions de modération ────────────────────────────────────
  app.get('/api/admin/moderation/actions', authenticate, requireAdmin, async (req: any, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    res.json(await db.all(
      `SELECT ma.*,u.name as "moderatorName" FROM moderation_actions ma
       LEFT JOIN users u ON ma."moderatorId"=u.id
       ORDER BY ma."createdAt" DESC LIMIT $1`, [limit]
    ));
  });

  // ── Gérer les règles de modération ──────────────────────────────────────
  app.get('/api/admin/moderation/rules', authenticate, requireAdmin, async (_, res) => {
    res.json(await db.all(`SELECT * FROM moderation_rules ORDER BY severity DESC, type ASC`, []));
  });
  app.post('/api/admin/moderation/rules', authenticate, requireSuperAdmin, async (req: any, res) => {
    const { pattern, type, severity, action } = req.body;
    if (!pattern || !type) return res.status(400).json({ error: 'Pattern et type requis' });
    const r = await db.one(
      `INSERT INTO moderation_rules(pattern,type,severity,action,"createdBy")
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [pattern.toLowerCase(), type, severity ?? 'medium', action ?? 'flag', req.userId]
    );
    moderationCache.clear(); // invalider le cache d'analyse
    res.json(r);
  });
  app.put('/api/admin/moderation/rules/:id', authenticate, requireSuperAdmin, async (req: any, res) => {
    const { severity, action, isActive } = req.body;
    await pool.query(
      `UPDATE moderation_rules SET severity=$1,action=$2,"isActive"=$3 WHERE id=$4`,
      [severity, action, isActive ?? true, req.params.id]
    );
    moderationCache.clear();
    res.json({ success: true });
  });
  app.delete('/api/admin/moderation/rules/:id', authenticate, requireSuperAdmin, async (req: any, res) => {
    await pool.query(`DELETE FROM moderation_rules WHERE id=$1`, [req.params.id]);
    moderationCache.clear();
    res.json({ success: true });
  });

  // ── Tester l'analyse sur un texte (outil admin) ──────────────────────────
  app.post('/api/admin/moderation/test', authenticate, requireSuperAdmin, async (req: any, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texte requis' });
    const result = await analyzeContent(text, req.userId);
    res.json(result);
  });
  app.get('/api/admin/logs',            authenticate, requireAdmin,      async (_, res) => res.json(await db.all(`SELECT al.*,u.name as "adminName" FROM admin_logs al JOIN users u ON al."adminId"=u.id ORDER BY al."createdAt" DESC LIMIT 200`,[])));
  app.get('/api/admin/db-logs',         authenticate, requireSuperAdmin, async (_, res) => res.json(await db.all(`SELECT id, level, action, "userId", ip, details, "createdAt" FROM db_logs ORDER BY "createdAt" DESC LIMIT 500`,[])));
  app.get('/api/admin/errors',          authenticate, requireSuperAdmin, (_, res) => res.json(errorTracker.errors));

  // ── Surveillance utilisateurs ──────────────────────────────────────────────
  app.get('/api/admin/users/online',    authenticate, requireAdmin, async (_, res) => {
    const onlineUsers = await db.all(
      `SELECT id,name,email,profession,country,"avatarUrl","lastSeen","loginCount","createdAt"
       FROM users WHERE "lastSeen" >= NOW()-INTERVAL '15 minutes' ORDER BY "lastSeen" DESC`, []
    );
    res.json({ count: onlineUsers.length, users: onlineUsers });
  });

  app.get('/api/admin/users/activity',  authenticate, requireAdmin, async (req: any, res) => {
    const days = Math.max(1, Math.min(90, parseInt(req.query.days as string) || 7));
    const activity = await db.all(
      `SELECT DATE("createdAt") as date, COUNT(*) as new_users FROM users
       WHERE "createdAt" >= NOW()-INTERVAL '1 day' * $1 GROUP BY DATE("createdAt") ORDER BY date ASC`, [days]
    );
    const logins = await db.all(
      `SELECT DATE("createdAt") as date, COUNT(*) as logins FROM db_logs
       WHERE action IN('user_login','register') AND "createdAt">=NOW()-INTERVAL '1 day' * $1
       GROUP BY DATE("createdAt") ORDER BY date ASC`, [days]
    );
    res.json({ activity, logins });
  });

  app.get('/api/admin/users/:id/profile', authenticate, requireAdmin, async (req: any, res) => {
    const u = await db.one(
      `SELECT id,email,name,profession,country,role,status,badge,"bannedReason","loginCount","lastSeen","createdAt"
       FROM users WHERE id=$1`, [req.params.id]
    );
    if (!u) return res.status(404).json({ error: 'Introuvable' });
    const [posts, companies, reports] = await Promise.all([
      db.one(`SELECT COUNT(*) as c FROM posts WHERE "authorId"=$1`, [req.params.id]),
      db.one(`SELECT COUNT(*) as c FROM companies WHERE "ownerId"=$1`, [req.params.id]),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE "reporterId"=$1`, [req.params.id]),
    ]);
    res.json({ ...u, stats: { posts: posts.c, companies: companies.c, reports: reports.c } });
  });

  // ── Métriques & monitoring ────s──────────────────────────────────────────────
  app.get('/api/admin/metrics',         authenticate, requireSuperAdmin, async (req: any, res) => {
    const hours = Math.max(1, Math.min(168, parseInt(req.query.hours as string) || 24));
    const m = await db.all(
      `SELECT name, AVG(value) as avg, MAX(value) as max, MIN(value) as min,
              DATE_TRUNC('hour',"createdAt") as hour
       FROM metrics WHERE "createdAt">=NOW()-INTERVAL '1 hour' * $1
       GROUP BY name, hour ORDER BY hour ASC`, [hours]
    );
    res.json({ metrics: m, live: {
      requests: metrics.requests,
      errors: metrics.errors,
      avgResponseMs: metrics.avgResponseTime(),
      p95ResponseMs: metrics.p95ResponseTime(),
      cacheSize: cacheSize(),
      queueSize: jobQueue.length,
      uptime: Math.floor(process.uptime()),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    }});
  });

  // ── Audit trail ─────────────────────────────────────────────────────────────
  app.get('/api/admin/audit',           authenticate, requireSuperAdmin, async (req: any, res) => {
    const {userId, resource, limit=100} = req.query as any;
    let q = `SELECT at.*,u.name as "userName",u.email as "userEmail" FROM audit_trail at LEFT JOIN users u ON at."userId"=u.id WHERE 1=1`;
    const p: any[] = []; let i = 1;
    if (userId) { q += ` AND at."userId"=$${i++}`; p.push(userId); }
    if (resource) { q += ` AND at.resource=$${i++}`; p.push(resource); }
    q += ` ORDER BY at."createdAt" DESC LIMIT $${i}`; p.push(Math.min(parseInt(limit), 500));
    res.json(await db.all(q, p));
  });

  // ── Gestion permissions ──────────────────────────────────────────────────────
  app.get('/api/admin/users/:id/permissions',    authenticate, requireSuperAdmin, async (req: any, res) => {
    res.json(await db.all(`SELECT * FROM permissions WHERE "userId"=$1`, [req.params.id]));
  });
  app.post('/api/admin/users/:id/permissions',   authenticate, requireSuperAdmin, async (req: any, res) => {
    const {resource, action, granted=true} = req.body;
    await pool.query(
      `INSERT INTO permissions("userId",resource,action,granted,"grantedBy") VALUES($1,$2,$3,$4,$5)
       ON CONFLICT("userId",resource,action) DO UPDATE SET granted=$4,"grantedBy"=$5`,
      [req.params.id, resource, action, granted, req.userId]
    );
    cacheDel(`auth:${req.params.id}`);
    res.json({ success: true });
  });
  app.delete('/api/admin/users/:id/permissions/:permId', authenticate, requireSuperAdmin, async (req: any, res) => {
    await pool.query(`DELETE FROM permissions WHERE id=$1 AND "userId"=$2`, [req.params.permId, req.params.id]);
    cacheDel(`auth:${req.params.id}`);
    res.json({ success: true });
  });

  // ── Health-full enrichi ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════

  // ─── BACKUP ROUTES (admin) ────────────────────────────────────────────────
  app.get('/api/admin/backup/history', authenticate, requireAdmin, async (_, res) => {
    res.json(await getBackupHistory(48));
  });
  app.post('/api/admin/backup/snapshot', authenticate, requireSuperAdmin, async (_, res) => {
    await snapshotCounts();
    res.json({ success: true, message: 'Snapshot créé' });
  });

  // ─── SOCKET.IO ────────────────────────────────────────────────────────────
  const onlineUsers = new Map<number, string>();

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
    onlineUsers.set(socket.userId, socket.id);
    socket.join(`user_${socket.userId}`);
    pool.query(`UPDATE users SET "lastSeen"=NOW() WHERE id=$1`, [socket.userId]).catch(() => {});
    io.emit('online_count', onlineUsers.size);
    socket.on('disconnect', () => { onlineUsers.delete(socket.userId); io.emit('online_count', onlineUsers.size); });
    socket.on('join_room',        (roomId: any) => socket.join(`room_${roomId}`));
    socket.on('pin_message',      (d: any) => io.emit('message_pinned', d));
    socket.on('unpin_message',    (d: any) => io.emit('message_unpinned', d));
    socket.on('message_reaction', (d: any) => io.emit('message_reaction_updated', d));
    socket.on('message_edit',     (d: any) => io.emit('message_updated', d));
    socket.on('message_delete',   (d: any) => io.emit('message_deleted', d));
    socket.on('typing',           (d: any) => socket.to(`user_${d.to}`).emit('typing', { from: socket.userId }));
  });

  app.get('/api/admin/online-count', authenticate, requireAdmin, (_, res) => {
    res.json({ count: onlineUsers.size, userIds: [...onlineUsers.keys()] });
  });

  // ─── STATIC FILES ─────────────────────────────────────────────────────────
  const distPath = IS_DEV ? path.join(__dirname, '..', 'dist') : __dirname;
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ─── KEEP-ALIVE ───────────────────────────────────────────────────────────
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try { await fetch(`${SELF_URL}/api/health`); console.log('💓 Keep-alive OK'); }
    catch { console.warn('⚠️ Keep-alive échoué'); }
  }, 10 * 60 * 1000);

  // ─── DÉMARRAGE ────────────────────────────────────────────────────────────
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n════════════════════════════════════════');
    console.log(`✅  FreeBara Server v2 — port ${PORT}`);
    console.log(`🗄️   PostgreSQL | 🔐 JWT | 📧 Resend`);
    console.log(`🛡️   Modération auto | 💾 Backup/heure`);
    console.log(`✅  Validation | 📊 Dashboard admin`);
    console.log('════════════════════════════════════════\n');
  });

  process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM — fermeture propre...');
    await pool.end();
    process.exit(0);
  });
}

startServer().catch((e) => {
  console.error('❌ Erreur critique:', e);
  process.exit(1);
});