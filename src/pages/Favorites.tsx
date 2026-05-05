import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Building2, Heart, ChevronLeft, ExternalLink, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function Favorites() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const data = await api.users.getFavoriteCompanies();
      setFavorites(data);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des favoris');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (companyId: number) => {
    try {
      await api.companies.unfavorite(companyId);
      setFavorites(prev => prev.filter(c => c.id !== companyId));
      toast.success('Retiré des favoris');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredFavorites = favorites.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Chargement de vos favoris...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mes Favoris</h1>
            <p className="text-slate-500 font-medium">Retrouvez vos entreprises préférées</p>
          </div>
        </div>
        <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center shadow-sm">
          <Heart size={24} fill="currentColor" />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Rechercher dans vos favoris..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[24px] focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredFavorites.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200"
            >
              <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium">Aucune entreprise favorite trouvée</p>
              <button 
                onClick={() => navigate('/business')}
                className="mt-4 text-primary font-bold hover:underline"
              >
                Découvrir des entreprises
              </button>
            </motion.div>
          ) : (
            filteredFavorites.map((company) => (
              <motion.div
                key={company.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary overflow-hidden shrink-0 border border-primary/10">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={28} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{company.name}</h3>
                    <p className="text-sm text-primary font-bold">{company.sector}</p>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">{company.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleFavorite(company.id)}
                    className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all shadow-sm"
                    title="Retirer des favoris"
                  >
                    <Heart size={20} fill="currentColor" />
                  </button>
                  <button 
                    onClick={() => navigate('/business', { state: { selectedCompanyId: company.id } })}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
                  >
                    Voir <ExternalLink size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
