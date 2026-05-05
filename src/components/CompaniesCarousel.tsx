import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { Briefcase, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CompaniesCarousel() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNewCompanies();
  }, []);

  const fetchNewCompanies = async () => {
    try {
      const data = await api.companies.getNew();
      setCompanies(data);
    } catch (err: any) {
      // Error is already handled by api.request and toast
      console.error('Error fetching new companies:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-8 px-4 md:px-0">
        <div className="h-6 w-48 bg-slate-200 animate-pulse rounded mb-4" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-64 h-32 bg-slate-200 animate-pulse rounded-2xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (companies.length === 0) return null;

  return (
    <div className="mb-8 overflow-hidden">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Briefcase className="text-primary" size={20} />
          Nouvelles Entreprises
        </h2>
        <button onClick={() => navigate('/business')} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          Voir tout <ChevronRight size={14} />
        </button>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-0 -mx-4 md:mx-0">
          {companies.map((company) => (
            <motion.div
              key={company.id}
              whileHover={{ y: -4 }}
              className="flex-shrink-0 w-72 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all"
            >
              <button onClick={() => navigate('/business', { state: { selectedCompanyId: company.id } })} className="flex gap-3">
                <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Briefcase size={24} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{company.name}</h3>
                  <p className="text-xs text-slate-500 mb-2 truncate">{company.sector}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase">
                      Nouveau
                    </span>
                    {company.isShop === 1 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-600 rounded-full uppercase">
                        Boutique
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-400 fill-yellow-400" />
                  <span className="text-[10px] font-bold text-slate-600">Nouveau membre</span>
                </div>
                <button 
                  onClick={() => navigate('/business', { state: { selectedCompanyId: company.id } })}
                  className="text-[10px] font-bold text-primary hover:bg-primary/5 px-2 py-1 rounded-lg transition-colors"
                >
                  Découvrir
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
