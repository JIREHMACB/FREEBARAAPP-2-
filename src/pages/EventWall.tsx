import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  MapPin, Calendar as CalendarIcon, Users, Heart, MessageCircle, 
  Share2, UserPlus, ArrowLeft, Send, 
  Info, Clock, Check, X, Search, RefreshCw, Video, ChevronRight,
  Facebook, Linkedin, Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import MapComponent from '../components/MapComponent';
import { Skeleton } from '../components/Skeleton';

export default function EventWall() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [eventData, commentsData, participantsData, userData] = await Promise.all([
        api.events.getById(Number(id)),
        api.events.getComments(Number(id)),
        api.events.getParticipants(Number(id)),
        api.users.me()
      ]);
      setEvent(eventData);
      setComments(commentsData);
      setParticipants(participantsData);
      setCurrentUser(userData);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger l'événement");
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleFavorite = async () => {
    if (!event) return;
    try {
      const result = await api.events.favorite(event.id);
      setEvent((prev: any) => ({
        ...prev,
        isFavorite: result.isFavorite,
        favoritesCount: result.isFavorite ? prev.favoritesCount + 1 : prev.favoritesCount - 1
      }));
      toast.success(result.isFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'ajout aux favoris');
    }
  };

  const handleShareAction = async (platform: string) => {
    if (!event) return;

    const shareUrl = window.location.href;
    const text = `Découvrez cet événement : ${event.title}`;

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Lien copié !');
        break;
    }

    if (url) {
      window.open(url, '_blank');
    }

    try {
      const response = await api.events.share(event.id);
      setEvent((prev: any) => ({ ...prev, shares_count: response.shares_count }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !event) return;
    try {
      const newComment = await api.events.addComment(event.id, commentText);
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      toast.success('Commentaire ajouté');
    } catch (err) {
      console.error(err);
    }
  };

  const handleParticipate = async () => {
    if (!event) return;
    try {
      await api.events.participate(event.id);
      toast.success('Vous participez à cet événement !');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la participation');
    }
  };

  const handleUnparticipate = async () => {
    if (!event) return;
    if (!confirm('Souhaitez-vous vraiment annuler votre participation ?')) return;
    try {
      await api.events.unparticipate(event.id);
      toast.success('Participation annulée');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'annulation');
    }
  };

  const handleInvite = async () => {
    if (selectedUsers.length === 0 || !event) return;
    try {
      await api.events.invite(event.id, selectedUsers);
      toast.success('Invitations envoyées !');
      setShowInviteModal(false);
      setSelectedUsers([]);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi des invitations");
    }
  };

  const fetchUsersToInvite = async () => {
    try {
      const users = await api.users.getAll({ name: searchUser });
      // Filter out current user and already participants
      setAllUsers(users.filter((u: any) => u.id !== currentUser?.id && !participants.some(p => p.id === u.id)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showInviteModal) {
      fetchUsersToInvite();
    }
  }, [showInviteModal, searchUser]);

  if (loading) {
    return (
      <div className="max-w-[1850px] mx-auto space-y-8 pb-20 p-4">
        {/* Header Skeleton */}
        <Skeleton className="w-full h-[300px] md:h-[400px] rounded-[40px]" />
        
        {/* Content Skeleton */}
        <div className="space-y-6">
           <Skeleton variant="text" className="w-3/4 h-12" />
           <div className="space-y-3">
             <Skeleton variant="text" className="w-full h-5" />
             <Skeleton variant="text" className="w-full h-5" />
             <Skeleton variant="text" className="w-2/3 h-5" />
           </div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="max-w-[1850px] mx-auto space-y-8 pb-20">
      {/* Header / Cover */}
      <div className="relative h-[300px] md:h-[400px] rounded-[40px] overflow-hidden shadow-2xl bg-slate-900 flex items-center justify-center">
        {event.imageUrl ? (
          <>
            {/* Blurred background for no-crop effect */}
            <img 
              src={event.imageUrl} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40" 
              aria-hidden="true"
            />
            {/* Main image - no crop */}
            <img 
              src={event.imageUrl} 
              alt={event.title} 
              className="relative w-full h-full object-contain z-10" 
              referrerPolicy="no-referrer"
            />
          </>
        ) : (
          <div className="w-full h-full gradient-bg flex items-center justify-center">
            <CalendarIcon size={80} className="text-white opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent z-20" />
        
        <button 
          onClick={() => navigate('/events')}
          className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-2xl transition-all z-30"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="absolute bottom-8 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-6 z-30">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                {event.category}
              </span>
              {event.price > 0 && (
                <span className="px-3 py-1 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                  {event.price} €
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">{event.title}</h1>
            <div className="flex items-center gap-4 text-white/80 text-sm md:text-base">
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-primary" />
                <span>{format(new Date(event.startDate), "d MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-primary" />
                <span>{event.city}, {event.country}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {event.creatorId !== currentUser?.id && (
              event.isParticipating ? (
                <button 
                  onClick={handleUnparticipate}
                  className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-200 flex items-center gap-2"
                >
                  <X size={20} />
                  Annuler participation
                </button>
              ) : (
                <button 
                  onClick={handleParticipate}
                  className="px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary/30 flex items-center gap-2"
                >
                  <Check size={20} />
                  Participer
                </button>
              )
            )}
            <button 
              onClick={() => setShowInviteModal(true)}
              className="px-6 py-4 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              <UserPlus size={20} />
              Inviter
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info size={20} className="text-primary" />
              À propos de l'événement
            </h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          {/* En savoir plus (Visual/Video) */}
          {event.visualUrl && (
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Video size={20} className="text-primary" />
                En savoir plus
              </h2>
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center shadow-inner">
                {event.visualUrl.includes('video/mp4') || event.visualUrl.includes('data:video') || event.visualUrl.toLowerCase().endsWith('.mp4') ? (
                  <video src={event.visualUrl} controls className="w-full h-full relative z-10" />
                ) : (
                  <>
                    <img 
                      src={event.visualUrl} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30" 
                    />
                    <img src={event.visualUrl} alt="Visuel de l'événement" className="w-full h-full object-contain relative z-10" referrerPolicy="no-referrer" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Interactions */}
          <div className="flex flex-col gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <button 
                  onClick={handleFavorite}
                  className={`flex items-center gap-2 transition-all ${event.isFavorite ? 'text-red-500 scale-110' : 'text-slate-500 hover:text-red-500'}`}
                >
                  <Heart size={24} fill={event.isFavorite ? 'currentColor' : 'none'} />
                  <span className="font-bold">{event.favoritesCount || 0}</span>
                </button>
                <div className="flex items-center gap-2 text-slate-500">
                  <MessageCircle size={24} />
                  <span className="font-bold">{comments.length}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <Share2 size={24} />
                  <span className="font-bold">{event.shares_count || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Partager cet événement sur</p>
              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => handleShareAction('whatsapp')}
                  className="p-3 bg-white hover:bg-green-50 text-green-600 rounded-2xl shadow-sm transition-all hover:-translate-y-1"
                >
                  <MessageCircle size={24} />
                </button>
                <button 
                  onClick={() => handleShareAction('facebook')}
                  className="p-3 bg-white hover:bg-blue-50 text-blue-600 rounded-2xl shadow-sm transition-all hover:-translate-y-1"
                >
                  <Facebook size={24} />
                </button>
                <button 
                  onClick={() => handleShareAction('linkedin')}
                  className="p-3 bg-white hover:bg-sky-50 text-sky-600 rounded-2xl shadow-sm transition-all hover:-translate-y-1"
                >
                  <Linkedin size={24} />
                </button>
                <button 
                  onClick={() => handleShareAction('copy')}
                  className="p-3 bg-white hover:bg-slate-100 text-slate-600 rounded-2xl shadow-sm transition-all hover:-translate-y-1"
                >
                  <Link size={24} />
                </button>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Commentaires</h2>
            
            <form onSubmit={handleAddComment} className="flex gap-4">
              <img src={currentUser?.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="Avatar" />
              <div className="flex-1 relative">
                <input 
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>

            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <img src={comment.userAvatar} className="w-10 h-10 rounded-full object-cover" alt={comment.userName} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{comment.userName}</span>
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(comment.createdAt), "d MMM 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm">{comment.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-center py-8 text-slate-400 italic">
                  Soyez le premier à commenter cet événement !
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Organizer */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Organisé par</h3>
            <div className="flex items-center gap-4">
              <img src={event.creatorAvatar} className="w-12 h-12 rounded-2xl object-cover" alt={event.creatorName} />
              <div>
                <p className="font-bold text-slate-900">{event.creatorName}</p>
                <p className="text-xs text-slate-500">Membre de la communauté</p>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Horaire</p>
                <p className="text-sm font-bold text-slate-900">
                  {format(new Date(event.startDate), "HH:mm")} - {format(new Date(event.endDate), "HH:mm")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Participants</p>
                <p className="text-sm font-bold text-slate-900">{event.participantsCount || 0} inscrits</p>
              </div>
            </div>
          </div>

          {/* Participants List */}
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Participants</h3>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {participants.length}
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {participants.slice(0, 12).map(p => (
                  <motion.img 
                    whileHover={{ scale: 1.1, y: -2 }}
                    key={p.id} 
                    src={p.avatarUrl} 
                    className="w-10 h-10 rounded-xl border-2 border-white shadow-sm cursor-pointer object-cover" 
                    alt={p.name}
                    title={p.name}
                    onClick={() => navigate(`/profile/${p.id}`)}
                  />
                ))}
                {participants.length > 12 && (
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500 border-2 border-white shadow-sm">
                    +{participants.length - 12}
                  </div>
                )}
                {participants.length === 0 && (
                  <p className="text-xs text-slate-400 italic">Soyez le premier à rejoindre !</p>
                )}
              </div>
              
              {participants.length > 0 && (
                <button 
                  onClick={() => setShowParticipantsModal(true)}
                  className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors border border-dashed border-slate-200 rounded-2xl hover:border-primary/30"
                >
                  Voir tous les participants
                </button>
              )}
            </div>
          </div>

          {/* Map */}
          {event.latitude && event.longitude && (
            <div className="bg-white p-2 rounded-[32px] shadow-sm border border-slate-100 overflow-hidden h-[250px]">
              <MapComponent 
                lat={event.latitude} 
                lng={event.longitude} 
                title={event.title} 
              />
            </div>
          )}
        </div>
      </div>

      {/* Participants Modal */}
      <AnimatePresence>
        {showParticipantsModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Participants ({participants.length})</h3>
                <button onClick={() => setShowParticipantsModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {participants.map(p => (
                  <div 
                    key={p.id}
                    onClick={() => {
                       setShowParticipantsModal(false);
                       navigate(`/profile/${p.id}`);
                    }}
                    className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                  >
                    <img src={p.avatarUrl} className="w-12 h-12 rounded-2xl object-cover shadow-sm" alt={p.name} />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.profession || 'Membre'}</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300" />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Inviter des membres</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Rechercher un membre..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  {allUsers.map(u => (
                    <div 
                      key={u.id}
                      onClick={() => {
                        setSelectedUsers(prev => 
                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                      className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                        selectedUsers.includes(u.id) ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-slate-50 border-transparent border'
                      }`}
                    >
                      <img src={u.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt={u.name} />
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.profession || 'Membre'}</p>
                      </div>
                      {selectedUsers.includes(u.id) && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                  ))}
                  {allUsers.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      Aucun membre trouvé
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50">
                <button 
                  onClick={handleInvite}
                  disabled={selectedUsers.length === 0}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  Envoyer {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''} invitations
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
