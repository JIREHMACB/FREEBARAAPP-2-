import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { getAI } from '../lib/gemini';
import { Briefcase, Plus, Search, MapPin, Calendar, DollarSign, User, X, Send, Info, Upload, FileText, Sparkles, BookOpen, Eye, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function Offers() {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'recrutement' | 'projet'>('recrutement');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showCvPreview, setShowCvPreview] = useState(false);
  const [showPortfolioPreview, setShowPortfolioPreview] = useState(false);
  const [showApplicantsModal, setShowApplicantsModal] = useState(false);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const [newService, setNewService] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    budgetAmount: '',
    budgetRate: 'heure',
    fileUrl: '',
    fileName: '',
    type: 'recrutement',
    companyName: '',
    location: '',
    contractType: 'CDI',
    category: ''
  });

  const [applyForm, setApplyForm] = useState({
    message: '',
    contactDetails: ''
  });
  const [attachCv, setAttachCv] = useState(false);
  const [attachPortfolio, setAttachPortfolio] = useState(false);
  
  const userCv = localStorage.getItem('user_cv');
  const userPortfolio = localStorage.getItem('user_portfolio');

  // Queries
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => api.services.getAll(),
    staleTime: 60 * 1000,
  });

  const { data: allCourses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.courses.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const loading = loadingServices || loadingCourses;

  useEffect(() => {
    if (currentUser?.interests && allCourses.length > 0 && recommendedCourses.length === 0) {
      fetchRecommendations(currentUser.interests, allCourses);
    }
  }, [currentUser, allCourses]);

  const fetchRecommendations = async (interests: string, courses: any[]) => {
    try {
      setLoadingRecommendations(true);
      const ai = getAI();
      const prompt = `En tant qu'assistant d'apprentissage pour la Jeune Chambre Économique (JCE), suggère les 3 meilleurs cours parmi la liste suivante basés sur les centres d'intérêt de l'utilisateur.
      
      Centres d'intérêt de l'utilisateur : ${interests}
      
      Liste des cours disponibles :
      ${courses.map((c: any) => `- ID: ${c.id}, Titre: ${c.title}, Description: ${c.description}, Thème du Pannel: ${c.pannelTheme}`).join('\n')}
      
      Réponds UNIQUEMENT avec un tableau JSON contenant les IDs des cours suggérés.
      Exemple: [1, 5, 12]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const suggestedIds = JSON.parse(response.text || '[]');
      const suggestedCourses = courses.filter(c => suggestedIds.includes(c.id)).slice(0, 3);
      setRecommendedCourses(suggestedCourses);
    } catch (err) {
      console.error('Erreur IA suggestions:', err);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const availability = newService.type === 'projet' 
        ? `Du ${newService.startDate} au ${newService.endDate} de ${newService.startTime} à ${newService.endTime}`
        : `${newService.location || 'N/A'}`;
      
      const budget = newService.type === 'projet'
        ? `${newService.budgetAmount} F CFA / ${newService.budgetRate}`
        : `${newService.budgetAmount} F CFA / mois`;

      await api.services.create({
        title: newService.title,
        description: newService.description,
        availability,
        budget,
        type: newService.type,
        companyName: newService.companyName,
        location: newService.location,
        contractType: newService.contractType,
        fileUrl: newService.fileUrl,
        category: newService.category
      });
      toast.success('Annonce créée avec succès !');
      setShowCreateModal(false);
      setNewService({ 
        title: '', description: '', startDate: '', endDate: '', startTime: '', endTime: '', 
        budgetAmount: '', budgetRate: 'heure', fileUrl: '', fileName: '',
        type: activeSubTab, companyName: '', location: '', contractType: 'CDI', category: ''
      });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de l\'annonce');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match('application/pdf|image/(jpeg|png)')) {
        toast.error('Format non supporté. Utilisez PDF, JPEG ou PNG.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewService(prev => ({ ...prev, fileUrl: reader.result as string, fileName: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    try {
      let finalMessage = applyForm.message;
      if (attachCv && userCv) {
        finalMessage += `\n\n[CV Joint]`;
      }
      if (attachPortfolio && userPortfolio) {
        finalMessage += `\n\n[Portfolio Joint]`;
      }
      
      await api.services.apply(selectedService.id, finalMessage, applyForm.contactDetails);
      toast.success('Votre candidature a été envoyée !');
      setShowApplyModal(false);
      setApplyForm({ message: '', contactDetails: '' });
      setAttachCv(false);
      setAttachPortfolio(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de l\'envoi de la candidature');
    }
  };

  const fetchApplicants = async (serviceId: number) => {
    try {
      const data = await api.services.getApplications(serviceId);
      setApplicants(data);
      setShowApplicantsModal(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des candidatures');
    }
  };

  const handleUpdateStatus = async (serviceId: number, applicationId: number, status: string) => {
    try {
      await api.services.updateApplicationStatus(serviceId, applicationId, status);
      toast.success('Statut mis à jour');
      fetchApplicants(serviceId);
      queryClient.invalidateQueries({ queryKey: ['services'] });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Annonces</h2>
        <button 
          onClick={() => {
            setNewService(prev => ({ ...prev, type: activeSubTab }));
            setShowCreateModal(true);
          }}
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          Publier une annonce
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('recrutement')}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeSubTab === 'recrutement' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Recrutement
        </button>
        <button
          onClick={() => setActiveSubTab('projet')}
          className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeSubTab === 'projet' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Projets
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          placeholder="Rechercher une offre (ex: Développeur, Graphiste...)" 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* AI Recommendations */}
      {recommendedCourses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-amber-500" size={24} />
            <h3 className="text-xl font-bold text-slate-900">Cours recommandés pour vous</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendedCourses.map(course => (
              <div key={course.id} className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 line-clamp-1">{course.title}</h4>
                    <p className="text-xs text-amber-600 font-medium">{course.pannelTheme}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{course.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.filter(s => (s.type || 'projet') === activeSubTab).length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <Briefcase className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-500 font-medium">Aucune annonce disponible dans cette catégorie.</p>
            <button 
              onClick={() => {
                setNewService(prev => ({ ...prev, type: activeSubTab }));
                setShowCreateModal(true);
              }}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Soyez le premier à en publier une !
            </button>
          </div>
        ) : (
          services.filter(s => (s.type || 'projet') === activeSubTab).map(service => (
            <motion.div 
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden"
            >
              {service.type === 'recrutement' && (
                <div className="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  {service.contractType}
                </div>
              )}
              {service.isSponsored && (
                <div className="absolute top-0 left-0 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-br-xl uppercase tracking-wider">
                  Sponsorisée
                </div>
              )}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shrink-0">
                  {service.providerAvatar ? (
                    <img src={service.providerAvatar} alt={service.providerName} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    <Briefcase size={24} />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">{service.title}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <User size={12} />
                    {service.type === 'recrutement' ? service.companyName : service.providerName}
                  </p>
                  {service.createdAt && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Publié le {format(new Date(service.createdAt), 'd MMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-600 line-clamp-3 mb-6 flex-1">
                {service.description}
              </p>

              <div className="space-y-2 mb-6">
                {service.type === 'recrutement' ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <MapPin size={14} className="text-slate-400" />
                      <span>Lieu : {service.location || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <DollarSign size={14} className="text-slate-400" />
                      <span>Salaire : {service.budget || 'À discuter'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {service.availability && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar size={14} className="text-slate-400" />
                        <span>Disponibilité : {service.availability}</span>
                      </div>
                    )}
                    {service.budget && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <DollarSign size={14} className="text-slate-400" />
                        <span>Budget : {service.budget}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedService(service)}
                  className="flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                >
                  Détails
                </button>
                {service.providerId !== currentUser?.id ? (
                  <button 
                    onClick={() => {
                      setSelectedService(service);
                      setShowApplyModal(true);
                    }}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm"
                  >
                    Postuler
                  </button>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-1">
                    <button 
                      onClick={() => {
                        setSelectedService(service);
                        fetchApplicants(service.id);
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {service.applicationsCount || 0} candidature(s)
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">
                  {newService.type === 'recrutement' ? 'Publier une offre d\'emploi' : 'Publier un projet'}
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleCreateService} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {newService.type === 'recrutement' ? (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Titre du poste</label>
                      <input 
                        required 
                        placeholder="Ex: Comptable Senior"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.title}
                        onChange={e => setNewService({...newService, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
                      <input 
                        placeholder="Ex: Finance, Marketing..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.category}
                        onChange={e => setNewService({...newService, category: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Nom de l'entreprise</label>
                      <input 
                        required 
                        placeholder="Ex: JCE International"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.companyName}
                        onChange={e => setNewService({...newService, companyName: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Lieu</label>
                        <input 
                          required 
                          placeholder="Ex: Abidjan, Plateau"
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          value={newService.location}
                          onChange={e => setNewService({...newService, location: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Type de contrat</label>
                        <select 
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          value={newService.contractType}
                          onChange={e => setNewService({...newService, contractType: e.target.value})}
                        >
                          <option value="CDI">CDI</option>
                          <option value="CDD">CDD</option>
                          <option value="Stage">Stage</option>
                          <option value="Freelance">Freelance</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Salaire mensuel (Optionnel)</label>
                      <input 
                        placeholder="Ex: 350000"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.budgetAmount}
                        onChange={e => setNewService({...newService, budgetAmount: e.target.value})}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Titre du projet</label>
                      <input 
                        required 
                        placeholder="Ex: Création d'un site e-commerce"
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.title}
                        onChange={e => setNewService({...newService, title: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
                      <input 
                        placeholder="Ex: Développement Web, Design..."
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        value={newService.category}
                        onChange={e => setNewService({...newService, category: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Disponibilité</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Date de début</label>
                            <input 
                              type="date"
                              required
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                              value={newService.startDate}
                              onChange={e => setNewService({...newService, startDate: e.target.value})}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Date de fin</label>
                            <input 
                              type="date"
                              required
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                              value={newService.endDate}
                              onChange={e => setNewService({...newService, endDate: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">Budget / Tarif</label>
                        <div className="flex gap-2">
                          <input 
                            type="number"
                            required
                            placeholder="Montant"
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                            value={newService.budgetAmount}
                            onChange={e => setNewService({...newService, budgetAmount: e.target.value})}
                          />
                          <select 
                            className="w-24 px-2 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs"
                            value={newService.budgetRate}
                            onChange={e => setNewService({...newService, budgetRate: e.target.value})}
                          >
                            <option value="heure">/h</option>
                            <option value="jour">/j</option>
                            <option value="projet">/projet</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description détaillée</label>
                  <textarea 
                    required 
                    rows={4}
                    placeholder={newService.type === 'recrutement' ? 'Missions, profil recherché, compétences requises...' : 'Décrivez votre projet, vos besoins et vos attentes...'}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    value={newService.description}
                    onChange={e => setNewService({...newService, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Fichier descriptif (Optionnel)</label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".pdf,image/jpeg,image/png" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full px-5 py-4 border-2 border-dashed rounded-2xl flex items-center justify-center gap-3 transition-colors ${newService.fileName ? 'border-primary/50 bg-primary/5' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                      {newService.fileName ? (
                        <>
                          <FileText className="text-primary" size={24} />
                          <span className="text-sm font-medium text-primary line-clamp-1">{newService.fileName}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="text-slate-400" size={24} />
                          <span className="text-sm font-medium text-slate-500">Cliquez ou glissez un fichier (PDF, JPEG, PNG)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  Publier l'offre
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedService && !showApplyModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="relative h-32 bg-primary/10">
                <button 
                  onClick={() => setSelectedService(null)}
                  className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full transition-colors shadow-sm z-10"
                >
                  <X size={20} />
                </button>
                <div className="absolute -bottom-8 left-8 w-20 h-20 bg-white rounded-3xl shadow-lg p-1">
                  <div className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center text-primary">
                    {selectedService.providerAvatar ? (
                      <img src={selectedService.providerAvatar} alt={selectedService.providerName} className="w-full h-full object-cover" />
                    ) : (
                      <Briefcase size={32} />
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-12">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedService.title}</h3>
                  <div className="flex flex-col gap-1">
                    <p className="text-slate-600 flex items-center gap-2 font-medium">
                      <User size={16} className="text-primary" />
                      Par {selectedService.providerName}
                    </p>
                    {selectedService.providerContact && (
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <Info size={16} className="text-primary" />
                        <span className="font-bold">Contact :</span> {selectedService.providerContact}
                      </p>
                    )}
                    {selectedService.createdAt && (
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <Calendar size={16} className="text-primary" />
                        Publié le {format(new Date(selectedService.createdAt), 'd MMMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <Info size={16} className="text-primary" />
                      Description
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {selectedService.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Disponibilité</p>
                      <p className="text-sm font-bold text-slate-700">{selectedService.availability || 'Non spécifiée'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Budget / Tarif</p>
                      <p className="text-sm font-bold text-slate-700">{selectedService.budget || 'À discuter'}</p>
                    </div>
                  </div>

                  {selectedService.fileUrl && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-primary" />
                        Fichier joint
                      </h4>
                      <a 
                        href={selectedService.fileUrl} 
                        download="Fichier_Descriptif"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                      >
                        <Upload size={16} />
                        Télécharger le fichier
                      </a>
                    </div>
                  )}

                  <div className="pt-4">
                    {selectedService.providerId === currentUser?.id ? (
                      <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl text-xs font-medium text-center">
                        C'est votre propre offre.
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowApplyModal(true)}
                        className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                      >
                        Postuler maintenant
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Applicants Modal */}
      <AnimatePresence>
        {showApplicantsModal && selectedService && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">Candidatures pour {selectedService.title}</h3>
                <button onClick={() => setShowApplicantsModal(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {applicants.map(app => (
                  <div key={app.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{app.applicantName}</p>
                      <p className="text-xs text-slate-500">{app.message}</p>
                    </div>
                    <select 
                      value={app.status}
                      onChange={(e) => handleUpdateStatus(selectedService.id, app.id, e.target.value)}
                      className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      <option value="En attente">En attente</option>
                      <option value="Acceptée">Acceptée</option>
                      <option value="Refusée">Refusée</option>
                    </select>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apply Modal */}
      <AnimatePresence>
        {showApplyModal && selectedService && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-900">Postuler à l'offre</h3>
                <button onClick={() => setShowApplyModal(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleApply} className="p-8 space-y-6">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <p className="text-xs text-slate-500 mb-1">Offre :</p>
                  <p className="text-sm font-bold text-slate-900">{selectedService.title}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Votre message</label>
                  <textarea 
                    required 
                    rows={4}
                    placeholder="Présentez-vous et expliquez pourquoi vous êtes intéressé..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    value={applyForm.message}
                    onChange={e => setApplyForm({...applyForm, message: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">Pièces jointes (depuis vos Outils)</label>
                  {userCv ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                      <label className="flex items-center gap-3 cursor-pointer flex-1">
                        <input 
                          type="checkbox" 
                          checked={attachCv}
                          onChange={(e) => setAttachCv(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
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
                          checked={attachPortfolio}
                          onChange={(e) => setAttachPortfolio(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
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

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vos coordonnées</label>
                  <input 
                    required 
                    placeholder="Email ou téléphone pour vous recontacter"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={applyForm.contactDetails}
                    onChange={e => setApplyForm({...applyForm, contactDetails: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Send size={20} />
                  Envoyer ma candidature
                </button>
              </form>
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
                  try {
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
                  } catch (e) {
                    return <div className="text-center p-4 text-slate-500 italic">Erreur lors de la lecture du CV. Données corrompues.</div>;
                  }
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
                  try {
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
                } catch (e) {
                  return <div className="text-center p-4 text-slate-500 italic">Erreur lors de la lecture du portfolio. Données corrompues.</div>;
                }
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
