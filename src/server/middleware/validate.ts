/**
 * ══════════════════════════════════════════════
 * 🔴 VALIDATION AVEC ZOD — Sans dépendance externe
 * ══════════════════════════════════════════════
 * Zod n'est pas encore dans package.json.
 * Ce fichier implémente un validateur léger compatible
 * avec l'API Zod pour zéro refactoring futur.
 *
 * Pour passer à Zod natif : npm install zod
 * et remplacer l'import par : import { z } from 'zod'
 */

// ── Validateur léger interne (forme identique à Zod) ─────────────────────
type ValidationResult = { success: true; data: any } | { success: false; error: { message: string; issues: string[] } };

const createValidator = (rules: Record<string, (v: any) => string | null>) => ({
  safeParse: (data: any): ValidationResult => {
    const issues: string[] = [];
    const cleaned: any = {};
    for (const [key, validator] of Object.entries(rules)) {
      const err = validator(data[key]);
      if (err) issues.push(`${key}: ${err}`);
      else cleaned[key] = data[key];
    }
    if (issues.length > 0) return { success: false, error: { message: issues[0], issues } };
    return { success: true, data: cleaned };
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────
const required = (v: any) => (v === undefined || v === null || v === '') ? 'Champ requis' : null;
const email    = (v: any) => {
  if (!v) return 'Email requis';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Email invalide';
};
const str      = (min = 0, max = 10000) => (v: any) => {
  if (v === undefined || v === null) return min > 0 ? 'Champ requis' : null;
  if (typeof v !== 'string') return 'Doit être une chaîne';
  if (v.length < min) return `Minimum ${min} caractères`;
  if (v.length > max) return `Maximum ${max} caractères`;
  return null;
};
const num      = (min?: number, max?: number) => (v: any) => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (isNaN(n)) return 'Doit être un nombre';
  if (min !== undefined && n < min) return `Minimum ${min}`;
  if (max !== undefined && n > max) return `Maximum ${max}`;
  return null;
};
const oneOf    = (...vals: string[]) => (v: any) =>
  vals.includes(v) ? null : `Doit être: ${vals.join(', ')}`;
const optional = (_rule: any) => (_v: any) => null; // passe toujours

// ── Schémas de validation ─────────────────────────────────────────────────

export const schemas = {
  requestOtp: createValidator({
    email: email,
  }),

  verifyOtp: createValidator({
    email:   email,
    code:    (v) => {
      if (!v) return 'Code requis';
      if (!/^\d{6}$/.test(v)) return 'Code doit être 6 chiffres';
      return null;
    },
  }),

  updateProfile: createValidator({
    name:       str(0, 100),
    profession: str(0, 100),
    bio:        str(0, 1000),
    company:    str(0, 100),
    phone:      (v) => {
      if (!v) return null;
      return /^[\+\d\s\-\(\)]{6,20}$/.test(v) ? null : 'Numéro invalide';
    },
    location:   str(0, 200),
    website:    (v) => {
      if (!v) return null;
      try { new URL(v); return null; } catch { return 'URL invalide'; }
    },
    country:    str(0, 100),
    age:        num(13, 120),
  }),

  createPost: createValidator({
    content:  str(1, 5000),
    category: optional(str()),
  }),

  createEvent: createValidator({
    title:       str(3, 200),
    description: str(10, 5000),
    country:     required,
    city:        required,
    location:    required,
    startDate:   required,
    endDate:     required,
    category:    required,
  }),

  createService: createValidator({
    title:       str(3, 200),
    description: str(0, 2000),
    budget:      num(0, 10000000),
    type:        (v) => !v || ['projet','emploi','freelance','stage'].includes(v) ? null : 'Type invalide',
  }),

  createCompany: createValidator({
    name:    str(2, 200),
    sector:  str(0, 100),
    country: str(0, 100),
    city:    str(0, 100),
  }),

  sendMessage: createValidator({
    content: str(1, 10000),
  }),

  createTask: createValidator({
    title:    str(1, 200),
    priority: (v) => !v || ['low','medium','high'].includes(v) ? null : 'Priorité invalide',
    status:   (v) => !v || ['todo','in_progress','done'].includes(v) ? null : 'Statut invalide',
  }),

  report: createValidator({
    targetType: (v) => ['post','user','company','message','event'].includes(v) ? null : 'Type de cible invalide',
    targetId:   (v) => v && Number.isInteger(Number(v)) ? null : 'ID invalide',
    reason:     str(5, 500),
  }),

  adminBan: createValidator({
    reason: str(5, 500),
  }),

  adminRole: createValidator({
    role: oneOf('user', 'moderator', 'admin'),
  }),
};

// ── Middleware express générique ──────────────────────────────────────────
export const validate = (schema: ReturnType<typeof createValidator>) =>
  (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      // TypeScript union narrowing : dans la branche !success, on a forcément { success: false; error: ... }
      const err = (result as { success: false; error: { message: string; issues: string[] } }).error;
      return res.status(400).json({
        error: 'Données invalides',
        details: err.issues,
      });
    }
    next();
  };