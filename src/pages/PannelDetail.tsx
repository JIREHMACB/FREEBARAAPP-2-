import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Users, Plus, Edit3, Check, X, ChevronLeft, BookOpen, BrainCircuit, Award, PlayCircle, FileText, Eye, Send, MessageSquare, Trash2, Link as LinkIcon, UserMinus, CheckCircle2, RefreshCw, MessageCircle, Search, Paperclip, Clock, Play, ChevronRight, StickyNote, Highlighter, Save, Maximize, Minimize, ExternalLink, Download, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import LoadingSpinner from '../components/LoadingSpinner';

interface PannelDetailProps {
  pannelId: number;
  onBack: () => void;
  currentUser: any;
  onEdit?: (pannel: any) => void;
  onDelete?: (id: number) => void;
}

const CourseViewer = ({ course, progress, onBack, onSave, isSaving }: any) => {
  const [notes, setNotes] = useState(progress?.notes || '');
  const [stickyNotes, setStickyNotes] = useState<any[]>(() => {
    try {
      return JSON.parse(progress?.stickyNotes || '[]');
    } catch {
      return [];
    }
  });
  const [position, setPosition] = useState(progress?.position || 0);
  const [showNotes, setShowNotes] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const triggerCelebration = () => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Convert Data URL to Blob URL for stability
  useEffect(() => {
    if (course.fileUrl && course.fileUrl.startsWith('data:')) {
      fetch(course.fileUrl)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        })
        .catch(err => {
          console.error('Error creating blob URL:', err);
          setBlobUrl(course.fileUrl);
        });
      return () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
      };
    } else {
      setBlobUrl(course.fileUrl);
    }
  }, [course.fileUrl]);

  // Auto-save notes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notes !== progress?.notes) {
        onSave({ notes });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [notes]);

  // Save position on unmount for videos
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        onSave({ position: videoRef.current.currentTime });
      }
    };
  }, []);

  const handleAddSticky = () => {
    const newSticky = {
      id: Date.now(),
      text: '',
      x: 20 + Math.random() * 40,
      y: 20 + Math.random() * 40,
      color: ['bg-yellow-100', 'bg-blue-100', 'bg-emerald-100', 'bg-rose-100', 'bg-purple-100'][Math.floor(Math.random() * 5)]
    };
    const updated = [...stickyNotes, newSticky];
    setStickyNotes(updated);
    onSave({ stickyNotes: JSON.stringify(updated) });
  };

  const updateSticky = (id: number, updates: any) => {
    const updated = stickyNotes.map(s => s.id === id ? { ...s, ...updates } : s);
    setStickyNotes(updated);
    onSave({ stickyNotes: JSON.stringify(updated) });
  };

  const deleteSticky = (id: number) => {
    const updated = stickyNotes.filter(s => s.id !== id);
    setStickyNotes(updated);
    onSave({ stickyNotes: JSON.stringify(updated) });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-slate-900 z-[100] flex flex-col"
    >
      {/* Header */}
      <div className="h-20 bg-slate-800/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all group"
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="h-10 w-px bg-white/10"></div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${course.type === 'video' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {course.type}
              </span>
              <h2 className="text-white font-black text-lg tracking-tight">{course.title}</h2>
            </div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Espace d'apprentissage interactif</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {['video', 'pdf'].includes(course.type) && (
            <button
              onClick={() => { toast.success(`Lecture de : ${course.title}`); }}
              className="px-6 py-3 bg-white text-primary rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 shadow-lg shadow-black/20"
            >
              {course.type === 'video' ? <PlayCircle size={16} /> : <FileText size={16} />}
              {course.type === 'video' ? 'Lire la vidéo' : 'Lire le document'}
            </button>
          )}
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5">
            {[
              { id: 'non_commence', label: 'Non commencé', color: 'text-slate-400', activeBg: 'bg-slate-700' },
              { id: 'en_cours', label: 'En cours', color: 'text-amber-400', activeBg: 'bg-amber-500/20' },
              { id: 'completed', label: 'Terminé', color: 'text-emerald-400', activeBg: 'bg-emerald-500/20' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSave({ status: s.id });
                  toast.success(`Statut : ${s.label}`);
                  if (s.id === 'completed') triggerCelebration();
                }}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  (progress?.status || 'non_commence') === s.id 
                    ? `${s.activeBg} ${s.color} shadow-lg` 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
            <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isSaving ? 'Sauvegarde...' : 'Synchronisé'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Media Area */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3b82f6_0%,transparent_50%)]"></div>
          </div>

          <div className="relative z-10 w-full h-full flex items-center justify-center p-8">
            {course.type === 'video' ? (
              <div className="w-full max-w-5xl aspect-video bg-black rounded-[32px] overflow-hidden shadow-2xl border border-white/10 relative group">
                {blobUrl ? (
                  <video 
                    ref={videoRef}
                    src={blobUrl} 
                    controls 
                    playsInline
                    className="w-full h-full"
                    onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
                    onPause={() => onSave({ position })}
                    onLoadedMetadata={(e) => {
                      if (progress?.position) e.currentTarget.currentTime = progress.position;
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="animate-spin text-primary" size={48} />
                  </div>
                )}
              </div>
            ) : course.type === 'pdf' ? (
              <div className="w-full h-full max-w-5xl bg-white rounded-[32px] overflow-hidden shadow-2xl border border-white/10">
                {blobUrl ? (
                  <object 
                    data={blobUrl} 
                    type="application/pdf" 
                    className="w-full h-full rounded-2xl"
                  >
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-900 rounded-2xl border border-white/10">
                      <FileText size={48} className="text-slate-500 mb-4" />
                      <p className="text-slate-300 mb-4 font-medium">L'affichage direct du PDF n'est pas supporté par votre navigateur.</p>
                      <a 
                        href={blobUrl} 
                        download={`${course.title}.pdf`}
                        className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all"
                      >
                        <Download size={18} />
                        Télécharger le PDF
                      </a>
                    </div>
                  </object>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="animate-spin text-primary" size={48} />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full max-w-5xl bg-white rounded-[32px] p-8 shadow-2xl border border-white/10 overflow-y-auto">
                <h3 className="text-2xl font-black mb-4">{course.title}</h3>
                <div className="text-slate-700 whitespace-pre-wrap">{course.description}</div>
              </div>
            )}
          </div>

          {/* Sticky Notes Overlay */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {stickyNotes.map(sticky => (
              <motion.div
                key={sticky.id}
                drag
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  const parent = document.querySelector('.bg-slate-950');
                  if (parent) {
                    const rect = parent.getBoundingClientRect();
                    const newX = (sticky.x + (info.offset.x / rect.width) * 100);
                    const newY = (sticky.y + (info.offset.y / rect.height) * 100);
                    updateSticky(sticky.id, { x: newX, y: newY });
                  }
                }}
                className={`absolute p-5 w-64 shadow-2xl rounded-3xl pointer-events-auto cursor-move border border-black/5 backdrop-blur-sm ${sticky.color} group/sticky`}
                style={{ left: `${sticky.x}%`, top: `${sticky.y}%` }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex gap-1">
                    {['bg-yellow-100', 'bg-blue-100', 'bg-emerald-100', 'bg-rose-100'].map(c => (
                      <button 
                        key={c} 
                        onClick={() => updateSticky(sticky.id, { color: c })}
                        className={`w-3 h-3 rounded-full border border-black/5 ${c} ${sticky.color === c ? 'ring-2 ring-black/20' : ''}`}
                      />
                    ))}
                  </div>
                  <button onClick={() => deleteSticky(sticky.id)} className="w-6 h-6 flex items-center justify-center bg-black/5 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                    <X size={12} />
                  </button>
                </div>
                <textarea 
                  value={sticky.text}
                  onChange={(e) => updateSticky(sticky.id, { text: e.target.value })}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-slate-800 placeholder:text-slate-400 resize-none min-h-[100px]"
                  placeholder="Note rapide..."
                />
              </motion.div>
            ))}
          </div>

          {/* Floating Tools */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-30">
            {course.type === 'video' && (
              <>
                <button 
                  onClick={() => onSave({ position })}
                  className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center gap-2"
                  title="Sauvegarder la position"
                >
                  <Save size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Position</span>
                </button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
              </>
            )}
            <button 
              onClick={handleAddSticky}
              className="p-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex items-center gap-2"
              title="Ajouter un post-it"
            >
              <StickyNote size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Post-it</span>
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button 
              onClick={() => setShowNotes(!showNotes)}
              className={`p-3 rounded-xl transition-all flex items-center gap-2 ${showNotes ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
            >
              <Edit3 size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Notes</span>
            </button>
          </div>
        </div>

        {/* Sidebar Notes */}
        <AnimatePresence>
          {showNotes && (
            <motion.div 
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              className="w-80 bg-slate-800 border-l border-white/5 flex flex-col z-40"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-sm uppercase tracking-widest">Bloc-notes</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sauvegarde auto</p>
                  </div>
                </div>
                <button onClick={() => setShowNotes(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-full bg-transparent text-slate-300 focus:ring-0 border-none resize-none text-sm leading-relaxed font-medium placeholder:text-slate-600"
                  placeholder="Structurez votre apprentissage ici..."
                />
              </div>
              <div className="p-6 bg-slate-900/50 border-t border-white/5 space-y-4">
                <button
                  onClick={() => onSave({ notes })}
                  disabled={isSaving || notes === progress?.notes}
                  className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  Sauvegarder les notes
                </button>
                <div className="flex items-center gap-3 text-slate-500">
                  <Clock size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Dernière modif: {formatDistanceToNow(new Date(), { addSuffix: true, locale: fr })}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Celebration Overlay */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-yellow-400 rounded-full blur-3xl opacity-50"
                />
                <Award size={128} className="text-yellow-400 fill-yellow-400 drop-shadow-2xl" />
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -100 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -top-10 -right-10 text-yellow-300"
                >
                  <Star size={32} fill="currentColor" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 0], y: -100 }}
                  transition={{ duration: 1.5, delay: 0.5, repeat: Infinity }}
                  className="absolute -top-10 -left-10 text-yellow-300"
                >
                  <Star size={32} fill="currentColor" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default function PannelDetail({ pannelId, onBack, currentUser, onEdit, onDelete }: PannelDetailProps) {
  const [pannel, setPannel] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'accueil' | 'cours' | 'revision-ia' | 'evaluations' | 'badges' | 'membres' | 'forum'>('accueil');
  const [forumMessages, setForumMessages] = useState<any[]>([]);
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(10);
  const [loadingForum, setLoadingForum] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const [newForumMessage, setNewForumMessage] = useState('');
  const [isSubmittingForum, setIsSubmittingForum] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [allAvailableUsers, setAllAvailableUsers] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [allAvailableCourses, setAllAvailableCourses] = useState<any[]>([]);

  // Course learning state
  const [activeCourse, setActiveCourse] = useState<any>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  // Course creation state
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [newCourse, setNewCourse] = useState({ title: '', description: '', duration: '', type: 'pdf', url: '', file: null as File | null });
  const [isPublishing, setIsPublishing] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);

  // Evaluation state
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [evaluatingCourse, setEvaluatingCourse] = useState<string | null>(null);

  // Comments state
  const [selectedCourseForComments, setSelectedCourseForComments] = useState<any>(null);
  const [courseComments, setCourseComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchData();
  }, [pannelId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pannelData, coursesData, membersData, badgesData, evalsData, allCoursesData, usersData] = await Promise.all([
        api.pannels.getById(pannelId),
        api.pannels.getCourses(pannelId),
        api.pannels.getMembers(pannelId),
        api.pannels.getBadges(pannelId),
        api.pannels.getEvaluations(pannelId),
        api.courses.getAll(),
        api.users.getAll()
      ]);
      setPannel(pannelData);
      setCourses(coursesData);
      setMembers(membersData);
      setAllAvailableUsers(usersData);
      setBadges(badgesData);
      setAllAvailableCourses(allCoursesData);
      // Sort evaluations by date descending
      setEvaluations(evalsData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement du pannel');
    } finally {
      setLoading(false);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = 'https://picsum.photos/seed/pannel/400/400';
  };

  const handleLinkCourse = async (course: any) => {
    try {
      await api.pannels.addCourse(pannelId, {
        title: course.title,
        description: course.description,
        duration: course.duration,
        type: course.fileType || course.type,
        url: course.url
      });
      toast.success('Cours lié avec succès');
      const coursesData = await api.pannels.getCourses(pannelId);
      setCourses(coursesData);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du lien du cours');
    }
  };

  const isOwnerOrAdmin = pannel?.ownerId === currentUser?.id; // Assuming ownerId exists

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      let finalUrl = newCourse.url;
      
      if (newCourse.file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
        });
        reader.readAsDataURL(newCourse.file);
        finalUrl = await base64Promise;
      }

      if (!finalUrl) {
        toast.error('Veuillez sélectionner un fichier');
        setIsPublishing(false);
        return;
      }

      await api.pannels.addCourse(pannelId, {
        title: newCourse.title,
        description: newCourse.description,
        duration: newCourse.duration,
        fileUrl: finalUrl,
        fileType: newCourse.type
      });
      
      toast.success('Cours ajouté avec succès');
      setShowCreateCourse(false);
      setNewCourse({ title: '', description: '', duration: '', type: 'pdf', url: '', file: null });
      const coursesData = await api.pannels.getCourses(pannelId);
      setCourses(coursesData);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout du cours");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (newCourse.type === 'pdf' && !file.type.includes('pdf')) {
        toast.error('Veuillez sélectionner un fichier PDF');
        return;
      }
      if (newCourse.type === 'video' && !file.type.includes('video')) {
        toast.error('Veuillez sélectionner un fichier vidéo MP4');
        return;
      }
      // Pour le type 'text', on peut accepter .txt ou simplement forcer sa lecture
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCourse(prev => ({ ...prev, url: reader.result as string, file }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    try {
      await api.pannels.deleteCourse(pannelId, courseId);
      toast.success('Cours supprimé avec succès');
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setCourseToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression du cours');
    }
  };

  const handleLearnCourse = async (course: any) => {
    try {
      setActiveCourse(course);
      const progress = await api.pannels.getCourseProgress(pannelId, course.id);
      setCourseProgress(progress);
      
      // Update local view count if it's the first time
      if (!progress || progress.status === 'non_commence') {
        setCourses(prev => prev.map(c => c.id === course.id ? { ...c, views: (c.views || 0) + 1 } : c));
        await api.pannels.learnCourse(pannelId, course.id, { status: 'en_cours' });
      }
      
      toast.success('Bon apprentissage !');
      
      // Simulate progression badge unlock
      const learnedCoursesCount = courses.filter(c => c.views && c.views > 0).length + 1; // Basic simulation
      if (learnedCoursesCount === 1 && !badges.some(b => b.type === 'Apprenti')) {
        await api.pannels.addBadge(pannelId, 'Apprenti');
        toast.success('Nouveau badge débloqué : Apprenti !');
        fetchData();
      } else if (learnedCoursesCount >= 5 && !badges.some(b => b.type === 'Incollable')) {
        await api.pannels.addBadge(pannelId, 'Incollable');
        toast.success('Nouveau badge débloqué : Incollable !');
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement du cours');
    }
  };

  const saveProgress = async (data: any) => {
    if (!activeCourse) return;
    setIsSavingProgress(true);
    try {
      await api.pannels.learnCourse(pannelId, activeCourse.id, data);
      setCourseProgress((prev: any) => ({ ...prev, ...data }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleOpenComments = async (course: any) => {
    setSelectedCourseForComments(course);
    try {
      const comments = await api.pannels.getCourseComments(pannelId, course.id);
      setCourseComments(comments);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des commentaires');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedCourseForComments) return;
    try {
      await api.pannels.addCourseComment(pannelId, selectedCourseForComments.id, { content: newComment });
      const comments = await api.pannels.getCourseComments(pannelId, selectedCourseForComments.id);
      setCourseComments(comments);
      setNewComment('');
      // Update local comment count
      setCourses(prev => prev.map(c => c.id === selectedCourseForComments.id ? { ...c, commentsCount: (c.commentsCount || 0) + 1 } : c));
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'ajout du commentaire");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      let aiResponse = '';
      if (!evaluatingCourse) {
        setEvaluatingCourse(userMsg);
        aiResponse = `Très bien, je vais vous évaluer sur le cours "${userMsg}". Voici la première question : Qu'avez-vous retenu de principal dans ce cours ?`;
      } else {
        // Simulate evaluation completion
        const score = Math.floor(Math.random() * 6) + 15; // Random score between 15 and 20
        aiResponse = `Excellente réponse ! J'ai terminé l'évaluation. Votre note est de ${score}/20.`;
        
        // Save evaluation
        api.pannels.addEvaluation(pannelId, { courseTitle: evaluatingCourse, score }).then(async () => {
          // Check for badge unlock (Performance)
          let badgeUnlocked = false;
          if (score >= 15 && !badges.some(b => b.type === 'Expert')) {
            await api.pannels.addBadge(pannelId, 'Expert');
            toast.success('Nouveau badge débloqué : Expert !');
            badgeUnlocked = true;
          }
          if (score === 20 && !badges.some(b => b.type === 'Major de promo')) {
            await api.pannels.addBadge(pannelId, 'Major de promo');
            toast.success('Nouveau badge débloqué : Major de promo !');
            badgeUnlocked = true;
          }
          if (badgeUnlocked) fetchData(); // Refresh badges
        });
        setEvaluatingCourse(null);
      }
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    }, 1000);
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre ?')) return;
    try {
      await api.pannels.removeMember(pannelId, userId);
      toast.success('Membre retiré avec succès');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du retrait du membre');
    }
  };

  const handleGenerateInviteLink = () => {
    const inviteLink = `${window.location.origin}/pannels/${pannelId}/join`;
    navigator.clipboard.writeText(inviteLink);
    toast.success('Lien d\'invitation copié dans le presse-papiers !');
  };

  useEffect(() => {
    if (activeTab === 'forum' && pannelId) {
      fetchForum();
    }
  }, [activeTab, pannelId]);

  const fetchForum = async () => {
    try {
      setLoadingForum(true);
      const timer = setTimeout(() => setShowLoader(true), 1000);
      const messages = await api.pannels.getForum(pannelId);
      clearTimeout(timer);
      setShowLoader(false);
      setForumMessages(messages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingForum(false);
      setShowLoader(false);
    }
  };

  const handleSendForumMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForumMessage.trim() || !pannelId) return;

    setIsSubmittingForum(true);
    try {
      await api.pannels.addForumMessage(pannelId, newForumMessage);
      setNewForumMessage('');
      fetchForum();
      toast.success('Message envoyé !');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingForum(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!pannel) return <div>Pannel introuvable</div>;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {activeCourse && (
          <CourseViewer 
            course={activeCourse} 
            progress={courseProgress} 
            onBack={() => { setActiveCourse(null); fetchData(); }}
            onSave={saveProgress}
            isSaving={isSavingProgress}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {courseToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCourseToDelete(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 text-center mb-4 uppercase tracking-tight">Supprimer ce cours ?</h3>
              <p className="text-slate-500 text-center mb-10 font-medium leading-relaxed">
                Cette action est irréversible. Toutes les données de progression et les notes associées seront définitivement supprimées.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setCourseToDelete(null)}
                  className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteCourse(courseToDelete)}
                  className="flex-1 px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-red-900/20"
                >
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="bg-white rounded-[40px] overflow-hidden shadow-sm border border-slate-100">
        <div className="h-64 bg-slate-200 relative group">
          {pannel.coverUrl ? (
            <img src={pannel.coverUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" loading="lazy" onError={handleImageError} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-blue-500/20 to-purple-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <button onClick={onBack} className="absolute top-6 left-6 p-3 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-white transition-all shadow-lg hover:scale-110 active:scale-95">
            <ChevronLeft size={24} />
          </button>

          {isOwnerOrAdmin && (
            <div className="absolute top-6 right-6 flex gap-3">
              {onEdit && (
                <button onClick={() => onEdit(pannel)} className="p-3 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-white text-slate-700 transition-all shadow-lg flex items-center gap-2 px-4 hover:scale-105 active:scale-95">
                  <Edit3 size={18} /> <span className="text-xs font-black uppercase tracking-widest">Modifier</span>
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(pannel.id)} className="p-3 bg-white/90 backdrop-blur-md rounded-2xl hover:bg-red-50 text-red-500 transition-all shadow-lg flex items-center gap-2 px-4 hover:scale-105 active:scale-95">
                  <Trash2 size={18} /> <span className="text-xs font-black uppercase tracking-widest">Supprimer</span>
                </button>
              )}
            </div>
          )}

          <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
            <div className="flex items-end gap-6">
              <div className="w-32 h-32 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-primary border-4 border-white overflow-hidden shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                {pannel.logoUrl ? (
                  <img src={pannel.logoUrl} alt={pannel.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" onError={handleImageError} />
                ) : (
                  <BookOpen size={48} />
                )}
              </div>
              <div className="mb-2">
                <div className="flex flex-wrap gap-2 mb-3">
                  {pannel.theme && (Array.isArray(pannel.theme) ? pannel.theme : pannel.theme.split(',')).map((tag: any, index: number) => (
                    <span key={index} className="px-3 py-1 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                      {typeof tag === 'string' ? tag.trim() : tag}
                    </span>
                  ))}
                </div>
                <h1 className="text-4xl font-black text-white leading-tight drop-shadow-md">{pannel.name}</h1>
                <div className="flex items-center gap-4 mt-3 text-white/80 text-xs font-bold">
                  <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl"><Users size={14} /> {members.length} membres</span>
                  <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl"><BookOpen size={14} /> {courses.length} cours</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-slate-100 overflow-x-auto bg-slate-50/50 backdrop-blur-sm scrollbar-hide">
          {[
            { id: 'accueil', label: 'Accueil', icon: BookOpen },
            { id: 'cours', label: 'Cours', icon: BookOpen },
            { id: 'revision-ia', label: 'Révision IA', icon: BrainCircuit },
            { id: 'evaluations', label: 'Évaluations', icon: Award },
            { id: 'badges', label: 'Badges', icon: Award },
            { id: 'membres', label: 'Membres', icon: Users },
            { id: 'forum', label: 'Forum', icon: MessageSquare }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-5 px-8 font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 transition-all whitespace-nowrap relative group ${activeTab === tab.id ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon size={18} className={activeTab === tab.id ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 min-h-[400px]">
        {activeTab === 'accueil' && (
          <div className="space-y-10">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-primary/20 p-10 sm:p-16 rounded-[40px] border border-slate-800 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-primary/20 blur-[100px] rounded-full"></div>
              <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-1 bg-primary rounded-full"></div>
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-primary">Tableau de bord</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">Bienvenue sur <span className="text-primary">{pannel.name}</span></h2>
                <p className="text-slate-300 font-medium text-lg max-w-2xl leading-relaxed">Découvrez les derniers cours, échangez avec les membres et suivez les discussions récentes de votre communauté d'apprentissage.</p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <button onClick={() => setActiveTab('cours')} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl">Explorer les cours</button>
                  <button onClick={() => setActiveTab('forum')} className="bg-slate-800/50 backdrop-blur-md text-white border border-slate-700 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all">Rejoindre le forum</button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Courses Summary */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-sm">
                      <BookOpen size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Cours récents</h3>
                  </div>
                  <button onClick={() => setActiveTab('cours')} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="space-y-4 flex-1">
                  {courses.slice(0, 3).map(c => (
                    <div key={c.id} className="group/item bg-slate-50 p-5 rounded-3xl border border-transparent hover:border-emerald-100 hover:bg-white hover:shadow-lg transition-all flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('cours')}>
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-500 shadow-sm group-hover/item:scale-110 transition-transform">
                        {c.type === 'video' ? <PlayCircle size={18} /> : <FileText size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 text-sm truncate group-hover/item:text-primary transition-colors">{c.title}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{c.type}</p>
                      </div>
                    </div>
                  ))}
                  {courses.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Aucun cours</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Members Summary */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center shadow-sm">
                      <Users size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Membres</h3>
                  </div>
                  <button onClick={() => setActiveTab('membres')} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="bg-slate-50 p-8 rounded-3xl flex flex-col items-center justify-center flex-1 group-hover:bg-white group-hover:shadow-lg transition-all border border-transparent group-hover:border-purple-100">
                  <div className="flex -space-x-4 mb-6">
                    {members.slice(0, 5).map(m => (
                      <div key={m.id} className="w-14 h-14 rounded-full bg-slate-200 border-4 border-white overflow-hidden shadow-xl transform hover:scale-110 hover:z-20 transition-all cursor-pointer">
                        {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={handleImageError} /> : <div className="w-full h-full flex items-center justify-center font-black text-lg text-slate-500 bg-slate-100">{m.name?.[0]?.toUpperCase()}</div>}
                      </div>
                    ))}
                    {members.length > 5 && (
                      <div className="w-14 h-14 rounded-full bg-purple-600 border-4 border-white flex items-center justify-center text-xs font-black text-white shadow-xl z-10 transform hover:scale-110 transition-all">
                        +{members.length - 5}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-500 text-center leading-relaxed">
                    <span className="text-purple-600 text-lg font-black block">{members.length}</span> passionnés ont rejoint l'aventure
                  </p>
                </div>
              </div>

              {/* Forum Summary */}
              <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-sm">
                      <MessageSquare size={24} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Forum</h3>
                  </div>
                  <button onClick={() => setActiveTab('forum')} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="space-y-4 flex-1">
                  {forumMessages.slice(0, 3).map(m => (
                    <div key={m.id} className="bg-slate-50 p-5 rounded-3xl border border-transparent hover:border-amber-100 hover:bg-white hover:shadow-lg transition-all flex items-start gap-4 cursor-pointer" onClick={() => setActiveTab('forum')}>
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm shrink-0">
                        <MessageCircle size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 line-clamp-2 leading-relaxed">{m.content}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{m.userName}</p>
                      </div>
                    </div>
                  ))}
                  {forumMessages.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Aucun message</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cours' && (
          <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Espace de formation</h2>
                  <p className="text-sm text-slate-500 font-medium">Consultez les ressources et suivez votre progression</p>
                </div>
                {isOwnerOrAdmin && (
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={() => setShowLinkCourseModal(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                      <LinkIcon size={18} /> Lier
                    </button>
                    <button onClick={() => setShowCreateCourse(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                      <Plus size={18} /> Nouveau
                    </button>
                  </div>
                )}
              </div>

            {showCreateCourse && (
              <motion.form 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleCreateCourse} 
                className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 space-y-6 shadow-inner"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Titre du cours</label>
                      <input required placeholder="Ex: Introduction au Marketing" className="w-full p-4 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newCourse.title} onChange={e => setNewCourse({...newCourse, title: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                      <textarea required rows={4} placeholder="De quoi parle ce cours ?" className="w-full p-4 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newCourse.description} onChange={e => setNewCourse({...newCourse, description: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Durée estimée</label>
                      <input required placeholder="Ex: 45 min" className="w-full p-4 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newCourse.duration} onChange={e => setNewCourse({...newCourse, duration: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Type de contenu</label>
                      <select className="w-full p-4 rounded-2xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer" value={newCourse.type} onChange={e => setNewCourse({...newCourse, type: e.target.value, url: '', file: null})}>
                        <option value="pdf">Document PDF</option>
                        <option value="video">Vidéo MP4</option>
                        <option value="text">Contenu Texte</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Fichier du cours ({newCourse.type === 'pdf' ? 'PDF' : 'MP4'})</label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept={newCourse.type === 'pdf' ? '.pdf' : 'video/mp4'}
                          onChange={handleFileUpload}
                          className="hidden" 
                          id="course-file-upload"
                        />
                        <label 
                          htmlFor="course-file-upload"
                          className={`w-full p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                            newCourse.url ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-primary/50'
                          }`}
                        >
                          {newCourse.url ? (
                            <>
                              <CheckCircle2 className="text-primary" size={24} />
                              <span className="text-xs font-bold text-primary">Fichier prêt</span>
                            </>
                          ) : (
                            <>
                              <Plus className="text-slate-400" size={24} />
                              <span className="text-xs font-bold text-slate-500">Cliquez pour uploader</span>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreateCourse(false)} className="px-8 py-3 text-slate-500 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Annuler</button>
                  <button 
                    type="submit" 
                    disabled={isPublishing}
                    className="px-8 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPublishing ? (
                      <>
                        <div className="relative flex items-center justify-center">
                          <RefreshCw size={18} className="animate-spin" />
                          <BookOpen size={10} className="absolute" />
                        </div>
                        Publication...
                      </>
                    ) : (
                      'Publier le cours'
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {courses.length === 0 ? (
                <div className="col-span-full text-center py-24 bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <BookOpen className="text-slate-300" size={40} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Aucun cours disponible</h4>
                  <p className="text-slate-500 font-medium">Revenez plus tard pour découvrir de nouveaux contenus.</p>
                </div>
              ) : (
                courses.map(course => (
                  <motion.div 
                    key={course.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -8 }}
                    className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 group flex flex-col h-full relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${course.type === 'video' ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500'}`}>
                          {course.type === 'video' ? <PlayCircle size={28} /> : <FileText size={28} />}
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1 block">{course.type}</span>
                          <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors line-clamp-1 text-lg">{course.title}</h4>
                        </div>
                      </div>
                      {isOwnerOrAdmin && (
                        <button 
                          onClick={() => setCourseToDelete(course.id)}
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all relative z-20"
                          title="Supprimer le cours"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 line-clamp-3 mb-8 flex-1 leading-relaxed font-medium">{course.description}</p>

                    <div className="space-y-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl">
                            <Clock size={14} className="text-primary" /> {course.duration || 'N/A'}
                          </span>
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl">
                            <Eye size={14} className="text-primary" /> {course.views || 0}
                          </span>
                        </div>
                        <select 
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            try {
                              await api.pannels.learnCourse(pannelId, course.id, { status: e.target.value });
                              toast.success('Statut mis à jour');
                              fetchData();
                            } catch (err) {
                              console.error(err);
                              toast.error('Erreur lors de la mise à jour du statut');
                            }
                          }}
                          value={course.progressStatus || 'non_commence'}
                          className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border-none outline-none cursor-pointer transition-colors ${
                            course.progressStatus === 'completed' ? 'text-emerald-600 bg-emerald-50' : 
                            course.progressStatus === 'en_cours' ? 'text-amber-600 bg-amber-50' : 
                            'text-slate-500 bg-slate-100'
                          }`}
                        >
                          <option value="non_commence">À faire</option>
                          <option value="en_cours">En cours</option>
                          <option value="completed">Terminé</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleLearnCourse(course)} 
                          className="flex-1 py-4 bg-slate-900 text-white rounded-[20px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-xl shadow-slate-200 hover:shadow-primary/30"
                        >
                          {course.type === 'video' ? <PlayCircle size={16} /> : <FileText size={16} />}
                          {course.type === 'video' ? 'Lire la vidéo' : 'Lire le document'}
                        </button>
                        <button 
                          onClick={() => handleOpenComments(course)}
                          className="p-4 bg-slate-50 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-[20px] transition-all relative group/comment shadow-sm"
                        >
                          <MessageSquare size={20} />
                          {course.commentsCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                              {course.commentsCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Courses Modal */}
        {showLinkCourseModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Cours associés</h2>
                  <p className="text-sm text-slate-500">Liste des cours de ce Pannel</p>
                </div>
                <button onClick={() => setShowLinkCourseModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                {courses.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Aucun cours associé.</p>
                ) : (
                  courses.map((course, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-slate-100 rounded-lg text-slate-500 shrink-0">
                          {course.type === 'video' ? <PlayCircle size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 truncate">{course.title}</h4>
                          <p className="text-xs text-slate-500 truncate">{course.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white rounded-b-3xl flex justify-end">
                <button onClick={() => setShowLinkCourseModal(false)} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Comments Modal */}
        {selectedCourseForComments && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Commentaires</h2>
                  <p className="text-sm text-slate-500">{selectedCourseForComments.title}</p>
                </div>
                <button onClick={() => setSelectedCourseForComments(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                {courseComments.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Soyez le premier à commenter ce cours !</p>
                ) : (
                  courseComments.map((comment, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                          {comment.userName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-bold text-sm text-slate-900">{comment.userName || 'Utilisateur'}</span>
                      </div>
                      <p className="text-slate-700 text-sm">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white rounded-b-3xl">
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Ajouter un commentaire..." 
                    className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20"
                  />
                  <button type="submit" disabled={!newComment.trim()} className="bg-primary text-white p-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50">
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revision-ia' && (
          <div className="flex flex-col h-[500px]">
            <div className="bg-slate-50 p-4 rounded-2xl mb-4 text-sm text-slate-600 flex items-start gap-3">
              <BrainCircuit className="text-primary shrink-0" />
              <p>Indiquez le titre du cours sur lequel vous souhaitez être testé. L'IA générera des questions aléatoires et vous attribuera une note finale.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-2xl mb-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  Dites "Je veux être testé sur le cours [Titre]" pour commencer.
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Écrivez votre message..." 
                className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20"
              />
              <button type="submit" className="bg-primary text-white p-3 rounded-xl hover:bg-primary-hover transition-colors">
                <Send size={20} />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'evaluations' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Évaluations</h2>
            <div className="bg-slate-50 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-4 font-bold">Utilisateur</th>
                    <th className="p-4 font-bold">Cours</th>
                    <th className="p-4 font-bold">Note</th>
                    <th className="p-4 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evaluations.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">Aucune évaluation pour le moment.</td></tr>
                  ) : (
                    evaluations.map((ev, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-4 font-medium">{ev.userName || 'Utilisateur'}</td>
                        <td className="p-4 text-slate-600">{ev.courseTitle}</td>
                        <td className="p-4 font-bold text-primary">{ev.score}/20</td>
                        <td className="p-4 text-slate-500">{new Date(ev.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Vos Badges</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['Apprenti', 'Expert', 'Major de promo', 'Incollable'].map(badgeName => {
                const hasBadge = badges.some(b => b.type === badgeName);
                return (
                  <div key={badgeName} className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${hasBadge ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 bg-slate-50 opacity-50 grayscale'}`}>
                    <Award size={40} className={hasBadge ? 'text-primary' : 'text-slate-400'} />
                    <span className="font-bold text-sm text-slate-900">{badgeName}</span>
                    {!hasBadge && <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Verrouillé</span>}
                  </div>
                );
              })}
            </div>

            {isOwnerOrAdmin && (
              <div className="mt-8 pt-8 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 mb-4">Tableau de bord de l'administrateur (Notes)</h3>
                <div className="bg-slate-50 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-4 font-bold">Utilisateur</th>
                        <th className="p-4 font-bold">Cours</th>
                        <th className="p-4 font-bold">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {evaluations.length === 0 ? (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-500">Aucune évaluation pour le moment.</td></tr>
                      ) : (
                        evaluations.map((ev, idx) => (
                          <tr key={idx} className="bg-white">
                            <td className="p-4 font-medium">{ev.userName || 'Utilisateur'}</td>
                            <td className="p-4 text-slate-600">{ev.courseTitle}</td>
                            <td className="p-4 font-bold text-primary">{ev.score}/20</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'membres' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Membres du Pannel</h2>
              {isOwnerOrAdmin && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleGenerateInviteLink}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    <LinkIcon size={16} /> Invitation
                  </button>
                  <select
                    onChange={async (e) => {
                      const userId = Number(e.target.value);
                      if (!userId) return;
                      try {
                        await api.pannels.addMemberByAdmin(pannelId, userId);
                        toast.success('Membre ajouté');
                        fetchData();
                      } catch (err) {
                        toast.error('Erreur lors de l\'ajout');
                      }
                    }}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    <option value="">Ajouter un membre</option>
                    {allAvailableUsers.filter(u => !members.find(m => m.id === u.id)).map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.length === 0 ? (
                <p className="text-slate-500 col-span-full text-center py-8">Aucun membre pour le moment.</p>
              ) : (
                members.map(member => (
                  <div key={member.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-sm transition-shadow relative group">
                    <div className="w-12 h-12 bg-slate-200 rounded-full overflow-hidden shrink-0">
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg">
                          {member.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{member.name}</h3>
                      <div className="flex items-center gap-1 mt-1">
                        {isOwnerOrAdmin && member.id !== currentUser?.id ? (
                          <select
                            value={member.role || 'member'}
                            onChange={async (e) => {
                              try {
                                await api.pannels.updateMemberRole(pannelId, member.id, e.target.value);
                                toast.success('Rôle mis à jour');
                                fetchData();
                              } catch (err) {
                                toast.error('Erreur de mise à jour');
                              }
                            }}
                            className="text-[10px] font-bold bg-slate-100 rounded-full px-2 py-0.5 border-none outline-none"
                          >
                            <option value="member">Membre</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold capitalize">
                            <Award size={10} /> {member.role || 'member'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button 
                        onClick={() => window.location.href = `/profile/${member.id}`}
                        className="p-2 bg-slate-100 text-slate-600 rounded-full transition-colors hover:bg-slate-200"
                        title="Voir le profil"
                      >
                        <Eye size={16} />
                      </button>
                      {isOwnerOrAdmin && member.id !== currentUser?.id && (
                        <button 
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 bg-red-50 text-red-500 rounded-full transition-colors hover:bg-red-100"
                          title="Retirer le membre"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'forum' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Forum de discussion</h2>
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {forumMessages.length} messages
              </div>
            </div>

            {/* New Message Form */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <form onSubmit={handleSendForumMessage} className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                      {currentUser?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 relative">
                  <textarea
                    value={newForumMessage || ''}
                    onChange={(e) => setNewForumMessage(e.target.value)}
                    placeholder="Posez une question ou partagez une réflexion..."
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none text-sm min-h-[80px]"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <button type="button" className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="Joindre un fichier ou une ressource">
                      <Paperclip size={20} />
                    </button>
                    <button
                      type="submit"
                      disabled={!newForumMessage.trim() || isSubmittingForum}
                      className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmittingForum ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      Envoyer
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Messages List */}
            <div className="space-y-4">
              {loadingForum && showLoader ? (
                <LoadingSpinner />
              ) : forumMessages.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <MessageCircle size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Aucun message pour le moment. Soyez le premier à lancer la discussion !</p>
                </div>
              ) : (
                <>
                  {forumMessages.slice(0, visibleMessagesCount).map((msg, idx) => (
                    <motion.div 
                      key={msg.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                          {msg.userAvatar ? (
                            <img src={msg.userAvatar} alt={msg.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                              {msg.userName?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{msg.userName}</h4>
                          <p className="text-[10px] text-slate-400">{formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: fr })}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </motion.div>
                  ))}
                  {visibleMessagesCount < forumMessages.length && (
                    <div className="flex justify-center mt-4">
                      <button 
                        onClick={() => setVisibleMessagesCount(prev => prev + 10)}
                        className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover transition-colors"
                      >
                        Charger plus de messages
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {isPublishing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center"
            >
              <div className="relative">
                <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <BookOpen className="text-primary" size={24} />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-black text-slate-900">Publication du cours en cours...</h3>
              <p className="text-slate-500 font-medium">Veuillez patienter pendant que nous préparons votre contenu.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
