import { pool } from '../config/db.js';
import { sendOTPEmail } from './email.js';

type Job = { type: string; payload: any; retries: number };
export const jobQueue: Job[] = [];
let jobRunning = false;

export const enqueueJob = (type: string, payload: any) =>
  jobQueue.push({ type, payload, retries: 0 });

const logAction = async (level: string, action: string, userId?: number, ip?: string, details?: string) => {
  try {
    await pool.query(
      `INSERT INTO db_logs(level, action, "userId", ip, details) VALUES($1,$2,$3,$4,$5)`,
      [level, action, userId ?? null, ip ?? null, details ?? null]
    );
  } catch {}
};

const processJobs = async () => {
  if (jobRunning || jobQueue.length === 0) return;
  jobRunning = true;
  const job = jobQueue.shift()!;
  try {
    if (job.type === 'send_email')
      await sendOTPEmail(job.payload.email, job.payload.code);
    else if (job.type === 'log')
      await logAction(job.payload.level, job.payload.action, job.payload.userId, job.payload.ip, job.payload.details);
    else if (job.type === 'notif')
      await pool.query(
        `INSERT INTO notifications("userId",type,content,"relatedId") VALUES($1,$2,$3,$4)`,
        [job.payload.userId, job.payload.type, job.payload.content, job.payload.relatedId]
      );
  } catch (e: any) {
    if (job.retries < 3) { job.retries++; jobQueue.unshift(job); }
    else console.error(`[QUEUE] Job ${job.type} échoué: ${e.message}`);
  } finally {
    jobRunning = false;
  }
};

setInterval(processJobs, 300);