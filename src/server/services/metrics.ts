import { pool } from '../config/db.js';

export const metrics = {
  requests: 0,
  errors: 0,
  dbQueries: 0,
  responseTimesMs: [] as number[],
  recordResponseTime(ms: number) {
    this.responseTimesMs.push(ms);
    if (this.responseTimesMs.length > 1000) this.responseTimesMs.shift();
  },
  avgResponseTime() {
    if (!this.responseTimesMs.length) return 0;
    return Math.round(this.responseTimesMs.reduce((a, b) => a + b, 0) / this.responseTimesMs.length);
  },
  p95ResponseTime() {
    if (!this.responseTimesMs.length) return 0;
    const sorted = [...this.responseTimesMs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  },
};

export const errorTracker = {
  errors: [] as { time: string; msg: string; context?: string }[],
  capture(err: any, context?: string) {
    const entry = { time: new Date().toISOString(), msg: String(err?.message ?? err), context };
    this.errors.unshift(entry);
    if (this.errors.length > 200) this.errors.pop();
    console.error(`[ERROR]${context ? ' ' + context : ''} ${entry.msg}`);
  },
};

process.on('uncaughtException',  (e) => errorTracker.capture(e, 'uncaughtException'));
process.on('unhandledRejection', (e) => errorTracker.capture(e, 'unhandledRejection'));

// Flush métriques toutes les 5 minutes
setInterval(async () => {
  try {
    await pool.query(
      `INSERT INTO metrics(name, value, tags) VALUES ($1,$2,$3),($4,$5,$6),($7,$8,$9),($10,$11,$12)`,
      [
        'requests_total', metrics.requests, JSON.stringify({ period: '5m' }),
        'errors_total',   metrics.errors,   JSON.stringify({ period: '5m' }),
        'avg_response_ms', metrics.avgResponseTime(), JSON.stringify({}),
        'p95_response_ms', metrics.p95ResponseTime(), JSON.stringify({}),
      ]
    );
    metrics.requests = 0;
    metrics.errors   = 0;
  } catch {}
}, 5 * 60000);