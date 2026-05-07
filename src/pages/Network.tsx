import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import { UserPlus, MessageCircle, Users, Check, Clock, Search, Filter, Globe, Church, Briefcase, ChevronRight, ChevronLeft, Sparkles, X, Send, TrendingUp, AlertCircle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UserCarousel from '../components/UserCarousel';

const countryFlags: Record<string, string> = {
  "France": "🇫🇷",
  "Côte d'Ivoire": "🇨🇮",
  "Canada": "🇨🇦",
  "Sénégal": "🇸🇳",
  "Cameroun": "🇨🇲",
  "Belgique": "🇧🇪",
  "Suisse": "🇨🇭",
  "Togo": "🇹🇬",
  "Bénin": "🇧🇯",
  "Gabon": "🇬🇦"
};

export default function Network() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedUserForConnect, setSelectedUserForConnect] = useState<any>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    name: '',
    country: 'Tous',
    church: 'Toutes',
    profession: 'Toutes',
    skills: ''
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [churches, setChurches] = useState<string[]>([]);
  const [professions, setProfessions] = useState<string[]>([]);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => api.users.me(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Fetch all users with filters
  const { data: users = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['users', filters],
    queryFn: () => api.users.getAll(filters),
    staleTime: 60 * 1000, // 1 minute stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });

  // Extract unique values for filters when users change
  useEffect(() => {
    if (users.length > 0) {
      if (countries.length === 0) {
        const uniqueCountries = Array.from(new Set(users.map((u: any) => u.country).filter(Boolean))) as string[];
        setCountries(uniqueCountries);
      }
      if (churches.length === 0) {
        const uniqueChurches = Array.from(new Set(users.map((u: any) => u.church).filter(Boolean))) as string[];
        setChurches(uniqueChurches);
      }
      if (professions.length === 0) {
        const uniqueProfessions = Array.from(new Set(users.map((u: any) => u.profession).filter(Boolean))) as string[];
        setProfessions(uniqueProfessions);
      }
    }
  }, [users]);

  const handleConnect = async (id: number) => {
    try {
      await api.users.connect(id);
      toast.success('Demande de connexion envoyée !');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      // Error handled by centralized handler
    }
  };

  const handleConnectWithMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForConnect) return;
    
    setIsConnecting(true);
    try {
      await Promise.all([
        api.users.connect(selectedUserForConnect.id),
        api.messages.send(selectedUserForConnect.id, connectMessage)
      ]);
      toast.success('Demande et message envoyés !');
      setShowConnectModal(false);
      setConnectMessage('');
      setSelectedUserForConnect(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      // Error handled by centralized handler
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartConversation = () => {
    if (selectedUsers.length === 1) {
      navigate(`/messages/${selectedUsers[0]}`);
    } else if (selectedUsers.length > 1) {
      toast('Les conversations de groupe seront bientôt disponibles.', { icon: 'ℹ️' });
      navigate(`/messages/${selectedUsers[0]}`);
    }
    setShowNewChatModal(false);
  };

  const newLeaders = [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  const popularLeaders = [...users].sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0)).slice(0, 10);
  
  const recommendedLeaders = [...users].map(u => {
    let score = 0;
    if (currentUser) {
      // Geographic proximity
      if (u.country === currentUser.country) score += 5;
      
      // Common interests
      if (u.interests && currentUser.interests) {
        const uInterests = (Array.isArray(u.interests) ? u.interests : u.interests.split(',')).map((i: string) => typeof i === 'string' ? i.trim().toLowerCase() : i);
        const myInterests = (Array.isArray(currentUser.interests) ? currentUser.interests : currentUser.interests.split(',')).map((i: string) => typeof i === 'string' ? i.trim().toLowerCase() : i);
        const common = uInterests.filter((i: string) => myInterests.includes(i));
        score += common.length * 2;
      }
      
      // Common church
      if (u.church === currentUser.church) score += 3;
      
      // Same profession
      if (u.profession === currentUser.profession) score += 2;

      // Mutual connections
      if (u.connections && currentUser.connections) {
        const uConnections = u.connections; // Assuming array of IDs
        const myConnections = currentUser.connections; // Assuming array of IDs
        const mutual = uConnections.filter((id: number) => myConnections.includes(id));
        score += mutual.length * 3;
      }

      // Common likes
      if (u.likes && currentUser.likes) {
        const commonLikes = u.likes.filter((id: number) => currentUser.likes.includes(id));
        score += commonLikes.length * 1.5;
      }

      // Common comments
      if (u.comments && currentUser.comments) {
        const commonComments = u.comments.filter((id: number) => currentUser.comments.includes(id));
        score += commonComments.length * 1.5;
      }
    }
    return { ...u, recommendationScore: score };
  })
  .filter(u => u.recommendationScore > 0 && u.id !== currentUser?.id && !u.isFollowing)
  .sort((a, b) => b.recommendationScore - a.recommendationScore)
  .slice(0, 10);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Mon Réseau</h1>
          <p className="text-slate-500">Connectez-vous avec les leaders de la communauté</p>
        </div>
        <button 
          onClick={() => setShowNewChatModal(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-primary/20"
        >
          <MessageCircle size={20} />
          Démarrer une conversation
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Rechercher par nom..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            />
          </div>
          <div className="relative">
            <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Filtrer par compétence (ex: Marketing, Design...)"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
              value={filters.skills}
              onChange={(e) => setFilters({ ...filters, skills: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="Tous">Tous les pays</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="relative">
            <Church className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none"
              value={filters.church}
              onChange={(e) => setFilters({ ...filters, church: e.target.value })}
            >
              <option value="Toutes">Toutes les églises</option>
              {churches.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 appearance-none"
              value={filters.profession}
              onChange={(e) => setFilters({ ...filters, profession: e.target.value })}
            >
              <option value="Toutes">Toutes les professions</option>
              {professions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des leaders...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6 bg-white rounded-[40px] border border-slate-100 shadow-sm">
          <div className="p-6 bg-red-50 text-red-500 rounded-full">
            <AlertCircle size={48} />
          </div>
          <div className="text-center space-y-2 max-w-md px-6">
            <h3 className="text-xl font-bold text-slate-900">Oups ! Une erreur est survenue</h3>
            <p className="text-slate-500">{error instanceof Error ? error.message : "Impossible de charger les leaders."}</p>
          </div>
          <button 
            onClick={() => refetch()}
            className="px-8 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Carousels */}
          <div className="space-y-12">
            <UserCarousel 
              title="Leaders recommandés" 
              users={recommendedLeaders} 
              icon={Sparkles}
              onConnect={(id) => {
                if (!currentUser) {
                  toast.error('Vous devez être connecté pour vous connecter à d\'autres membres.');
                  return;
                }
                handleConnect(id);
              }}
              onConnectWithMessage={(user) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                setSelectedUserForConnect(user);
                setShowConnectModal(true);
              }}
              onMessage={(id) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                navigate(`/messages/${id}`);
              }}
              onViewProfile={(id) => navigate(`/profile/${id}`)}
            />

            <UserCarousel 
              title="Nouveaux Leaders" 
              users={newLeaders} 
              icon={Users}
              onConnect={(id) => {
                if (!currentUser) {
                  toast.error('Vous devez être connecté pour vous connecter à d\'autres membres.');
                  return;
                }
                handleConnect(id);
              }}
              onConnectWithMessage={(user) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                setSelectedUserForConnect(user);
                setShowConnectModal(true);
              }}
              onMessage={(id) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                navigate(`/messages/${id}`);
              }}
              onViewProfile={(id) => navigate(`/profile/${id}`)}
            />

            <UserCarousel 
              title="Leaders Populaires" 
              users={popularLeaders} 
              icon={TrendingUp}
              onConnect={(id) => {
                if (!currentUser) {
                  toast.error('Vous devez être connecté pour vous connecter à d\'autres membres.');
                  return;
                }
                handleConnect(id);
              }}
              onConnectWithMessage={(user) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                setSelectedUserForConnect(user);
                setShowConnectModal(true);
              }}
              onMessage={(id) => {
                if (!currentUser) {                
                  toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                  return;
                }
                navigate(`/messages/${id}`);
              }}
              onViewProfile={(id) => navigate(`/profile/${id}`)}
            />
          </div>

          {/* Main Grid */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <Users size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {filters.name || filters.country !== 'Tous' || filters.church !== 'Toutes' || filters.profession !== 'Toutes' 
                  ? `Résultats (${users.length})` 
                  : 'Tous les Leaders'}
              </h2>
            </div>
            
            {users.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <Users size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">Aucun leader trouvé avec ces critères.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {users.map((user: any) =>  (
                  <motion.div 
                    key={user.id} 
                    onClick={() => navigate(`/profile/${user.id}`)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center hover:shadow-md transition-shadow cursor-pointer relative"
                  >
                    {user.country && countryFlags[user.country] && (
                      <div className="absolute top-4 right-4 text-2xl" title={user.country}>
                        {countryFlags[user.country]}
                      </div>
                    )}
                    <div className="w-24 h-24 rounded-full bg-slate-200 mb-4 overflow-hidden ring-4 ring-slate-50">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-4xl font-bold bg-white">
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-xl text-slate-900">{user.name}</h3>
                    <p className="text-sm text-slate-500 mb-1">{user.profession}</p>
                    <p className="text-xs text-slate-400 mb-4">{user.company}</p>
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-slate-900">{user.followersCount || 0}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Connexions</span>
                      </div>
                      <div className="w-px h-8 bg-slate-100"></div>
                      <div className="flex flex-col items-center">
                        {user.country ? (
                          <img 
                            src={`https://countryflagsapi.netlify.app/flag/${user.country}.svg`} 
                            alt={user.country} 
                            className="w-8 h-6 object-cover rounded shadow-sm mb-1"
                            onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.country}&background=random`)}
                          />
                        ) : (
                          <div className="w-8 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">?</div>
                        )}
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{user.country || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold mb-6">
                      {user.badge}
                    </div>

                    <div className="flex gap-2 w-full mt-auto">
                      {user.isFollowing ? (
                        <button 
                          disabled
                          className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-600 py-3 rounded-2xl text-sm font-bold"
                        >
                          <Check size={18} />
                          Connecté
                        </button>
                      ) : user.requestSent ? (
                        <button 
                          disabled
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-3 rounded-2xl text-sm font-bold"
                        >
                          <Clock size={18} />
                          En attente
                        </button>
                      ) : (
                        <div className="flex gap-2 w-full">
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!currentUser) {
                                toast.error('Vous devez être connecté pour vous connecter à d\'autres membres.');
                                return;
                              }
                              handleConnect(user.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary-hover py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-primary/20"
                          >
                            <UserPlus size={18} />
                            Connecter
                          </motion.button>
                          <motion.button 
                            whileHover={{ scale: 1.1, rotate: 10 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!currentUser) {
                                toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                                return;
                              }
                              setSelectedUserForConnect(user);
                              setShowConnectModal(true);
                            }}
                            className="flex items-center justify-center p-3 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-2xl transition-colors"
                            title="Connecter avec un message"
                          >
                            <Send size={20} />
                          </motion.button>
                        </div>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${user.id}`);
                        }}
                        className="flex items-center justify-center p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl transition-colors"
                        title="Voir le profil"
                      >
                        <Users size={20} />
                      </button>
                      <motion.button 
                        whileHover={{ scale: 1.1, backgroundColor: '#f1f5f9' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!currentUser) {                
                            toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
                            return;
                          }
                          navigate(`/messages/${user.id}`);
                        }}
                        className="flex items-center justify-center p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl transition-colors"
                        title="Envoyer un message"
                      >
                        <MessageCircle size={22} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xl text-slate-900">Nouvelle conversation</h3>
              <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 mb-6">Sélectionnez un membre pour discuter :</p>
              <div className="space-y-3">
                {users.map((user: any) =>  (
                  <label key={user.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                    <input 
                      type="checkbox" 
                      className="w-6 h-6 rounded-lg border-slate-300 text-primary focus:ring-primary"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, user.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 ring-2 ring-white">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{user.name}</h4>
                      <p className="text-xs text-slate-500 truncate">{user.profession}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="px-6 py-3 text-slate-600 hover:bg-white rounded-2xl font-bold transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={handleStartConversation}
                disabled={selectedUsers.length === 0}
                className="px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
              >
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect with Message Modal */}
      <AnimatePresence>
        {showConnectModal && selectedUserForConnect && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl text-slate-900">Connecter avec un message</h3>
                <button onClick={() => setShowConnectModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleConnectWithMessage} className="p-8 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 ring-2 ring-white">
                    {selectedUserForConnect.avatarUrl ? (
                      <img src={selectedUserForConnect.avatarUrl} alt={selectedUserForConnect.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                        {selectedUserForConnect.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{selectedUserForConnect.name}</h4>
                    <p className="text-xs text-slate-500">{selectedUserForConnect.profession}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Votre message d'introduction</label>
                  <textarea 
                    required 
                    rows={4}
                    placeholder="Bonjour, j'aimerais rejoindre votre réseau pour..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    value={connectMessage}
                    onChange={e => setConnectMessage(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowConnectModal(false)}
                    className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isConnecting || !connectMessage.trim()}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <React.Fragment>
                        <Send size={18} />
                        Envoyer
                      </React.Fragment>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

