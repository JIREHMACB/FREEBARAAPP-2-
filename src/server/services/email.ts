import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) console.warn('⚠️  RESEND_API_KEY manquant - emails désactivés');
const resend = apiKey ? new Resend(apiKey) : null;

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const sendOTPEmail = async (email: string, code: string) => {
  if (!isValidEmail(email)) { console.error('❌ Email invalide:', email); return; }
  if (!resend) { console.log(`\n📧 [DEV MODE] OTP pour ${email} : ${code}\n`); return; }
  try {
    await resend.emails.send({
      from: 'FreeBara <noreply@freebara.com>',
      to: email,
      subject: 'Votre code de connexion FreeBara',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:16px;">
          <img src="https://www.freebara.com/logo__2_.png" alt="FreeBara" style="height:40px;margin-bottom:24px;" />
          <h2 style="color:#155be3;margin:0 0 8px;">Code de vérification</h2>
          <p style="color:#64748b;margin:0 0 24px;">Utilisez ce code pour accéder à FreeBara :</p>
          <div style="background:#fff;border:2px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;font-size:36px;font-weight:900;letter-spacing:10px;color:#0f172a;">
            ${code}
          </div>
          <p style="color:#94a3b8;font-size:12px;margin-top:20px;">⏱ Expire dans 10 minutes. Ne partagez jamais ce code.</p>
        </div>`,
    });
    console.log('📧 OTP envoyé à', email);
  } catch (error) {
    console.error('❌ Erreur Resend:', error);
  }
};