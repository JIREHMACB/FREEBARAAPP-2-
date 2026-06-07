import { pool, db } from '../config/db.js';
import { cacheGet, cacheSet } from '../services/cache.js';

export const moderationCache = new Map<string, any>();

export const analyzeContent = async (text: string, userId: number) => {
  if (!text?.trim()) return { score: 0, reasons: [], action: 'allow' as const, severity: 'low' };

  const normalized = text.toLowerCase();
  const cacheKey   = `modcache:${Buffer.from(normalized.substring(0, 100)).toString('base64')}`;
  const cached     = cacheGet(cacheKey);
  if (cached) return cached;

  const reasons: string[] = [];
  let score = 0;
  let worstAction = 'allow';
  let worstSeverity = 'low';

  try {
    // 1. Règles base de données
    const rules = await db.all(`SELECT pattern, type, severity, action FROM moderation_rules WHERE "isActive"=TRUE`, []);
    for (const rule of rules) {
      if (normalized.includes(rule.pattern.toLowerCase())) {
        reasons.push(`${rule.type}: "${rule.pattern}"`);
        const s: Record<string, number> = { low: 0.2, medium: 0.4, high: 0.7, critical: 1.0 };
        score = Math.max(score, s[rule.severity] ?? 0.3);
        if (rule.action === 'block') worstAction = 'block';
        else if (rule.action === 'flag' && worstAction !== 'block') worstAction = 'flag';
        worstSeverity = rule.severity;
      }
    }

    // 2. Heuristiques locales
    const words  = normalized.split(/\s+/);
    const unique = new Set(words);
    if (words.length > 10 && unique.size / words.length < 0.3) {
      score = Math.max(score, 0.5); reasons.push('spam: répétition excessive');
      if (worstAction === 'allow') worstAction = 'flag';
    }
    const capsRatio = (text.match(/[A-Z]/g)?.length ?? 0) / Math.max(text.length, 1);
    if (text.length > 20 && capsRatio > 0.6) {
      score = Math.max(score, 0.3); reasons.push('comportement: majuscules excessives');
      if (worstAction === 'allow') worstAction = 'flag';
    }
    const linkCount = (text.match(/https?:\/\//g)?.length ?? 0);
    if (linkCount > 3) {
      score = Math.max(score, 0.5); reasons.push(`spam: ${linkCount} liens`);
      if (worstAction === 'allow') worstAction = 'flag';
    }
    const phones = text.match(/(\+?\d[\s\-.]?){8,13}/g);
    if (phones && phones.length > 2) {
      score = Math.max(score, 0.35); reasons.push('spam: multiples numéros');
      if (worstAction === 'allow') worstAction = 'flag';
    }

    // 3. Anti-spam comportemental
    const counter = await db.one(
      `SELECT "postCount","isMuted","mutedUntil" FROM spam_counters WHERE "userId"=$1`, [userId]
    );
    if (counter?.isMuted && counter.mutedUntil && new Date(counter.mutedUntil) > new Date())
      return { score: 1, reasons: ['utilisateur muté'], action: 'block' as const, severity: 'high' };
    if ((counter?.postCount ?? 0) > 20) {
      score = Math.max(score, 0.6); reasons.push('spam: volume >20/heure'); worstAction = 'block';
    }
  } catch {}

  const result = { score: Math.min(1, score), reasons, action: worstAction as any, severity: worstSeverity };
  cacheSet(cacheKey, result, 60000);
  return result;
};

export const incrementSpamCounter = async (userId: number, type: 'post' | 'message' | 'flag') => {
  const col = type === 'post' ? '"postCount"' : type === 'message' ? '"messageCount"' : '"flagCount"';
  await pool.query(
    `INSERT INTO spam_counters("userId",${col}) VALUES($1,1)
     ON CONFLICT("userId") DO UPDATE SET ${col}=spam_counters.${col}+1`,
    [userId]
  ).catch(() => {});
};

export const autoModerate = async (
  content: string, userId: number,
  targetType: string, targetId: number, ip: string
) => {
  const result = await analyzeContent(content, userId);
  if (result.action === 'allow') return result;

  await pool.query(
    `INSERT INTO reports("reporterId","targetType","targetId",reason,severity,"autoFlag","aiScore","aiReason",status)
     VALUES($1,$2,$3,$4,$5,TRUE,$6,$7,$8)`,
    [userId, targetType, targetId, `[AUTO] ${result.reasons.join(', ')}`,
     result.severity, result.score, result.reasons.join(' | '),
     result.action === 'block' ? 'action_taken' : 'pending']
  ).catch(() => {});

  await pool.query(
    `INSERT INTO moderation_actions("targetType","targetId",action,reason,"automated") VALUES($1,$2,$3,$4,TRUE)`,
    [targetType, targetId, result.action, result.reasons.join(', ')]
  ).catch(() => {});

  if (result.score >= 0.7) {
    await incrementSpamCounter(userId, 'flag');
    const counter = await db.one(`SELECT "flagCount" FROM spam_counters WHERE "userId"=$1`, [userId]);
    if ((counter?.flagCount ?? 0) >= 5) {
      await pool.query(
        `UPDATE spam_counters SET "isMuted"=TRUE,"mutedUntil"=NOW()+INTERVAL '24 hours' WHERE "userId"=$1`,
        [userId]
      ).catch(() => {});
    }
  }
  return result;
};

// Reset compteurs anti-spam toutes les heures
setInterval(async () => {
  await pool.query(
    `UPDATE spam_counters SET "postCount"=0,"messageCount"=0,"lastReset"=NOW()
     WHERE "lastReset" < NOW()-INTERVAL '1 hour'`
  ).catch(() => {});
}, 60 * 60 * 1000);