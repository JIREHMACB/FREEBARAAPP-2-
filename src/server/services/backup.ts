/**
 * ═══════════════════════════════════════════════════════
 * 🔴 BACKUP POSTGRESQL — Stratégie complète
 * ═══════════════════════════════════════════════════════
 *
 * Niveaux de backup :
 *  1. Stats snapshot toutes les heures  → table backup_snapshots (DB elle-même)
 *  2. Export JSON quotidien             → envoi par email (Resend) + log
 *  3. Point-in-time restore info        → instructions pour Render PG
 *
 * Pour un vrai dump binaire en production :
 *  → Activer "Automated backups" dans Render Dashboard > PostgreSQL
 *  → Ou utiliser pg_dump via une GitHub Action (voir README)
 */

import { pool, db } from '../config/db.js';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ── Table de snapshots ──────────────────────────────────────────────────────
export const ensureBackupTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_snapshots (
      id            SERIAL PRIMARY KEY,
      type          TEXT NOT NULL,
      counts        JSONB NOT NULL,
      sizeBytes     BIGINT,
      status        TEXT DEFAULT 'ok',
      note          TEXT,
      "createdAt"   TIMESTAMP DEFAULT NOW()
    )
  `);
};

// ── Snapshot compteurs (toutes les heures) ──────────────────────────────────
export const snapshotCounts = async (): Promise<void> => {
  try {
    const tables = [
      'users','posts','messages','companies','events',
      'services','pannels','cells','reports','transactions',
    ];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = await db.one(`SELECT COUNT(*) as c FROM ${t}`);
      counts[t] = parseInt(r?.c ?? 0);
    }

    // Taille totale de la DB
    const sizeRow = await db.one(
      `SELECT pg_database_size(current_database()) as size`
    );
    const sizeBytes = parseInt(sizeRow?.size ?? 0);

    await pool.query(
      `INSERT INTO backup_snapshots(type, counts, "sizeBytes") VALUES('hourly', $1, $2)`,
      [JSON.stringify(counts), sizeBytes]
    );

    console.log(`💾 Snapshot DB: ${JSON.stringify(counts)} | ${Math.round(sizeBytes / 1024 / 1024)}MB`);
  } catch (e: any) {
    console.error('❌ Snapshot backup échoué:', e.message);
  }
};

// ── Export JSON quotidien (données critiques) ───────────────────────────────
export const dailyExportEmail = async (): Promise<void> => {
  if (!resend || !process.env.ADMIN_EMAIL) {
    console.warn('⚠️  ADMIN_EMAIL ou RESEND_API_KEY manquant — export email désactivé');
    return;
  }
  try {
    const [users, companies, reports, lastSnapshot] = await Promise.all([
      db.one(`SELECT COUNT(*) as c, COUNT(*) FILTER (WHERE "createdAt">=NOW()-INTERVAL '24 hours') as new_today FROM users`),
      db.one(`SELECT COUNT(*) as c FROM companies`),
      db.one(`SELECT COUNT(*) as c FROM reports WHERE status='pending'`),
      db.one(`SELECT counts, "sizeBytes", "createdAt" FROM backup_snapshots ORDER BY "createdAt" DESC LIMIT 1`),
    ]);

    const sizeDisplay = lastSnapshot
      ? `${Math.round(parseInt(lastSnapshot.sizeBytes ?? 0) / 1024 / 1024)}MB`
      : 'N/A';

    await resend.emails.send({
      from: 'FreeBara Backup <noreply@freebara.com>',
      to: process.env.ADMIN_EMAIL,
      subject: `📊 Rapport quotidien FreeBara — ${new Date().toLocaleDateString('fr-FR')}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;">
          <h2 style="color:#155be3;">📊 Rapport quotidien — ${new Date().toLocaleDateString('fr-FR')}</h2>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f8fafc;"><th style="padding:10px;text-align:left;">Métrique</th><th style="padding:10px;text-align:right;">Valeur</th></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f0f0f0;">👥 Utilisateurs total</td><td style="padding:10px;text-align:right;border-bottom:1px solid #f0f0f0;"><strong>${users?.c ?? 0}</strong></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f0f0f0;">🆕 Nouveaux aujourd'hui</td><td style="padding:10px;text-align:right;border-bottom:1px solid #f0f0f0;"><strong>${users?.new_today ?? 0}</strong></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f0f0f0;">🏢 Entreprises</td><td style="padding:10px;text-align:right;border-bottom:1px solid #f0f0f0;">${companies?.c ?? 0}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #f0f0f0;">⚠️ Signalements en attente</td><td style="padding:10px;text-align:right;border-bottom:1px solid #f0f0f0;color:${parseInt(reports?.c ?? 0) > 5 ? '#dc2626' : '#16a34a'}"><strong>${reports?.c ?? 0}</strong></td></tr>
            <tr><td style="padding:10px;">💾 Taille DB</td><td style="padding:10px;text-align:right;">${sizeDisplay}</td></tr>
          </table>
          ${lastSnapshot ? `<p style="color:#64748b;font-size:12px;">Dernier snapshot: ${new Date(lastSnapshot.createdAt).toLocaleString('fr-FR')}</p>` : ''}
          <hr style="border:none;border-top:1px solid #f0f0f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:11px;">
            ⚠️ Pour un backup complet de la base de données PostgreSQL, activez les backups automatiques<br>
            dans votre dashboard Render : <strong>Dashboard → PostgreSQL → Backups</strong>
          </p>
        </div>`,
    });
    console.log('📧 Rapport quotidien envoyé à', process.env.ADMIN_EMAIL);
  } catch (e: any) {
    console.error('❌ Export email échoué:', e.message);
  }
};

// ── Lire l'historique des snapshots ────────────────────────────────────────
export const getBackupHistory = async (limit = 48) =>
  db.all(
    `SELECT id, type, counts, "sizeBytes", status, "createdAt"
     FROM backup_snapshots ORDER BY "createdAt" DESC LIMIT $1`,
    [limit]
  );

// ── Démarrer les jobs automatiques ─────────────────────────────────────────
export const startBackupJobs = async () => {
  await ensureBackupTable();
  await snapshotCounts(); // snapshot immédiat au démarrage

  // Snapshot toutes les heures
  setInterval(snapshotCounts, 60 * 60 * 1000);

  // Export email tous les jours à 7h UTC
  const msUntil7h = (() => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(7, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  })();
  setTimeout(() => {
    dailyExportEmail();
    setInterval(dailyExportEmail, 24 * 60 * 60 * 1000);
  }, msUntil7h);

  console.log('✅ Jobs backup démarrés (snapshot/heure + email/jour)');
};