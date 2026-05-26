import { enqueueJob } from '../services/queue';

type RLEntry = { count: number; reset: number; blocked?: number };
const rlMap = new Map<string, RLEntry>();

export const rateLimit = (max: number, ms: number, blockMs = 0) =>
  (req: any, res: any, next: any) => {
    const key = `${req.ip ?? 'x'}:${req.path}`;
    const now = Date.now();
    let e = rlMap.get(key);
    if (e?.blocked && now < e.blocked) {
      res.setHeader('Retry-After', Math.ceil((e.blocked - now) / 1000));
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
    }
    if (!e || now > e.reset) { rlMap.set(key, { count: 1, reset: now + ms }); return next(); }
    e.count++;
    if (e.count > max) {
      if (blockMs) e.blocked = now + blockMs;
      res.setHeader('Retry-After', Math.ceil((e.reset - now) / 1000));
      enqueueJob('log', { level: 'WARN', action: 'rate_limit', ip: req.ip, details: req.path });
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un instant.' });
    }
    next();
  };

// Nettoyage toutes les 5 minutes
setInterval(() => {
  const n = Date.now();
  for (const [k, v] of rlMap)
    if (n > v.reset && (!v.blocked || n > v.blocked)) rlMap.delete(k);
}, 5 * 60000);