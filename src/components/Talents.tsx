import React, { useState } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, ChevronLeft, ChevronRight, Plus, Upload, Link as LinkIcon, X, CheckCircle2, FileText, Layout, Loader2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function Talents() {
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showCvPreview, setShowCvPreview] = useState(false);
  const [showPortfolioPreview, setShowPortfolioPreview] = useState(false);
  const [offerForm, setOfferForm] = useState({
    skill: '',
    description: '',
    portfolioType: 'link', // 'link', 'upload', 'create'
    portfolioLink: '',
    portfolioFile: null as File | null,
    attachCv: false,
    attachPortfolio: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userCv = localStorage.getItem('user_cv');
  const userPortfolio = localStorage.getItem('user_portfolio');

  const { data: talents = [], isLoading } = useQuery({
    queryKey: ['talents'],
    queryFn: async () => {
      const allUsers = await api.users.getAll();
      const allServices = await api.services.getAll();
      
      // Get set of userIds who have a service
      const userIdsWithServices = new Set(allServices.map((s: any) => s.userId));
      
      const freelancers = allUsers.filter((u: any) => 
        userIdsWithServices.has(u.id)
      );
      
      return freelancers.length > 0 ? freelancers : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        setOfferForm(prev => ({ ...prev, portfolioFile: file }));
      } else {
        toast.error('Format non supporté. Utilisez PDF, JPEG ou PNG.');
      }
    }
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.skill) {
      toast.error('Veuillez indiquer votre compétence principale.');
      return;
    }

    if (offerForm.portfolioType === 'link' && !offerForm.portfolioLink) {
      toast.error('Veuillez fournir un lien vers votre portfolio.');
      return;
    }

    if (offerForm.portfolioType === 'upload' && !offerForm.portfolioFile) {
      toast.error('Veuillez uploader votre CV ou portfolio.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalDescription = offerForm.description;
      if (offerForm.attachCv && userCv) {
        finalDescription += `\n\n[CV Joint depuis Outils]`;
      }
      if (offerForm.attachPortfolio && userPortfolio) {
        finalDescription += `\n\n[Portfolio Joint depuis Outils]`;
      }

      // Publish the service
      await api.services.create({
        type: 'freelance',
        title: offerForm.skill,
        description: finalDescription,
      });

      if (offerForm.portfolioType === 'create') {
        toast.success('Redirection vers la création de portfolio...');
        setShowOfferModal(false);
        navigate('/profile'); // Redirect to profile to complete portfolio
        return;
      }

      toast.success('Votre offre de service a été publiée avec succès !');
      setShowOfferModal(false);
      setOfferForm({ skill: '', description: '', portfolioType: 'link', portfolioLink: '', portfolioFile: null, attachCv: false, attachPortfolio: false });
      queryClient.invalidateQueries({ queryKey: ['talents'] });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la publication de l\'offre.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-12">
      {isLoading ? (
        <div className="animate-pulse h-48 bg-slate-100 rounded-3xl mb-8"></div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="text-amber-500" />
                Talents Freelances
              </h2>
              <p className="text-slate-500 font-medium mt-1">Découvrez les experts de notre communauté</p>
            </div>
            <button 
              onClick={() => setShowOfferModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-amber-500/30 transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              J'offre mes services
            </button>
          </div>

          {/* Talents Carousel */}
          <div className="flex overflow-x-auto gap-6 pb-6 scrollbar-hide snap-x">
            {talents.map((talent) => (
              <motion.div 
                key={talent.id}
                whileHover={{ y: -5 }}
                className="min-w-[280px] max-w-[280px] snap-start bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center cursor-pointer group"
                onClick={() => navigate(`/profile/${talent.id}`)}
              >
                <div className="w-24 h-24 rounded-[32px] bg-slate-100 mb-4 overflow-hidden ring-4 ring-slate-50 shadow-inner group-hover:ring-amber-500/20 transition-all">
                  {talent.avatarUrl ? (
                    <img src={talent.avatarUrl} alt={talent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl font-black bg-slate-50">
                      {talent.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <h3 className="font-black text-lg text-slate-900 truncate w-full group-hover:text-amber-600 transition-colors">{talent.name}</h3>
                <p className="text-xs font-bold text-amber-600 mb-2 truncate w-full uppercase tracking-wider">{talent.profession || 'Freelance'}</p>
                
                <div className="flex flex-wrap justify-center gap-1 mt-auto pt-4">
                  {(Array.isArray(talent.skills) 
                    ? talent.skills 
                    : (typeof talent.skills === 'string' 
                        ? talent.skills.split(',').map((s: string) => s.trim()) 
                        : ['Design', 'Développement'])
                  ).slice(0, 3).map((skill: string, idx: number) => (
                    <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">
                      {skill}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
            {talents.length === 0 && (
              <div className="w-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-500 font-medium">Aucun talent freelance pour le moment.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Offer Modal */}
      <AnimatePresence>
        {showOfferModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Proposer mes services</h2>
                  <p className="text-slate-500 font-medium mt-1">Mettez en avant vos compétences</p>
                </div>
                <button onClick={() => setShowOfferModal(false)} className="p-2 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto">
                <form id="offer-form" onSubmit={handleSubmitOffer} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Compétence principale *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Développeur Web, Designer Graphique..." 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium"
                      value={offerForm.skill}
                      onChange={e => setOfferForm({...offerForm, skill: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Description courte</label>
                    <textarea 
                      placeholder="Décrivez brièvement ce que vous proposez..." 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium min-h-[100px] resize-none"
                      value={offerForm.description}
                      onChange={e => setOfferForm({...offerForm, description: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-4">Votre Portfolio / CV *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => setOfferForm({...offerForm, portfolioType: 'link'})}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${offerForm.portfolioType === 'link' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                      >
                        <LinkIcon size={20} />
                        <span className="text-xs font-bold">Lien web</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferForm({...offerForm, portfolioType: 'upload'})}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${offerForm.portfolioType === 'upload' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                      >
                        <Upload size={20} />
                        <span className="text-xs font-bold">Uploader CV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOfferForm({...offerForm, portfolioType: 'create'})}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${offerForm.portfolioType === 'create' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                      >
                        <Plus size={20} />
                        <span className="text-xs font-bold text-center">Créer un portfolio</span>
                      </button>
                    </div>

                    {offerForm.portfolioType === 'link' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <input 
                          type="url" 
                          placeholder="https://votre-portfolio.com" 
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium"
                          value={offerForm.portfolioLink}
                          onChange={e => setOfferForm({...offerForm, portfolioLink: e.target.value})}
                        />
                      </motion.div>
                    )}

                    {offerForm.portfolioType === 'upload' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {offerForm.portfolioFile ? (
                              <>
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                                <p className="text-sm font-bold text-slate-700">{offerForm.portfolioFile.name}</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                <p className="text-sm font-bold text-slate-600">Cliquez pour uploader</p>
                                <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG (Max 5MB)</p>
                              </>
                            )}
                          </div>
                          <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={handleFileChange} />
                        </label>
                      </motion.div>
                    )}

                    {offerForm.portfolioType === 'create' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-blue-50 text-blue-800 rounded-2xl text-sm font-medium border border-blue-100">
                        Vous serez redirigé vers votre profil pour créer votre portfolio détaillé avant de finaliser cette offre.
                      </motion.div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700">Pièces jointes (depuis vos Outils)</label>
                    {userCv ? (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input 
                            type="checkbox" 
                            checked={offerForm.attachCv}
                            onChange={(e) => setOfferForm({...offerForm, attachCv: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            <FileText size={18} className="text-blue-500" />
                            <span className="text-sm font-medium text-slate-700">Joindre mon CV</span>
                          </div>
                        </label>
                        <button 
                          type="button" 
                          onClick={() => setShowCvPreview(true)}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Prévisualiser le CV"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                        <FileText size={18} />
                        <span>Aucun CV créé. Allez dans Outils pour en créer un.</span>
                      </div>
                    )}

                    {userPortfolio ? (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input 
                            type="checkbox" 
                            checked={offerForm.attachPortfolio}
                            onChange={(e) => setOfferForm({...offerForm, attachPortfolio: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <div className="flex items-center gap-2">
                            <Layout size={18} className="text-purple-500" />
                            <span className="text-sm font-medium text-slate-700">Joindre mon Portfolio</span>
                          </div>
                        </label>
                        <button 
                          type="button" 
                          onClick={() => setShowPortfolioPreview(true)}
                          className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Prévisualiser le Portfolio"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm">
                        <Layout size={18} />
                        <span>Aucun Portfolio créé. Allez dans Outils pour en créer un.</span>
                      </div>
                    )}
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowOfferModal(false)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  form="offer-form"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-500/30 transition-all disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting ? 'Publication...' : (offerForm.portfolioType === 'create' ? 'Continuer' : 'Publier mon offre')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CV Preview Modal */}
      <AnimatePresence>
        {showCvPreview && userCv && (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-blue-500" /> Prévisualisation du CV
                </h3>
                <button onClick={() => setShowCvPreview(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto">
                {(() => {
                  const cvData = JSON.parse(userCv);
                  return (
                    <div className="space-y-6">
                      <div className="border-b border-slate-200 pb-6">
                        <h1 className="text-3xl font-black text-slate-900">{cvData.nom || 'Votre Nom'}</h1>
                        <p className="text-xl text-blue-600 font-medium mt-1">{cvData.titre || 'Votre Titre Professionnel'}</p>
                      </div>
                      {cvData.resume && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm">Résumé</h3>
                          <p className="text-slate-600 leading-relaxed">{cvData.resume}</p>
                        </div>
                      )}
                      {cvData.experience && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm">Expérience Professionnelle</h3>
                          <div className="text-slate-600 whitespace-pre-wrap">{cvData.experience}</div>
                        </div>
                      )}
                      {cvData.formation && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm">Formation</h3>
                          <div className="text-slate-600 whitespace-pre-wrap">{cvData.formation}</div>
                        </div>
                      )}
                      {cvData.competences && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm">Compétences</h3>
                          <div className="text-slate-600 whitespace-pre-wrap">{cvData.competences}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Portfolio Preview Modal */}
      <AnimatePresence>
        {showPortfolioPreview && userPortfolio && (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Layout className="text-purple-500" /> Prévisualisation du Portfolio
                </h3>
                <button onClick={() => setShowPortfolioPreview(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto">
                {(() => {
                  const portfolioData = JSON.parse(userPortfolio);
                  return (
                    <div className="space-y-6">
                      <div className="border-b border-slate-200 pb-6 text-center">
                        <div className="w-24 h-24 bg-purple-100 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-black">
                          {portfolioData.nom?.[0]?.toUpperCase() || '?'}
                        </div>
                        <h1 className="text-3xl font-black text-slate-900">{portfolioData.nom || 'Votre Nom'}</h1>
                      </div>
                      {portfolioData.bio && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm text-center">À propos</h3>
                          <p className="text-slate-600 leading-relaxed text-center max-w-lg mx-auto">{portfolioData.bio}</p>
                        </div>
                      )}
                      {portfolioData.projets && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider text-sm">Projets Réalisés</h3>
                          <div className="text-slate-600 whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl border border-slate-100">{portfolioData.projets}</div>
                        </div>
                      )}
                      {portfolioData.contact && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2 uppercase tracking-wider text-sm">Contact</h3>
                          <div className="text-slate-600 whitespace-pre-wrap">{portfolioData.contact}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
