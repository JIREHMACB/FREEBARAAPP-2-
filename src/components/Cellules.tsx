import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Users, Plus, Edit3, Check, X, Search, Trash2, Calendar, ShieldCheck, Briefcase, Heart, Lightbulb, Image as ImageIcon } from 'lucide-react';
import Lightbox from './Lightbox';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import PostCard from './PostCard';

export default function Cellules() {
  const [searchParams] = useSearchParams();
  const cellIdParam = searchParams.get('cellId');
  const [myCells, setMyCells] = useState<any[]>([]);
  const [allCells, setAllCells] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCellId, setEditingCellId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingCoverUrl, setEditingCoverUrl] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [cellMembers, setCellMembers] = useState<any[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userProfessionFilter, setUserProfessionFilter] = useState('');
  const [userChurchFilter, setUserChurchFilter] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCellFeed, setShowCellFeed] = useState(false);
  const [cellPosts, setCellPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [postReactions, setPostReactions] = useState<any[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [cellSearch, setCellSearch] = useState('');
  const [cellSort, setCellSort] = useState<'name' | 'date' | 'members'>('name');
  const [feedCategory, setFeedCategory] = useState('Tous');

  // Lightbox states
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<{url: string, type: string}[]>([]);

  const openLightbox = (media: any[], index: number) => {
    setLightboxMedia(media);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Cell creation state
  const [showCreateCellModal, setShowCreateCellModal] = useState(false);
  const [newCellName, setNewCellName] = useState('');
  const [newCellDescription, setNewCellDescription] = useState('');
  const [newCellCoverUrl, setNewCellCoverUrl] = useState('');
  const [newCellSponsorId, setNewCellSponsorId] = useState<number | ''>('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isCreatingCell, setIsCreatingCell] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image est trop volumineuse (max 5Mo)');
      return;
    }

    setUploadingCover(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCellCoverUrl(reader.result as string);
        setUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading cover:', error);
      toast.error('Erreur lors du chargement de l\'image');
      setUploadingCover(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [me, myCellsData, allCellsData, usersData] = await Promise.all([
          api.users.me(),
          api.cells.getMe(),
          api.cells.getAll(),
          api.users.getAll()
        ]);
        setCurrentUser(me);
        setMyCells(myCellsData);
        setAllCells(allCellsData);
        setAllUsers(usersData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (cellIdParam && (myCells.length > 0 || allCells.length > 0)) {
      const cell = myCells.find(c => c.id === parseInt(cellIdParam)) || 
                   allCells.find(c => c.id === parseInt(cellIdParam));
      if (cell) {
        handleViewCellFeed(cell);
      }
    }
  }, [cellIdParam, myCells, allCells]);

  const sortCells = (cells: any[]) => {
    return [...cells].sort((a, b) => {
      if (cellSort === 'name') return a.name.localeCompare(b.name);
      if (cellSort === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (cellSort === 'members') return (b.membersCount || 0) - (a.membersCount || 0);
      return 0;
    });
  };

  const filteredMyCells = sortCells(myCells.filter(c => c.name.toLowerCase().includes(cellSearch.toLowerCase())));
  const filteredAllCells = sortCells(allCells.filter(c => !myCells.some(mc => mc.id === c.id) && c.name.toLowerCase().includes(cellSearch.toLowerCase())));

  const handleUpdateCell = async (id: number) => {
    try {
      await api.cells.update(id, { name: editingName, description: editingDescription, coverUrl: editingCoverUrl });
      setMyCells(prev => prev.map(c => c.id === id ? { ...c, name: editingName, description: editingDescription, coverUrl: editingCoverUrl } : c));
      setAllCells(prev => prev.map(c => c.id === id ? { ...c, name: editingName, description: editingDescription, coverUrl: editingCoverUrl } : c));
      setEditingCellId(null);
      setEditingDescription('');
      setEditingName('');
      setEditingCoverUrl('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewMembers = async (cell: any) => {
    try {
      const members = await api.cells.getMembers(cell.id);
      setCellMembers(members);
      setSelectedCell(cell);
      setShowMembersModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewCellFeed = async (cell: any) => {
    setSelectedCell(cell);
    setShowCellFeed(true);
    setLoadingPosts(true);
    try {
      const posts = await api.request(`/posts?cellId=${cell.id}`);
      setCellPosts(posts);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des publications');
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleCreateCellPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !selectedCell) return;

    setIsSubmittingPost(true);
    try {
      await api.posts.create({
        content: newPostContent,
        cellId: selectedCell.id,
        category: 'Cellule'
      });
      setNewPostContent('');
      // Refresh posts
      const posts = await api.request(`/posts?cellId=${selectedCell.id}`);
      setCellPosts(posts);
      toast.success('Publication partagée !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la publication');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const handleOpenAddMember = async () => {
    try {
      const users = await api.users.getAll();
      setAvailableUsers(users);
      setShowAddMemberModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMember = async (userId: number) => {
    if (cellMembers.some(m => m.id === userId)) return;
    try {
      await api.cells.addMember(selectedCell.id, userId);
      const updatedMembers = await api.cells.getMembers(selectedCell.id);
      setCellMembers(updatedMembers);
      // No longer closing modal automatically to allow adding multiple
      // setShowAddMemberModal(false);
      // setUserSearch('');
      // Update member count in local state
      setMyCells(prev => prev.map(c => c.id === selectedCell.id ? { ...c, membersCount: c.membersCount + 1 } : c));
      setAllCells(prev => prev.map(c => c.id === selectedCell.id ? { ...c, membersCount: c.membersCount + 1 } : c));
      toast.success('Membre ajouté avec succès !');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCell = async (id: number) => {
    setIsDeleting(true);
    try {
      await api.cells.delete(id);
      setMyCells(prev => prev.filter(c => c.id !== id));
      setAllCells(prev => prev.filter(c => c.id !== id));
      setShowDeleteConfirm(null);
      toast.success('Cellule supprimée avec succès !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression de la cellule.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShowReactions = async (postId: number) => {
    setReactionsModalOpen(true);
    setLoadingReactions(true);
    try {
      const reactions = await api.posts.getReactions(postId);
      setPostReactions(reactions);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des réactions');
    } finally {
      setLoadingReactions(false);
    }
  };

  const handleOpenCreateCell = async () => {
    try {
      const users = await api.users.getAll();
      setAllUsers(users);
      setShowCreateCellModal(true);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const handleCreateCell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCellName.trim()) {
      toast.error('Le nom de la cellule est requis');
      return;
    }

    setIsCreatingCell(true);
    try {
      await api.cells.create({
        name: newCellName,
        description: newCellDescription,
        coverUrl: newCellCoverUrl,
        sponsorId: newCellSponsorId ? Number(newCellSponsorId) : null
      });
      
      // Refresh cells
      const [myCellsData, allCellsData] = await Promise.all([
        api.cells.getMe(),
        api.cells.getAll()
      ]);
      setMyCells(myCellsData);
      setAllCells(allCellsData);
      
      setShowCreateCellModal(false);
      setNewCellName('');
      setNewCellDescription('');
      setNewCellCoverUrl('');
      setNewCellSponsorId('');
      toast.success('Cellule créée avec succès !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la cellule');
    } finally {
      setIsCreatingCell(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-8">
      {/* Mes Cellules - Carousel */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-primary" size={20} />
            Mes cellules
          </h2>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <input 
              placeholder="Rechercher..." 
              className="flex-1 sm:w-48 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={cellSearch}
              onChange={e => setCellSearch(e.target.value)}
            />
            <select 
              value={cellSort}
              onChange={e => setCellSort(e.target.value as any)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="name">Nom</option>
              <option value="date">Date</option>
              <option value="members">Membres</option>
            </select>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenCreateCell}
              className="flex-shrink-0 flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors"
            >
              <Plus size={16} /> Créer
            </motion.button>
          </div>
        </div>
        
        {filteredMyCells.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center">
            <p className="text-slate-500">Aucune cellule trouvée.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
              {filteredMyCells.map(cell => (
                <motion.button 
                  key={cell.id}
                  whileHover={{ x: 4 }}
                  onClick={() => handleViewCellFeed(cell)}
                  className="flex items-center gap-4 p-4 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all text-left w-full group"
                >
                  <div className="relative flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-tr from-orange-400 to-orange-600 flex items-center justify-center text-white overflow-hidden shadow-lg shadow-orange-500/20">
                    {cell.coverUrl ? (
                      <img src={cell.coverUrl} alt={cell.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Users size={28} />
                    )}
                    {/* Indicateur de statut (ex: actif) */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-primary rounded-full border-2 border-white"></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-black text-slate-900 text-lg truncate tracking-tight">{cell.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cellule</span>
                    </div>
                    <p className="text-sm text-slate-500 truncate leading-snug">{cell.description || 'Bienvenue dans cet espace de partage'}</p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">
                      {cell.membersCount}
                    </span>
                  </div>
                </motion.button>
              ))}
          </div>
        )}
      </section>

      {/* Toutes les cellules - Grid */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-slate-900">Autres cellules</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                placeholder="Rechercher..." 
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-48 md:w-64"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAllCells.map(cell => (
            <div 
              key={cell.id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:border-primary/30 transition-colors group relative"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                {cell.creatorAvatar ? (
                  <img src={cell.creatorAvatar} alt={cell.creatorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                    {cell.creatorName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 truncate">{cell.name}</h3>
                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                    {cell.membersCount}
                  </span>
                  {(cell.creatorId === currentUser?.id || currentUser?.role === 'admin' || cell.currentUserRole === 'admin') ? (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          setEditingCellId(cell.id);
                          setEditingName(cell.name);
                        }}
                        className="p-1 text-slate-400 hover:text-primary"
                      >
                        <Edit3 size={12} />
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowDeleteConfirm(cell.id)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </motion.button>
                    </div>
                  ) : null}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Calendar size={10} />
                  {format(new Date(cell.createdAt), 'dd/MM/yyyy')} • Par {cell.creatorName}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  {cell.membersCount} membres
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Members Modal */}
      {showMembersModal && selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedCell.name}</h3>
                <p className="text-sm text-slate-500">{cellMembers.length} membres</p>
              </div>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMembersModal(false)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </motion.button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {cellMembers.map(member => (
                <div key={member.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                        {member.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{member.name}</h4>
                      {member.role === 'admin' && <ShieldCheck size={14} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <Briefcase size={12} className="text-slate-300" />
                      {member.profession || 'Membre'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                      member.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {member.role === 'admin' ? 'Admin' : 'Membre'}
                    </span>
                    <p className="text-[8px] text-slate-300">Duis {format(new Date(member.joinedAt), 'dd/MM/yy')}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100">
              {(selectedCell.creatorId === currentUser?.id || currentUser?.role === 'admin' || selectedCell.currentUserRole === 'admin') && (
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={handleOpenAddMember}
                  className="w-full py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Ajouter un membre
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Ajouter un membre</h3>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setShowAddMemberModal(false);
                  setUserSearch('');
                }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </motion.button>
            </div>

            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Rechercher (nom, profession, église)..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input 
                  placeholder="Profession..."
                  value={userProfessionFilter}
                  onChange={(e) => setUserProfessionFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <input 
                  placeholder="Église..."
                  value={userChurchFilter}
                  onChange={(e) => setUserChurchFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {availableUsers.filter(u => 
                (u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
                 u.profession?.toLowerCase().includes(userSearch.toLowerCase()) ||
                 u.church?.toLowerCase().includes(userSearch.toLowerCase())) &&
                (userProfessionFilter === '' || u.profession?.toLowerCase().includes(userProfessionFilter.toLowerCase())) &&
                (userChurchFilter === '' || u.church?.toLowerCase().includes(userChurchFilter.toLowerCase()))
              ).length === 0 ? (
                <p className="text-center py-8 text-slate-500">Aucun utilisateur trouvé</p>
              ) : (
                availableUsers.filter(u => 
                  (u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
                   u.profession?.toLowerCase().includes(userSearch.toLowerCase()) ||
                   u.church?.toLowerCase().includes(userSearch.toLowerCase())) &&
                  (userProfessionFilter === '' || u.profession?.toLowerCase().includes(userProfessionFilter.toLowerCase())) &&
                  (userChurchFilter === '' || u.church?.toLowerCase().includes(userChurchFilter.toLowerCase()))
                ).map(user => {
                  const isMember = cellMembers.some(m => m.id === user.id);
                  return (
                    <div 
                      key={user.id}
                      className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{user.name}</h4>
                        <p className="text-xs text-slate-500 truncate">{user.profession || 'Utilisateur'}</p>
                      </div>
                      {isMember ? (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">Déjà membre</span>
                      ) : (
                        <button 
                          onClick={() => handleAddMember(user.id)}
                          className="p-2 rounded-full hover:bg-primary/10 text-primary"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-sm rounded-[32px] p-6 sm:p-8 text-center shadow-2xl"
          >
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Supprimer la cellule ?</h3>
            <p className="text-slate-500 text-sm mb-8">
              Cette action est irréversible. Tous les membres seront retirés de la cellule.
            </p>
            <div className="flex gap-3">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
              >
                Annuler
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => handleDeleteCell(showDeleteConfirm)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-red-600 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cell Feed Modal */}
      <AnimatePresence>
        {showCellFeed && selectedCell && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-4 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Users size={20} className="sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900">{selectedCell.name}</h2>
                    <p className="text-slate-500 text-xs sm:text-sm">Fil de discussion privé</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={feedCategory}
                    onChange={(e) => setFeedCategory(e.target.value)}
                    className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Tous">Tous</option>
                    <option value="Cellule">Cellule</option>
                    <option value="Prière">Prière</option>
                    <option value="Annonce">Annonce</option>
                  </select>
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCellFeed(false)}
                    className="p-2 sm:p-3 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                  >
                    <X size={20} className="text-slate-500" />
                  </motion.button>
                </div>
              </div>

              <div className="p-4 sm:p-8 overflow-y-auto flex-1 space-y-6">
                {/* Create Post in Cell */}
                <form onSubmit={handleCreateCellPost} className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  <textarea 
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Partagez quelque chose avec la cellule..."
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 resize-none min-h-[80px]"
                  />
                  <div className="flex justify-end mt-2">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={isSubmittingPost || !newPostContent.trim()}
                      className="bg-primary text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary-hover disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                      {isSubmittingPost ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Plus size={16} />
                          Publier
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>

                {/* Cell Posts List */}
                {loadingPosts ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : cellPosts.filter(p => feedCategory === 'Tous' || p.category === feedCategory).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic">
                    Aucune publication dans cette catégorie pour le moment.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cellPosts.filter(p => feedCategory === 'Tous' || p.category === feedCategory).map(post => (
                      <PostCard 
                        key={post.id} 
                        post={post}
                        currentUser={currentUser}
                        openLightbox={openLightbox}
                        onDelete={async (postId: number) => {
                          if (!confirm('Supprimer ce post ?')) return;
                          await api.posts.delete(postId);
                          setCellPosts(prev => prev.filter(p => p.id !== postId));
                        }}
                        onEdit={async (post: any) => {
                          const newContent = prompt('Modifier le post :', post.content);
                          if (newContent && newContent !== post.content) {
                            await api.posts.update(post.id, newContent);
                            setCellPosts(prev => prev.map(p => p.id === post.id ? { ...p, content: newContent } : p));
                          }
                        }}
                        onShowReactions={handleShowReactions}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reactions Modal */}
      <AnimatePresence>
        {reactionsModalOpen && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <h2 className="text-xl font-black text-slate-900">Réactions</h2>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setReactionsModalOpen(false)} 
                  className="p-2 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                >
                  <X size={20} className="text-slate-500" />
                </motion.button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {loadingReactions ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : postReactions.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Aucune réaction pour le moment.</p>
                ) : (
                  <div className="space-y-4">
                    {postReactions.map((reaction, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative">
                            {reaction.userAvatar ? (
                              <img src={reaction.userAvatar} alt={reaction.userName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                {reaction.userName?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                              {reaction.type === 'like' && <Heart size={10} className="fill-red-500 text-red-500" />}
                              {reaction.type === 'applause' && <span className="text-[10px] leading-none">👏</span>}
                              {reaction.type === 'inspiration' && <Lightbulb size={10} className="fill-purple-500 text-purple-500" />}
                            </div>
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{reaction.userName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Create Cell Modal */}
      <AnimatePresence>
        {showCreateCellModal && (
          <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-slate-900">Créer une cellule</h3>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowCreateCellModal(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </motion.button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-y-auto">
                <form id="create-cell-form" onSubmit={handleCreateCell} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo de couverture</label>
                    <div className="relative group">
                      <div className={`w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden transition-colors ${newCellCoverUrl ? 'border-primary/50' : 'hover:border-primary/50 bg-slate-50'}`}>
                        {newCellCoverUrl ? (
                          <>
                            <img src={newCellCoverUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button 
                              type="button"
                              onClick={() => setNewCellCoverUrl('')}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                              <ImageIcon size={24} />
                            </div>
                            <span className="text-xs font-medium">Cliquez pour uploader</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={uploadingCover}
                        />
                      </div>
                      {uploadingCover && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-2xl">
                          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de la cellule</label>
                    <input 
                      required 
                      value={newCellName} 
                      onChange={e => setNewCellName(e.target.value)} 
                      className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                      placeholder="Ex: Cellule des Leaders" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description (Optionnel)</label>
                    <textarea 
                      value={newCellDescription} 
                      onChange={e => setNewCellDescription(e.target.value)} 
                      className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium min-h-[100px]" 
                      placeholder="Description de la cellule..." 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parrain (Optionnel)</label>
                    <select 
                      value={newCellSponsorId} 
                      onChange={e => setNewCellSponsorId(e.target.value ? Number(e.target.value) : '')} 
                      className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    >
                      <option value="">Aucun parrain</option>
                      {allUsers.map(user => (
                        <option key={user.id} value={user.id}>{user.name} {user.profession ? `(${user.profession})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </form>
              </div>
              
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 flex gap-3">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  type="button" 
                  onClick={() => setShowCreateCellModal(false)} 
                  className="flex-1 py-3.5 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
                >
                  Annuler
                </motion.button>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  type="submit" 
                  form="create-cell-form" 
                  disabled={isCreatingCell}
                  className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
                >
                  {isCreatingCell ? 'Création...' : 'Créer'}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Lightbox */}
      <Lightbox 
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        media={lightboxMedia}
        initialIndex={lightboxIndex}
      />
    </div>
  );
}
