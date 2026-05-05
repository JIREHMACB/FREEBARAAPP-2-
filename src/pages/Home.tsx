// This file was corrupted and deleted, reverting to a basic structure for Home.tsx based on the last known stable state.
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronRight, MapPin, UserPlus, Users, Search, Plus, Image as ImageIcon, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import Stories from '../components/Stories';
import CompaniesCarousel from '../components/CompaniesCarousel';
import BonDealWidget from '../components/BonDealWidget';
import PostCard from '../components/PostCard';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Tous', 'Business', 'Entrepreneuriat', 'Commerce', 'Motivation', 'Formation', 'Prière', 'Networking', 'Opportunités', 'Annonces'];

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedType, setFeedType] = useState('global');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postMedia, setPostMedia] = useState<{url: string, type: 'image' | 'video'}[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.users.me()
  });

  const { data: posts = [], isLoading: isLoadingPosts } = useQuery({
    queryKey: ['posts', feedType, selectedCategory, searchQuery],
    queryFn: () => api.posts.getAll(1, 20, selectedCategory, 'Tous', undefined, feedType, searchQuery)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events.getAll()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['suggestedUsers'],
    queryFn: () => api.users.getAll()
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.companies.getAll()
  });

  const createPostMutation = useMutation({
    mutationFn: (data: any) => api.posts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setShowCreateModal(false);
      setPostContent('');
      setPostMedia([]);
      toast.success('Publication partagée !');
    },
    onError: () => {
      toast.error('Erreur lors de la publication');
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && postMedia.length === 0) return;
    setIsSubmitting(true);
    createPostMutation.mutate({
      content: postContent,
      category: selectedCategory === 'Tous' ? 'Tous' : selectedCategory,
      mediaUrls: postMedia
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostMedia(prev => [...prev, { url: reader.result as string, type }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const suggestedUsers = [...users].sort(() => 0.5 - Math.random()).slice(0, 3);

  // Mixed items logic
  const getMixedFeed = () => {
    let mixed: any[] = posts.map(p => ({ ...p, feedItemType: 'post' }));
    
    // Shuffle and pick random events/companies
    const randomEvents = [...events].sort(() => 0.5 - Math.random()).slice(0, 3);
    const randomCompanies = [...companies].sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Inject events every 4 posts
    randomEvents.forEach((event, idx) => {
      const position = (idx + 1) * 3;
      if (position < mixed.length) {
        mixed.splice(position, 0, { ...event, feedItemType: 'event_suggestion' });
      }
    });

    // Inject companies every 5 posts (starting later)
    randomCompanies.forEach((company, idx) => {
      const position = (idx + 1) * 5 + 1;
      if (position < mixed.length) {
        mixed.splice(position, 0, { ...company, feedItemType: 'company_suggestion' });
      }
    });

    return mixed;
  };

  const mixedFeed = getMixedFeed();

  return (
    <div className="max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header & Search */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Actualité</h1>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button
                  onClick={() => setFeedType('global')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    feedType === 'global' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setFeedType('network')}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    feedType === 'network' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Mon Réseau
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                placeholder="Rechercher des publications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all uppercase tracking-widest ${
                    selectedCategory === category 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Post Creation Area */}
          <div 
            onClick={() => setShowCreateModal(true)}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-primary/30 transition-all group"
          >
            <div className="flex items-center gap-4">
              <img 
                src={currentUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`} 
                className="w-12 h-12 rounded-2xl bg-slate-100"
                alt="Me"
              />
              <div className="flex-1 bg-slate-50 px-6 py-3 rounded-2xl text-slate-400 font-medium group-hover:bg-slate-100 transition-colors">
                Qu'avez-vous à partager aujourd'hui ?
              </div>
              <div className="hidden sm:flex items-center gap-2 text-primary p-3 bg-primary/5 rounded-2xl">
                <Plus size={24} />
              </div>
            </div>
          </div>

          <Stories currentUser={currentUser} />
          <CompaniesCarousel />

          <div className="space-y-6">
            {isLoadingPosts ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-100 animate-pulse h-64 rounded-3xl" />
                ))}
              </div>
            ) : mixedFeed.length > 0 ? (
              mixedFeed.map((item: any, idx: number) => {
                if (item.feedItemType === 'post') {
                  return <PostCard 
                            key={`post-${item.id}-${idx}`} 
                            post={item} 
                            currentUser={currentUser} 
                            onDelete={async (postId) => {
                              try {
                                await api.posts.delete(postId);
                                queryClient.invalidateQueries({ queryKey: ['posts'] });
                                toast.success('Publication supprimée');
                              } catch(e) {
                                toast.error('Erreur lors de la suppression');
                              }
                            }}
                            onEdit={(post) => console.log('Edit post', post)}
                  />;
                }
                
                if (item.feedItemType === 'event_suggestion') {
                  return (
                    <motion.div 
                      key={`event-sug-${item.id}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[40px] shadow-xl text-white relative overflow-hidden group"
                      onClick={() => navigate(`/events?id=${item.id}`)}
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Calendar size={120} />
                      </div>
                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest">Événement suggéré</span>
                        </div>
                        <h3 className="text-3xl font-black leading-tight">{item.title}</h3>
                        <p className="text-indigo-100 font-medium line-clamp-2 opacity-80">{item.description}</p>
                        <div className="flex flex-wrap gap-4 pt-2">
                          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm">
                            <Calendar size={18} />
                            <span className="font-bold text-sm">{format(new Date(item.startDate), 'PPP', { locale: fr })}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm">
                            <MapPin size={18} />
                            <span className="font-bold text-sm">{item.city || item.location}</span>
                          </div>
                        </div>
                        <button className="mt-4 px-8 py-3 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-lg hover:shadow-white/20 transition-all">
                          S'inscrire maintenant
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                if (item.feedItemType === 'company_suggestion') {
                  return (
                    <motion.div 
                      key={`comp-sug-${item.id}-${idx}`}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="bg-white border-2 border-slate-100 p-8 rounded-[40px] shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                      onClick={() => navigate('/business', { state: { selectedCompanyId: item.id } })}
                    >
                      <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-10 group-hover:text-primary/10 transition-colors">
                        <Users size={120} />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center relative z-10">
                        <div className="w-24 h-24 rounded-3xl bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden shadow-inner">
                          {item.logoUrl ? (
                            <img src={item.logoUrl} className="w-full h-full object-cover" alt={item.name} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <Users size={40} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">Entreprise à découvrir</span>
                            {item.isShop === 1 && <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">Boutique</span>}
                          </div>
                          <h3 className="text-2xl font-black text-slate-900">{item.name}</h3>
                          <p className="text-slate-500 font-medium line-clamp-1">{item.sector} • {item.city || item.country}</p>
                          <p className="text-slate-400 text-sm line-clamp-2 italic">"{item.description}"</p>
                        </div>
                        <button className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg">
                          Voir le profil
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                return null;
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Users size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-xl font-bold text-slate-900">Aucune publication</h3>
                <p className="text-slate-500">Soyez le premier à partager quelque chose !</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block space-y-6">
          <BonDealWidget />
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 flex-shrink-0">
                    <Calendar size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900 leading-tight truncate">Événements récents</h3>
                </div>
                <button 
                  onClick={() => navigate('/events')}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center flex-shrink-0 whitespace-nowrap ml-2"
                >
                  Voir tout
                  <ChevronRight size={16} />
                </button>
             </div>
             
             <div className="space-y-4">
               {events.slice(0, 5).map((event: any) => (
                 <div 
                   key={event.id}
                   className="group cursor-pointer hover:bg-slate-50 p-3 rounded-xl transition-all duration-200 border border-transparent hover:border-slate-100"
                   onClick={() => navigate(`/events?id=${event.id}`)}
                 >
                   <div className="flex gap-4 items-center">
                     <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 shadow-inner">
                       {event.imageUrl ? (
                         <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-slate-400">
                           <Calendar size={24} />
                         </div>
                       )}
                     </div>
                     <div className="flex flex-col justify-center min-w-0">
                       <h4 className="text-sm font-bold text-slate-900 truncate">{event.title}</h4>
                       <p className="text-xs text-blue-600 font-medium mt-0.5">
                         {format(new Date(event.startDate), 'd MMM', { locale: fr })}
                       </p>
                       <div className="flex items-center text-xs text-slate-500 mt-1 truncate">
                         <MapPin size={12} className="mr-1 flex-shrink-0" />
                         <span className="truncate">{event.location}</span>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
               {events.length === 0 && (
                 <p className="text-sm text-center text-slate-500 py-4">Aucun événement à venir.</p>
               )}
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                <Users size={20} />
              </div>
              <h3 className="font-bold text-slate-900">Suggestions</h3>
            </div>
            
            <div className="space-y-4">
              {suggestedUsers.map((user: any) => (
                <div key={user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                      alt={user.name} 
                      className="w-10 h-10 rounded-full bg-slate-100"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{user.name}</h4>
                      <p className="text-xs text-slate-500 truncate">{user.title || 'Membre'}</p>
                    </div>
                  </div>
                  <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
                    <UserPlus size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900">Créer une publication</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-3 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <img 
                    src={currentUser?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.id}`} 
                    className="w-12 h-12 rounded-2xl bg-slate-100"
                    alt="Me"
                  />
                  <div>
                    <h4 className="font-bold text-slate-900">{currentUser?.name}</h4>
                    <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="text-xs font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-lg border-none focus:ring-0 cursor-pointer"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="De quoi voulez-vous discuter ?"
                  className="w-full h-40 bg-slate-50 border-none rounded-3xl p-6 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-primary/20 outline-none resize-none text-lg font-medium"
                />

                {postMedia.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {postMedia.map((media, i) => (
                      <div key={i} className="relative group rounded-2xl overflow-hidden aspect-video">
                        {media.type === 'image' ? (
                            <img src={media.url} className="w-full h-full object-cover" alt="Post preview" />
                        ) : (
                            <video src={media.url} className="w-full h-full object-cover" controls />
                        )}
                        <button 
                          onClick={() => setPostMedia(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <label className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 cursor-pointer transition-colors shadow-sm">
                      <ImageIcon size={24} />
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <label className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 cursor-pointer transition-colors shadow-sm">
                      <Video size={24} />
                      <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={isSubmitting || (!postContent.trim() && postMedia.length === 0)}
                    className="px-8 py-3 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/30 hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    {isSubmitting ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
