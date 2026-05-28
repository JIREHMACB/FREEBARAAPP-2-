import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, ArrowRight, Globe, X, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ── Politique de confidentialité FreeBara ─────────────────────────────────────
const PRIVACY_SECTIONS = [
  {
    title: '1. Données collectées',
    content: `FreeBara collecte les données suivantes lors de votre inscription et utilisation de la plateforme :
• Adresse email (identifiant unique)
• Pays de résidence
• Informations de profil : nom, profession, photo, biographie, compétences
• Contenus publiés : posts, commentaires, messages
• Données d'usage : dernière connexion, nombre de connexions

Ces données sont nécessaires au fonctionnement du service et à la personnalisation de votre expérience.`,
  },
  {
    title: '2. Utilisation des données',
    content: `Vos données sont utilisées exclusivement pour :
• Créer et gérer votre compte FreeBara
• Vous permettre d'interagir avec la communauté
• Vous envoyer des codes de vérification OTP par email
• Améliorer la sécurité et prévenir les abus
• Vous envoyer des notifications liées à votre activité (désactivables dans les paramètres)

FreeBara ne vend jamais vos données personnelles à des tiers.`,
  },
  {
    title: '3. Partage des données',
    content: `Vos données peuvent être partagées avec :
• Les autres utilisateurs FreeBara, selon vos paramètres de visibilité (public / privé)
• Nos prestataires techniques : hébergement (Render.com), emails (Resend), stockage d'images (Cloudinary)

Ces prestataires agissent uniquement sur instruction de FreeBara et ne peuvent pas utiliser vos données à leurs propres fins.`,
  },
  {
    title: '4. Conservation des données',
    content: `Vos données sont conservées aussi longtemps que votre compte est actif.

En cas de suppression de votre compte :
• Vos données personnelles sont supprimées dans un délai de 30 jours
• Certains contenus publiés peuvent être conservés sous forme anonymisée

Vous pouvez demander la suppression de votre compte à tout moment depuis Profil → Paramètres → Supprimer mon compte.`,
  },
  {
    title: '5. Vos droits (RGPD)',
    content: `Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
• Droit d'accès : consulter toutes vos données personnelles
• Droit de rectification : corriger vos informations
• Droit à l'effacement : supprimer votre compte et vos données
• Droit à la portabilité : exporter vos données
• Droit d'opposition : refuser certains traitements

Pour exercer ces droits, contactez-nous à : privacy@freebara.com`,
  },
  {
    title: '6. Sécurité',
    content: `FreeBara met en œuvre des mesures techniques pour protéger vos données :
• Connexion sécurisée HTTPS (TLS)
• Authentification par code OTP à usage unique (pas de mot de passe)
• Tokens JWT avec expiration automatique (30 jours)
• Hashage des codes OTP en base de données
• Détection automatique des comportements abusifs

Aucun système n'est infaillible. En cas de violation de données, vous serez notifié dans les 72 heures.`,
  },
  {
    title: '7. Cookies',
    content: `FreeBara n'utilise pas de cookies publicitaires ni de traceurs tiers.

Seul un token d'authentification est stocké localement (localStorage) sur votre appareil pour maintenir votre session. Ce stockage est strictement nécessaire au fonctionnement du service.`,
  },
  {
    title: '8. Contact',
    content: `Pour toute question relative à vos données personnelles :

Email : privacy@freebara.com
Site : www.freebara.com

Responsable du traitement : FreeBara
Dernière mise à jour : Janvier 2025
Version : 1.0`,
  },
];

