import jwt from 'jsonwebtoken';
import { db, pool } from '../config/db.js';
import { cacheGet, cacheSet } from '../services/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

export const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const cacheKey = `auth:${decoded.userId}`;
    let user = cacheGet(cacheKey);
    if (!user) {
      user = await db.one(`SELECT id, status, role FROM users WHERE id=$1`, [decoded.userId]);
      if (user) cacheSet(cacheKey, user, 30000);
    }
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (user.status === 'banned')
      return res.status(403).json({ error: 'Compte suspendu. Contactez le support FreeBara.' });
    req.userId   = decoded.userId;
    req.userRole = user.role;
    const lsKey = `lastseen:${decoded.userId}`;
    if (!cacheGet(lsKey)) {
      pool.query(`UPDATE users SET "lastSeen"=NOW() WHERE id=$1`, [decoded.userId]).catch(() => {});
      cacheSet(lsKey, true, 5 * 60000);
    }
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
};

export const requireAdmin = (req: any, res: any, next: any) => {
  if (req.userRole !== 'admin' && req.userRole !== 'moderator')
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  next();
};

export const requireSuperAdmin = (req: any, res: any, next: any) => {
  if (req.userRole !== 'admin')
    return res.status(403).json({ error: 'Accès super-admin requis' });
  next();
};