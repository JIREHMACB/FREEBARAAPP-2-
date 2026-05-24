// PrivacyPolicyModal.tsx
// Usage : importer et afficher après une connexion/inscription réussie
// si l'utilisateur n'a pas encore accepté la politique.
//
// Exemple d'intégration dans votre flux auth :
//
//   const { token, user } = await verifyOtp(...);
//   if (!user.privacyAccepted) {
//     setShowPrivacyModal(true);  // bloquer la navigation jusqu'à acceptation
//   } else {
//     navigate('/home');
//   }
//
// Props :
//   onAccept  — appelé après succès API, naviguez vers /home ici
//   onDecline — appelé si refus (déconnecte l'utilisateur)

import { useState, useRef, useEffect } from 'react';

const PRIVACY_VERSION = '1.0';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
  token: string;        // JWT pour l'appel API
  apiBase?: string;     // ex: '' (même domaine) ou 'https://api.freebara.com'
}

export default function PrivacyPolicyModal({
  onAccept,
  onDecline,
  token,
  apiBase = '',
}: Props) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  // Détecte quand l'utilisateur a lu jusqu'en bas
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
      if (atBottom) setHasScrolled(true);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const handleAccept = async () => {
    if (!checked) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/auth/accept-privacy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version: PRIVACY_VERSION }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      onAccept();
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>

        {/* ─── Header ─── */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoText}>FreeBara</span>
            <span style={styles.versionBadge}>v{PRIVACY_VERSION}</span>
          </div>
          <h1 style={styles.title}>Politique de confidentialité</h1>
          <p style={styles.subtitle}>
            Lisez attentivement avant de continuer. Votre acceptation est requise.
          </p>
        </div>

        {/* ─── Contenu scrollable ─── */}
        <div ref={contentRef} style={styles.content}>

          <Section title="1. Qui sommes-nous ?">
            FreeBara (JCE Connect) est une plateforme dédiée aux entrepreneurs et talents
            d'Afrique et de la diaspora. Nous collectons et traitons vos données personnelles
            dans le strict respect du Règlement Général sur la Protection des Données (RGPD)
            et des lois ivoiriennes applicables.
          </Section>

          <Section title="2. Données collectées">
            Nous collectons les informations suivantes :{'\n'}
            <BulletList items={[
              "Informations d'identité : nom, adresse email, pays, profession.",
              "Données de profil : photo, biographie, compétences, réseaux sociaux.",
              "Données d'utilisation : publications, messages, connexions, activité.",
              "Données techniques : adresse IP, type d'appareil, logs de connexion.",
              "Données financières (si applicable) : transactions internes à la plateforme.",
            ]} />
          </Section>

          <Section title="3. Finalités du traitement">
            Vos données sont utilisées pour :{'\n'}
            <BulletList items={[
              "Créer et gérer votre compte utilisateur.",
              "Vous permettre d'utiliser les fonctionnalités de la plateforme.",
              "Vous envoyer des codes de connexion OTP par email.",
              "Améliorer nos services et assurer la sécurité de la plateforme.",
              "Respecter nos obligations légales.",
            ]} />
          </Section>

          <Section title="4. Base légale">
            Le traitement de vos données repose sur :{'\n'}
            <BulletList items={[
              'Votre consentement explicite (acceptation de la présente politique).',
              "L'exécution du contrat liant FreeBara à ses utilisateurs.",
              "Nos intérêts légitimes (sécurité, prévention de la fraude).",
            ]} />
          </Section>

          <Section title="5. Conservation des données">
            Vos données sont conservées tant que votre compte est actif. En cas de suppression
            de compte, vos données personnelles sont effacées dans un délai de 30 jours,
            sauf obligation légale de conservation.
          </Section>

          <Section title="6. Partage des données">
            Nous ne vendons jamais vos données. Elles peuvent être partagées avec :{'\n'}
            <BulletList items={[
              "Nos prestataires techniques (hébergement Render, emails Resend, images Cloudinary) — uniquement dans le cadre de la fourniture du service.",
              "Les autorités compétentes si la loi l'exige.",
            ]} />
          </Section>

          <Section title="7. Vos droits">
            Conformément au RGPD, vous disposez des droits suivants :{'\n'}
            <BulletList items={[
              "Droit d'accès à vos données.",
              "Droit de rectification.",
              "Droit à l'effacement (suppression de compte disponible dans les paramètres).",
              "Droit à la portabilité.",
              "Droit d'opposition au traitement.",
            ]} />
            Pour exercer ces droits, contactez-nous à : <strong>privacy@freebara.com</strong>
          </Section>

          <Section title="8. Cookies et traçage">
            FreeBara utilise des jetons JWT stockés localement pour maintenir votre session.
            Aucun cookie publicitaire tiers n'est utilisé.
          </Section>

          <Section title="9. Sécurité">
            Vos données sont protégées par des mesures techniques appropriées : connexions
            chiffrées HTTPS, codes OTP à usage unique, journalisation des accès.
          </Section>

          <Section title="10. Modifications">
            Cette politique peut être mise à jour. En cas de modification substantielle,
            vous serez notifié et invité à accepter la nouvelle version.
          </Section>

          <Section title="11. Contact">
            FreeBara — JCE Connect{'\n'}
            Email : <strong>privacy@freebara.com</strong>{'\n'}
            Site : <strong>www.freebara.com</strong>
          </Section>

          <div style={styles.endMarker}>— Fin de la politique de confidentialité —</div>
        </div>

        {/* ─── Indicateur de scroll ─── */}
        {!hasScrolled && (
          <div style={styles.scrollHint}>
            ↓ Faites défiler pour lire la politique complète
          </div>
        )}

        {/* ─── Footer ─── */}
        <div style={styles.footer}>
          {error && <p style={styles.error}>{error}</p>}

          <label style={{
            ...styles.checkboxRow,
            opacity: hasScrolled ? 1 : 0.4,
            pointerEvents: hasScrolled ? 'auto' : 'none',
          }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              disabled={!hasScrolled}
              style={styles.checkbox}
            />
            <span style={styles.checkboxLabel}>
              J'ai lu et j'accepte la politique de confidentialité de FreeBara (v{PRIVACY_VERSION})
            </span>
          </label>

          <div style={styles.buttonRow}>
            <button onClick={onDecline} style={styles.btnDecline} disabled={loading}>
              Refuser et quitter
            </button>
            <button
              onClick={handleAccept}
              disabled={!checked || loading}
              style={{
                ...styles.btnAccept,
                opacity: checked && !loading ? 1 : 0.5,
                cursor: checked && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'Enregistrement…' : 'Accepter et continuer →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionBody}>{children}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={styles.list}>
      {items.map((item, i) => (
        <li key={i} style={styles.listItem}>• {item}</li>
      ))}
    </ul>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
  },
  modal: {
    background: '#ffffff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  },
  header: {
    padding: '28px 28px 20px',
    borderBottom: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#155be3',
    letterSpacing: '-0.3px',
  },
  versionBadge: {
    fontSize: '11px',
    background: '#eef3ff',
    color: '#155be3',
    padding: '2px 8px',
    borderRadius: '99px',
    fontWeight: 600,
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 28px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 6px',
  },
  sectionBody: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  list: {
    margin: '8px 0 0',
    padding: 0,
    listStyle: 'none',
  },
  listItem: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.7,
    paddingLeft: '4px',
  },
  endMarker: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#cbd5e1',
    padding: '16px 0 4px',
  },
  scrollHint: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
    padding: '8px',
    background: '#f8fafc',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0,
  },
  footer: {
    padding: '20px 28px',
    borderTop: '1px solid #f0f0f0',
    flexShrink: 0,
    background: '#fafafa',
  },
  error: {
    fontSize: '13px',
    color: '#dc2626',
    margin: '0 0 12px',
    padding: '8px 12px',
    background: '#fef2f2',
    borderRadius: '8px',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '16px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    marginTop: '2px',
    flexShrink: 0,
    accentColor: '#155be3',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '13px',
    color: '#334155',
    lineHeight: 1.5,
    userSelect: 'none',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  btnDecline: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: 'transparent',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  btnAccept: {
    padding: '10px 22px',
    borderRadius: '8px',
    border: 'none',
    background: '#155be3',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
};