// ── Modal Politique de confidentialité ────────────────────────────────────────
function PrivacyModal({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 40) {
      setScrolledToBottom(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Politique de confidentialité</h2>
              <p className="text-xs text-slate-400">FreeBara — Version 1.0 · Jan. 2025</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Navigation sections */}
        <div className="flex gap-2 px-6 py-3 overflow-x-auto flex-shrink-0 border-b border-slate-50">
          {PRIVACY_SECTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveSection(i);
                document.getElementById(`priv-section-${i}`)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0 ${
                activeSection === i
                  ? 'bg-amber-100 text-amber-800 font-medium'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {i + 1}. {s.title.split('. ')[1]}
            </button>
          ))}
        </div>

        {/* Content scrollable */}
        <div
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-6"
        >
          {PRIVACY_SECTIONS.map((section, i) => (
            <div key={i} id={`priv-section-${i}`}>
              <h3 className="text-sm font-bold text-slate-800 mb-2">{section.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}

          {/* Spacer to force scroll */}
          <div className="h-4" />
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white sm:rounded-b-3xl">
          {!scrolledToBottom && (
            <p className="text-xs text-slate-400 text-center mb-3">
              Faites défiler pour lire la politique complète avant d'accepter
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Refuser
            </button>
            <button
              onClick={onAccept}
              disabled={!scrolledToBottom}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                scrolledToBottom
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              J'accepte
              {scrolledToBottom && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Composant principal Login ─────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  // ── État politique de confidentialité ─────────────────────────────────────
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  // ── Request OTP ───────────────────────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) { setError('Email requis'); return; }

    // Bloquer l'inscription si politique non acceptée
    if (mode === 'register' && !privacyAccepted) {
      setError('Veuillez lire et accepter la politique de confidentialité pour continuer.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          country: mode === 'register' ? country : undefined,
          isRegister: mode === 'register',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Erreur serveur');

      if (data.devCode) {
        console.log('CODE OTP DEV =', data.devCode);
        setDevCode(data.devCode);
      }

      setStep('code');
    } catch (err: any) {
      console.error('REQUEST OTP ERROR:', err);
      setError(err.message || 'Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.trim().length !== 6) { setError('Code invalide'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          isRegister: mode === 'register',
          privacyAccepted: mode === 'register' ? true : undefined,
          privacyVersion: mode === 'register' ? '1.0' : undefined,
        }),
      });

      let data;
      try { data = await res.json(); } catch { throw new Error('Réponse invalide du serveur'); }

      if (!res.ok) throw new Error(data.error || data.message || 'Erreur serveur');
      if (!data.token) throw new Error('Token manquant');

      localStorage.setItem('token', data.token);
      navigate('/profile');
    } catch (err: any) {
      console.error('VERIFY ERROR:', err);
      setError(err.message || 'Erreur serveur');
    } finally {
      setLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modal politique */}
      {showPrivacyModal && (
        <PrivacyModal
          onClose={() => setShowPrivacyModal(false)}
          onAccept={() => {
            setPrivacyAccepted(true);
            setShowPrivacyModal(false);
            setError('');
            toast.success('Politique acceptée ✓', {
              style: { borderRadius: '12px', background: '#1e293b', color: '#fff' },
            });
          }}
        />
      )}

      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">

          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">FreeBara</h1>
            <p className="text-slate-500">
              Une suite d'outils complète conçue pour la réussite des entrepreneurs et talents
            </p>
          </div>

          {/* Tabs login / register */}
          {step === 'email' && (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                onClick={() => { setMode('login'); setError(''); setCode(''); setPrivacyAccepted(false); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Se connecter
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); setCode(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                S'inscrire
              </button>
            </div>
          )}

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* ── STEP EMAIL ─────────────────────────────────────────────────── */}
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Adresse Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="vous@exemple.com"
                  />
                </div>
              </div>

              {/* Pays — inscription seulement */}
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Pays de résidence
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-slate-400" />
                    </div>
                    <select
                      required
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white appearance-none"
                    >
                      <option value="">Sélectionnez un pays</option>
                      {[
                        "France", "Côte d'Ivoire", "Canada", "Sénégal", "Cameroun",
                        "Belgique", "Suisse", "Togo", "Bénin", "Gabon",
                      ].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ── Bloc politique — inscription seulement ─────────────────── */}
              {mode === 'register' && (
                <div
                  className={`rounded-2xl border-2 p-4 transition-all ${
                    privacyAccepted
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox custom */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!privacyAccepted) {
                          setShowPrivacyModal(true);
                        } else {
                          setPrivacyAccepted(false);
                        }
                      }}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        privacyAccepted
                          ? 'bg-amber-500 border-amber-500'
                          : 'bg-white border-slate-300 hover:border-amber-400'
                      }`}
                    >
                      {privacyAccepted && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        J'ai lu et j'accepte la{' '}
                        <button
                          type="button"
                          onClick={() => setShowPrivacyModal(true)}
                          className="text-amber-600 font-semibold underline underline-offset-2 hover:text-amber-700 transition-colors"
                        >
                          Politique de confidentialité
                        </button>{' '}
                        de FreeBara
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Obligatoire pour créer un compte
                      </p>
                    </div>

                    {/* Badge statut */}
                    {privacyAccepted ? (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium flex-shrink-0">
                        Acceptée ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full font-medium hover:bg-amber-100 hover:text-amber-700 transition-colors flex-shrink-0"
                      >
                        Lire →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bouton submit */}
              <button
                type="submit"
                disabled={loading || (mode === 'register' && !privacyAccepted)}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Envoi en cours...' : 'Recevoir mon code'}
                {!loading && <ArrowRight size={18} />}
              </button>

              {mode === 'register' && !privacyAccepted && (
                <p className="text-xs text-center text-slate-400">
                  Acceptez la politique de confidentialité pour continuer
                </p>
              )}
            </form>

          ) : (
            /* ── STEP CODE ──────────────────────────────────────────────────── */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Code de vérification
                </label>
                <p className="text-xs text-slate-500 mb-4">
                  Un code a été envoyé à {email}.
                </p>

                {devCode && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-blue-800">
                      Code de test : <strong className="text-lg tracking-widest">{devCode}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCode(devCode)}
                      className="text-xs bg-blue-200 text-blue-800 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-300 transition-colors"
                    >
                      Utiliser
                    </button>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-center tracking-widest text-lg font-semibold"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 gradient-bg hover:opacity-90 text-white py-3 px-4 rounded-xl font-medium transition-opacity disabled:opacity-70"
              >
                {loading
                  ? 'Vérification...'
                  : mode === 'register'
                  ? 'Créer mon compte'
                  : 'Se connecter'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); setDevCode(''); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
              >
                Modifier l'adresse email
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}