import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, ArrowRight, Globe } from 'lucide-react';
import { toast } from 'react-hot-toast';


export default function Login() {
  const navigate = useNavigate();
 const otpStore: Record<string, string> = {};
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');
const API_URL = "https://freebaraapp-2.onrender.com";

// ✅ REQUEST OTP
const handleRequestOtp = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!email) {
    setError('Email requis');
    return;
  }

  setLoading(true);
  setError('');
  console.log('AVANT FETCH');

  try {
    const res = await fetch(`${API_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.trim(),
        isRegister: mode === 'register'
      })
    });

    console.log('APRES FETCH');

    const data = await res.json();

    // ✅ CORRECTION ICI
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Erreur serveur');
    }

    // ✅ Code dev (si pas SMTP)
    if (data.devCode) {
      console.log("CODE OTP DEV =", data.devCode);
      setDevCode(data.devCode);
    }

    setStep('code');

  } catch (err: any) {
    console.error("REQUEST OTP ERROR:", err);
    setError(err.message || 'Erreur serveur');
  } finally {
    setLoading(false);
  }
};


// ✅ VERIFY OTP
const handleVerifyOtp = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!code || code.trim().length !== 6) {
    setError('Code invalide');
    return;
  }

  setLoading(true);
  setError('');

  try {
    console.log("EMAIL:", email);
    console.log("CODE:", code);

    const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        email: email.trim(), 
        code: code.trim() 
      })
    });

    let data;

    // ✅ gestion safe JSON
    try {
      data = await res.json();
    } catch {
      throw new Error('Réponse invalide du serveur');
    }

    // ✅ CORRECTION ICI AUSSI
    if (!res.ok) {
      throw new Error(data.error || data.message || 'Erreur serveur');
    }

    if (!data.token) {
      throw new Error('Token manquant');
    }

    localStorage.setItem('token', data.token);

    navigate('/profile');

  } catch (err: any) {
    console.error("VERIFY ERROR:", err);
    setError(err.message || 'Erreur serveur');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">FreeBara</h1>
          <p className="text-slate-500">Une suite d'outils complète conçue pour la réussite des entrepreneurs et talents</p>
        </div>

        {step === 'email' && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Se connecter
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              S'inscrire
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Adresse Email</label>
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

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pays de résidence</label>
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
                    {["France", "Côte d'Ivoire", "Canada", "Sénégal", "Cameroun", "Belgique", "Suisse", "Togo", "Bénin", "Gabon"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {loading ? 'Envoi en cours...' : 'Recevoir mon code'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        ) : (
         <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Code de vérification</label>
              <p className="text-xs text-slate-500 mb-4">Un code a été envoyé à {email}.</p>
              
              {devCode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <span className="text-sm text-blue-800">Code de test : <strong className="text-lg tracking-widest">{devCode}</strong></span>
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
              {loading ? 'Vérification...' : (mode === 'register' ? 'Créer mon compte' : 'Se connecter')}
            </button>
            <button
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-sm text-slate-500 hover:text-slate-700 text-center"
            >
              Modifier l'adresse email
            </button>
          </form>
        )}
      </div>
    </div>
  );
} 