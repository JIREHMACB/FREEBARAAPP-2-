import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { getAI, safeGenerateContent } from '../lib/gemini';
import { Users, Plus, Search, BookOpen, Image as ImageIcon, Sparkles, PlayCircle, FileText, ChevronRight, CheckCircle2, Award, Clock, TrendingUp, Loader2, MessageSquare, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import PannelDetail from './PannelDetail';
import LoadingSpinner from '../components/LoadingSpinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function Pannel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'courses'>('all');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [hasCourses, setHasCourses] = useState(false);
  const [sortByMembers, setSortByMembers] = useState<'none' | 'asc' | 'desc'>('none');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseTypeFilter, setCourseTypeFilter] = useState('all');
  const [courseThemeFilter, setCourseThemeFilter] = useState('all');
  
  const [selectedPannelId, setSelectedPannelId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pannelForm, setPannelForm] = useState({ id: undefined, name: '', theme: '', description: '', logoUrl: '', coverUrl: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({ pannelId: '', title: '', description: '', url: '', type: 'pdf', file: null as File | null });
  const [primaryColor, setPrimaryColor] = useState('#155be3');

  // Queries
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allPannels = [], isLoading: loadingAll } = useQuery({
    queryKey: ['pannels', 'all'],
    queryFn: () => api.pannels.getAll(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: myPannels = [], isLoading: loadingMy } = useQuery({
    queryKey: ['pannels', 'my'],
    queryFn: () => api.pannels.getMy(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: allCourses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.courses.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const loading = loadingAll || loadingMy || loadingCourses;

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    // Update hover color based on primary color (simplified)
    document.documentElement.style.setProperty('--color-primary-hover', `${primaryColor}cc`);
  }, [primaryColor]);

  useEffect(() => {
    if (currentUser?.interests && allCourses.length > 0 && suggestions.length === 0) {
      generateSuggestions(currentUser, allCourses);
    }
  }, [currentUser, allCourses]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://picsum.photos/seed/pannel/400/400';
  };

  const generateSuggestions = async (user: any, courses: any[]) => {
    if (!user?.interests || courses.length === 0 || suggesting) return;
    
    setSuggesting(true);
    try {
      const prompt = `En tant qu'assistant d'apprentissage pour la Jeune Chambre Économique (JCE), suggère les 3 meilleurs cours parmi la liste suivante basés sur les centres d'intérêt de l'utilisateur.
      
      Centres d'intérêt de l'utilisateur : ${user.interests}
      
      Liste des cours disponibles :
      ${courses.map((c: any) => `- ID: ${c.id}, Titre: ${c.title}, Description: ${c.description}, Thème du Pannel: ${c.pannelTheme}`).join('\n')}
      
      Réponds UNIQUEMENT avec un tableau JSON contenant les IDs des cours suggérés.
      Exemple: [1, 5, 12]`;

      const response = await safeGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const suggestedIds = JSON.parse(response?.text || '[]');
      const suggestedCourses = courses.filter(c => suggestedIds.includes(c.id));
      setSuggestions(suggestedCourses);
    } catch (err) {
      console.error('AI Suggestion Error:', err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'coverUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match('image/(jpeg|png)')) {
        toast.error('Format non supporté. Utilisez JPEG ou PNG.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPannelForm(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateOrUpdatePannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (pannelForm.id) {
        await api.pannels.update(pannelForm.id, pannelForm);
        toast.success('Pannel mis à jour avec succès');
      } else {
        await api.pannels.create(pannelForm);
        toast.success('Pannel créé avec succès');
      }
      setShowCreateModal(false);
      setPannelForm({ id: undefined, name: '', theme: '', description: '', logoUrl: '', coverUrl: '' });
      queryClient.invalidateQueries({ queryKey: ['pannels'] });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'enregistrement du pannel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePannel = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce pannel ?')) return;
    try {
      await api.pannels.delete(id);
      if (selectedPannelId === id) setSelectedPannelId(null);
      queryClient.invalidateQueries({ queryKey: ['pannels'] });
      toast.success('Pannel supprimé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleJoinPannel = async (id: number) => {
    try {
      await api.pannels.join(id);
      toast.success('Vous avez rejoint le pannel !');
      queryClient.invalidateQueries({ queryKey: ['pannels'] });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la jonction');
    }
  };

  if (selectedPannelId) {
    return (
      <PannelDetail 
        pannelId={selectedPannelId} 
        onBack={() => setSelectedPannelId(null)} 
        currentUser={currentUser}
        onEdit={(pannel) => {
          setPannelForm(pannel);
          setShowCreateModal(true);
        }}
        onDelete={handleDeletePannel}
      />
    );
  }

  if (loading) return <LoadingSpinner />;

  let displayPannels = activeTab === 'all' ? allPannels : myPannels;

  // Apply filters
  if (search) {
    displayPannels = displayPannels.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }
  if (hasCourses) {
    displayPannels = displayPannels.filter(p => p.hasCourses);
  }
  
  // Apply sorting
  if (sortByMembers !== 'none') {
    displayPannels = [...displayPannels].sort((a, b) => {
      const aMembers = a.membersCount || 0;
      const bMembers = b.membersCount || 0;
      return sortByMembers === 'asc' ? aMembers - bMembers : bMembers - aMembers;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Pannels d'apprentissage</h2>
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
          <label className="text-sm font-bold text-slate-700">Couleur UI :</label>
          <input 
            type="color" 
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-10 h-10 rounded-xl cursor-pointer"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            placeholder="Rechercher un pannel..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer group">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={hasCourses} 
                onChange={e => setHasCourses(e.target.checked)} 
                className="peer sr-only" 
              />
              <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
            </div>
            <span className="group-hover:text-primary transition-colors">Avec cours</span>
          </label>
          <select 
            value={sortByMembers} 
            onChange={e => setSortByMembers(e.target.value as any)}
            className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="none">Trier par membres</option>
            <option value="asc">Membres (croissant)</option>
            <option value="desc">Membres (décroissant)</option>
          </select>
        </div>
      </div>

      {/* Top 5 Popular Pannels */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-primary/5 blur-3xl rounded-full"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Award className="text-amber-500" size={24} /> Pannels à la une
              </h3>
              <p className="text-sm text-slate-500 font-medium">Les communautés d'apprentissage les plus actives</p>
            </div>
            <div className="flex -space-x-2">
              {[...allPannels].sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0)).slice(0, 3).map((p, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden">
                  <img src={p.logoUrl || `https://picsum.photos/seed/${p.id}/100/100`} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
            {[...allPannels].sort((a, b) => (b.membersCount || 0) - (a.membersCount || 0)).slice(0, 5).map((pannel, index) => (
              <motion.div 
                key={pannel.id} 
                whileHover={{ y: -5 }}
                className="relative group cursor-pointer" 
                onClick={() => setSelectedPannelId(pannel.id)}
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center z-10 border border-slate-50">
                  <span className="text-xs font-black text-primary">0{index + 1}</span>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center group-hover:bg-white group-hover:shadow-xl group-hover:border-primary/10 transition-all duration-300">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm mb-4 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:scale-110 transition-transform">
                    {pannel.logoUrl ? <img src={pannel.logoUrl} alt={pannel.name} className="w-full h-full object-cover" /> : <BookOpen size={28} className="text-primary" />}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm truncate w-full mb-1">{pannel.name}</h4>
                  <div className="flex items-center gap-1 text-[10px] text-primary font-black uppercase tracking-widest">
                    <Users size={10} /> {pannel.membersCount || 0}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/10 via-white to-blue-50/30 rounded-3xl p-6 border border-primary/10 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-slate-900">Suggéré pour vous</h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto">IA</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestions.map(course => (
                <div 
                  key={course.id} 
                  className="bg-white p-4 rounded-2xl border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setSelectedPannelId(course.pannelId)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {course.fileType === 'video' ? <PlayCircle size={16} className="text-blue-500" /> : <FileText size={16} className="text-red-500" />}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{course.pannelTheme}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">{course.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400">{course.duration}</span>
                    <ChevronRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2 p-1 bg-white border border-slate-100 rounded-2xl w-fit shadow-sm">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Tous les pannels
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'my' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Mes pannels
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === 'courses' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Cours
          </button>
        </div>
        
        {activeTab === 'my' && (
          <button 
            onClick={() => {
              setPannelForm({ id: undefined, name: '', theme: '', description: '', logoUrl: '', coverUrl: '' });
              setShowCreateModal(true);
            }}
            className="hidden sm:flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
          >
            <Plus size={20} /> Créer un pannel
          </button>
        )}
      </div>

      {/* Grid */}
      {activeTab !== 'courses' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeTab === 'my' && (
          <button 
            onClick={() => {
              setPannelForm({ id: undefined, name: '', theme: '', description: '', logoUrl: '', coverUrl: '' });
              setShowCreateModal(true);
            }}
            className="bg-primary/5 hover:bg-primary/10 border-2 border-dashed border-primary/20 rounded-[40px] p-8 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.02] group min-h-[320px]"
          >
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
              <Plus size={40} />
            </div>
            <div className="text-center">
              <span className="block font-black text-primary text-xl mb-1">Créer un pannel</span>
              <span className="text-sm text-primary/60 font-medium">Partagez vos connaissances avec le monde</span>
            </div>
          </button>
        )}

        {displayPannels.map(pannel => {
          const isMember = myPannels.some(p => p.id === pannel.id);
          return (
            <motion.div 
              key={pannel.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group overflow-hidden flex flex-col h-full"
            >
              <div className="h-40 bg-slate-100 relative overflow-hidden">
                {pannel.coverUrl ? (
                  <img src={pannel.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" loading="lazy" onError={handleImageError} />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 via-purple-500/20 to-blue-500/20" />
                )}
                <div className="absolute top-5 left-5">
                  <div className="flex flex-wrap gap-2">
                    {pannel.theme && (Array.isArray(pannel.theme) ? pannel.theme : pannel.theme.split(',')).map((tag: string) => (
                      <span key={tag.trim()} className="px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-2xl text-[10px] font-black text-primary uppercase tracking-widest shadow-sm">
                        {typeof tag === 'string' ? tag.trim() : tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="p-8 flex flex-col flex-1 relative">
                <div className="absolute -top-10 left-8 w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-primary shadow-xl overflow-hidden border-4 border-white group-hover:scale-110 transition-transform duration-500">
                  {pannel.logoUrl ? (
                    <img src={pannel.logoUrl} alt={pannel.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={handleImageError} />
                  ) : (
                    <BookOpen size={32} />
                  )}
                </div>

                <div className="mt-10">
                  <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-primary transition-colors line-clamp-1">{pannel.name}</h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl"><Users size={14} className="text-primary" /> {pannel.membersCount || 0} membres</span>
                    <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl"><BookOpen size={14} className="text-primary" /> {pannel.coursesCount || 0} cours</span>
                  </div>
                </div>

                <p className="text-sm text-slate-500 mt-5 mb-8 flex-1 line-clamp-3 leading-relaxed font-medium">{pannel.description}</p>
                
                <div className="flex items-center gap-3 pt-6 border-t border-slate-50">
                  <button 
                    onClick={() => setSelectedPannelId(pannel.id)}
                    className="flex-1 bg-slate-900 text-white py-4 rounded-[20px] text-xs font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200 hover:shadow-primary/30"
                  >
                    <BookOpen size={16} /> Explorer
                  </button>
                  {!isMember && (
                    <button 
                      onClick={() => handleJoinPannel(pannel.id)}
                      className="px-6 py-4 bg-primary/10 text-primary rounded-[20px] text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                    >
                      Rejoindre
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      ) : (
        <div className="space-y-10">
          {/* Featured Courses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary/20 blur-3xl rounded-full"></div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="text-primary" size={24} />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Recommandation IA</span>
                </div>
                <h3 className="text-3xl font-black mb-4 leading-tight">Boostez vos compétences avec nos cours à la une</h3>
                <p className="text-slate-300 mb-8 max-w-lg font-medium">Découvrez des contenus sélectionnés par notre intelligence artificielle en fonction de vos centres d'intérêt et de votre parcours.</p>
                <div className="mt-auto flex items-center gap-4">
                  <button 
                    onClick={() => {
                      const firstSuggested = suggestions[0];
                      if (firstSuggested) setSelectedPannelId(firstSuggested.pannelId);
                    }}
                    className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl"
                  >
                    Commencer maintenant
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="text-primary" size={20} /> Tendances
              </h3>
              <div className="space-y-4">
                {allCourses.slice(0, 4).map((course, i) => (
                  <div 
                    key={course.id} 
                    className="flex items-center gap-4 group cursor-pointer"
                    onClick={() => setSelectedPannelId(course.pannelId)}
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <span className="text-sm font-black">0{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">{course.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{course.pannelTheme}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-2xl font-black text-slate-900">Bibliothèque de cours</h3>
              <p className="text-sm text-slate-500 font-medium">Explorez tous les contenus disponibles</p>
            </div>
            {myPannels.length > 0 && (
              <button 
                onClick={() => setShowCreateCourseModal(true)}
                className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                <Plus size={18} /> Nouveau cours
              </button>
            )}
          </div>

          {/* Course Filters */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                placeholder="Rechercher un cours..." 
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={courseTypeFilter} 
                onChange={e => setCourseTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="all">Tous les types</option>
                <option value="pdf">Fichier PDF</option>
                <option value="video">Vidéo MP4</option>
              </select>
              <select 
                value={courseThemeFilter} 
                onChange={e => setCourseThemeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="all">Tous les thèmes</option>
                {[...new Set(allCourses.map(c => c.pannelTheme))].map(theme => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {allCourses.filter(c => {
              const matchesSearch = c.title.toLowerCase().includes(courseSearch.toLowerCase()) || 
                                    c.description.toLowerCase().includes(courseSearch.toLowerCase());
              const matchesType = courseTypeFilter === 'all' || c.fileType === courseTypeFilter;
              const matchesTheme = courseThemeFilter === 'all' || c.pannelTheme === courseThemeFilter;
              return matchesSearch && matchesType && matchesTheme;
            }).length === 0 ? (
              <div className="col-span-full text-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="text-slate-300" size={40} />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">Aucun cours trouvé</h4>
                <p className="text-slate-500 font-medium">Essayez de modifier vos filtres de recherche.</p>
              </div>
            ) : (
              allCourses.filter(c => {
                const matchesSearch = c.title.toLowerCase().includes(courseSearch.toLowerCase()) || 
                                      c.description.toLowerCase().includes(courseSearch.toLowerCase());
                const matchesType = courseTypeFilter === 'all' || c.fileType === courseTypeFilter;
                const matchesTheme = courseThemeFilter === 'all' || c.pannelTheme === courseThemeFilter;
                return matchesSearch && matchesType && matchesTheme;
              }).map(course => (
                <motion.div 
                  key={course.id} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -8 }}
                  className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer group flex flex-col h-full relative overflow-hidden"
                  onClick={() => setSelectedPannelId(course.pannelId)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                  
                  <div className="flex items-center justify-between mb-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${course.fileType === 'video' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                        {course.fileType === 'video' ? <PlayCircle size={28} /> : <FileText size={28} />}
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block">{course.pannelTheme}</span>
                        <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors line-clamp-1 text-lg">{course.title}</h4>
                      </div>
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await api.pannels.toggleFavorite(course.pannelId, course.id);
                          toast.success('Favori mis à jour');
                          queryClient.invalidateQueries({ queryKey: ['courses'] });
                        } catch (err) {
                          console.error(err);
                          toast.error('Erreur lors de la mise à jour des favoris');
                        }
                      }}
                      className={`p-2 rounded-xl transition-all ${course.isFavorite ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:bg-slate-100'}`}
                    >
                      <Star size={20} fill={course.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  
                  <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1 leading-relaxed font-medium">{course.description}</p>
                  
                  {/* Indicateur de progression */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span>Progression</span>
                      <span>{course.progressStatus === 'completed' ? '100' : (course.progress || 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${course.progressStatus === 'completed' ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${course.progressStatus === 'completed' ? 100 : (course.progress || 0)}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl">
                          <Clock size={14} className="text-primary" /> {course.duration || 'N/A'}
                        </span>
                      </div>
                      <div className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl ${
                        course.progressStatus === 'completed' ? 'text-emerald-600 bg-emerald-50' : 
                        course.progressStatus === 'en_cours' ? 'text-amber-600 bg-amber-50' : 
                        'text-slate-500 bg-slate-100'
                      }`}>
                        {course.progressStatus === 'completed' ? 'Terminé' : 
                         course.progressStatus === 'en_cours' ? 'En cours' : 
                         'À faire'}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <BookOpen size={16} />
                        </div>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Voir le cours</span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center group-hover:bg-primary transition-colors shadow-lg shadow-slate-200">
                        <ChevronRight size={20} className="transform group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl my-8">
            <h2 className="text-2xl font-bold mb-6">{pannelForm.id ? 'Modifier le Pannel' : 'Créer un Pannel'}</h2>
            <form onSubmit={handleCreateOrUpdatePannel} className="space-y-4">
              
              {/* Image Uploads */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Logo (JPEG/PNG)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                    {pannelForm.logoUrl ? (
                      <div className="relative w-20 h-20 mx-auto">
                        <img src={pannelForm.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="py-4 text-slate-400">
                        <ImageIcon className="mx-auto mb-2" size={24} />
                        <span className="text-sm">Choisir un logo</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png" 
                      onChange={(e) => handleImageUpload(e, 'logoUrl')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Couverture (JPEG/PNG)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors relative">
                    {pannelForm.coverUrl ? (
                      <div className="relative w-full h-20 mx-auto">
                        <img src={pannelForm.coverUrl} alt="Cover" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="py-4 text-slate-400">
                        <ImageIcon className="mx-auto mb-2" size={24} />
                        <span className="text-sm">Choisir une couverture</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png" 
                      onChange={(e) => handleImageUpload(e, 'coverUrl')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nom du pannel</label>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={pannelForm.name || ''} onChange={e => setPannelForm({...pannelForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Thème principal</label>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" placeholder="Ex: Marketing Digital, Leadership..." value={pannelForm.theme || ''} onChange={e => setPannelForm({...pannelForm, theme: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea required rows={3} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={pannelForm.description || ''} onChange={e => setPannelForm({...pannelForm, description: e.target.value})} />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-700">Annuler</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <>
                      <div className="relative">
                        <Loader2 className="animate-spin" size={20} />
                        <MessageSquare className="absolute inset-0 m-auto text-primary" size={10} />
                      </div>
                      Création...
                    </>
                  ) : (
                    pannelForm.id ? 'Mettre à jour' : 'Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Ajouter un nouveau cours</h2>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.pannels.addCourse(Number(courseForm.pannelId), {
                    title: courseForm.title,
                    description: courseForm.description,
                    fileUrl: courseForm.url,
                    fileType: courseForm.type,
                    duration: 'N/A'
                  });
                  toast.success('Cours ajouté avec succès');
                  setShowCreateCourseModal(false);
                  setCourseForm({ pannelId: '', title: '', description: '', url: '', type: 'pdf', file: null });
                  queryClient.invalidateQueries({ queryKey: ['courses'] });
                } catch (err) {
                  console.error(err);
                  toast.error("Erreur lors de l'ajout du cours");
                }
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Pannel</label>
                <select 
                  required 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200"
                  value={courseForm.pannelId}
                  onChange={e => setCourseForm({...courseForm, pannelId: e.target.value})}
                >
                  <option value="">Sélectionner un pannel</option>
                  {myPannels.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Titre du cours</label>
                <input required className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={courseForm.title || ''} onChange={e => setCourseForm({...courseForm, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea required rows={3} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={courseForm.description || ''} onChange={e => setCourseForm({...courseForm, description: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Type de fichier</label>
                <select className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200" value={courseForm.type} onChange={e => setCourseForm({...courseForm, type: e.target.value})}>
                  <option value="pdf">Fichier PDF</option>
                  <option value="video">Vidéo MP4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Fichier du cours</label>
                <div className="relative">
                  <input 
                    required 
                    type="file" 
                    accept={courseForm.type === 'pdf' ? '.pdf' : 'video/mp4'}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Simulate file upload by creating a local object URL
                        const url = URL.createObjectURL(file);
                        setCourseForm({...courseForm, file, url});
                      }
                    }} 
                  />
                  {courseForm.file && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">
                      Fichier sélectionné : {courseForm.file.name}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateCourseModal(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-700">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
