import React, { useState, useEffect } from 'react';
import { getAI, safeGenerateContent, Type } from '../lib/gemini';
import { Sparkles, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface BusinessSuggestionsProps {
  currentUser: any;
  companies: any[];
  onSelectCompany: (id: number) => void;
}

export default function BusinessSuggestions({ currentUser, companies, onSelectCompany }: BusinessSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getSuggestions = async () => {
    if (!currentUser || companies.length === 0 || loading) return;
    
    setLoading(true);
    try {
      const userProfile = {
        profession: currentUser.profession || 'Non spécifié',
        skills: currentUser.skills || 'Non spécifié',
        interests: currentUser.interests || 'Non spécifié',
      };

      const companiesData = (companies || []).map(c => ({
        id: c.id,
        name: c.name,
        sector: c.sector,
        description: c.description
      }));

      const prompt = `En tant qu'assistant intelligent pour une plateforme business, suggère les 3 entreprises les plus pertinentes pour cet utilisateur parmi la liste fournie.
      
      Profil Utilisateur:
      - Profession: ${userProfile.profession}
      - Compétences: ${userProfile.skills}
      - Centres d'intérêt: ${userProfile.interests}
      
      Liste des entreprises:
      ${JSON.stringify(companiesData)}
      
      Retourne uniquement un tableau JSON d'IDs d'entreprises, classés par pertinence.`;

      const response = await safeGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER }
          }
        }
      });

      const suggestedIds = JSON.parse(response?.text || '[]');
      const suggestedCompanies = suggestedIds
        .map((id: number) => companies.find(c => c.id === id))
        .filter(Boolean)
        .slice(0, 3);

      setSuggestions(suggestedCompanies);
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && companies.length > 0 && suggestions.length === 0 && !loading) {
      getSuggestions();
    }
  }, [currentUser, companies]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-[32px] p-8 border border-primary/10 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="text-primary animate-spin" size={32} />
        <p className="text-primary font-bold animate-pulse">Analyse de votre profil par l'IA...</p>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pour vous</h2>
          <p className="text-slate-500 text-sm font-medium">Suggestions personnalisées par IA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {suggestions.map((company, idx) => (
          <motion.div
            key={company.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -5 }}
            onClick={() => onSelectCompany(company.id)}
            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:scale-150 transition-transform duration-700" />
            
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary overflow-hidden">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={24} />
                )}
              </div>
              <div className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                Match IA
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="font-black text-slate-900 text-lg leading-tight group-hover:text-primary transition-colors">{company.name}</h3>
              <p className="text-xs font-bold text-primary uppercase tracking-widest">{company.sector}</p>
              <p className="text-sm text-slate-500 line-clamp-2 font-medium leading-relaxed">
                {company.description}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-400">Voir le profil</span>
              <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                <ChevronRight size={16} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
