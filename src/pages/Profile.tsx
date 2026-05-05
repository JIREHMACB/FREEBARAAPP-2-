import { useUser } from '../App';
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getAI } from '../lib/gemini';
import { GoogleGenAI } from "@google/genai";
import PostCard from '../components/PostCard';
import { 
  Settings, Share2, Award, Edit3, LogOut, Camera, 
  RefreshCw, Calendar as CalendarIcon, Briefcase, Users, MapPin, 
  X, Check, Save, RotateCcw, ZoomIn, ZoomOut,
  User as UserIcon, Heart, Target, Sparkles, ShoppingBag,
  MessageCircle, Building2, Mail,
  Phone, ChevronRight, Info, Layout, Image as ImageIcon, Bell,
  Trash2, ChevronDown, Send, Lightbulb, Compass, MoreHorizontal, AlertTriangle,
  ChevronLeft, CheckCircle2, Clock, ShieldCheck, Database, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Cropper from 'react-easy-crop';
import MentionPicker from '../components/MentionPicker';
import getCroppedImg from '../lib/cropImage';
import { toast } from 'react-hot-toast';
import Lightbox from '../components/Lightbox';
import { motion, AnimatePresence } from 'framer-motion';

// Progressive Loading Component
const ProgressiveSection = ({ children }: { children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  return (
    <div ref={ref}>
      <AnimatePresence>
        {isVisible ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        ) : (
          <div className="h-40 bg-slate-50/50 rounded-[40px] animate-pulse border border-slate-100" />
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Profile() {
  const { userId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'opportunities' | 'network' | 'posts'>('posts');
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [myServices, setMyServices] = useState<{created: any[], applied: any[]}>({created: [], applied: []});
  const [myNetwork, setMyNetwork] = useState<{following: any[], requests: any[]}>({following: [], requests: []});
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [favoriteCompanies, setFavoriteCompanies] = useState<any[]>([]);
  const [userCompany, setUserCompany] = useState<any>(null);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const navigate = useNavigate();

  // Cropper state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'avatar' | 'cover'>('avatar');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [showCropper, setShowCropper] = useState(false);

  // Form state for modal
  const [formData, setFormData] = useState<any>({});
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({ name: '', organization: '', dateObtained: '' });
  
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isInterestsOpen, setIsInterestsOpen] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isConnected, setIsConnected] = useState(false);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    
    setIsSendingMessage(true);
    try {
      await api.messages.send(user.id, messageContent);
      toast.success('Message envoyé !');
      setMessageContent('');
      setIsMessageModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const [editStep, setEditStep] = useState(1);
  const [isGeneratingSkills, setIsGeneratingSkills] = useState(false);
  const [isGeneratingVision, setIsGeneratingVision] = useState(false);
  const [courseSuggestions, setCourseSuggestions] = useState<any[]>([]);
  const [isGeneratingCourseSuggestions, setIsGeneratingCourseSuggestions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'legal' | 'privacy' | 'cookies' | 'terms' | 'account'>('legal');

  const handleDeleteAccount = async () => {
    try {
      await api.users.deleteAccount();
      localStorage.removeItem('jce_token');
      navigate('/login');
      toast.success('Votre compte a été supprimé définitivement.');
    } catch (error) {
      toast.error('Erreur lors de la suppression du compte.');
    }
  };

  // Lightbox and Reactions states for posts
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState<{url: string, type: string}[]>([]);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [postReactions, setPostReactions] = useState<any[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);

  const openLightbox = (media: any[], index: number) => {
    setLightboxMedia(media);
    setLightboxIndex(index);
    setLightboxOpen(true);
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

  // Post creation state
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postMediaFiles, setPostMediaFiles] = useState<{url: string, type: string}[]>([]);
  const [showPostConfirmModal, setShowPostConfirmModal] = useState(false);
  const postFileInputRef = useRef<HTMLInputElement>(null);

  // Mentions states
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  const CATEGORIES = [
    { id: 'Programme', label: 'Programme', icon: CalendarIcon },
    { id: 'Opportunité', label: 'Opportunité', icon: Sparkles },
    { id: 'Astuce', label: 'Astuce', icon: Lightbulb },
    { id: 'Emploi', label: 'Emploi', icon: Briefcase },
    { id: 'Alertes', label: 'Alertes', icon: Bell },
    { id: 'Motivation', label: 'Motivation', icon: Heart },
    { id: 'Découverte', label: 'Découverte', icon: Compass },
    { id: 'Autre', label: 'Autre', icon: MoreHorizontal },
  ];

  const handlePostFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      if (postMediaFiles.length + files.length > 4) {
        toast.error('Vous ne pouvez ajouter que 4 médias maximum.');
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (file.type.startsWith('image/')) {
            setPostMediaFiles(prev => [...prev, { url: result, type: 'image' }]);
          } else if (file.type.startsWith('video/')) {
            setPostMediaFiles(prev => [...prev, { url: result, type: 'video' }]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (postFileInputRef.current) postFileInputRef.current.value = '';
  };

  const removePostMedia = (index: number) => {
    setPostMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && postMediaFiles.length === 0) {
      toast.error('Veuillez ajouter du texte ou un média à votre publication');
      return;
    }
    setShowPostConfirmModal(true);
  };

  const mentionSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMentionSearch = async (query: string) => {
    if (mentionSearchTimeout.current) {
      clearTimeout(mentionSearchTimeout.current);
    }

    if (!query || query.length < 1) {
      setMentionResults([]);
      setShowMentionPicker(false);
      return;
    }

    mentionSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.users.search(query);
        setMentionResults(results);
        setShowMentionPicker(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  const insertMention = (user: any) => {
    const mentionString = `@[${user.name}](${user.id}) `;
    const parts = postContent.split('@');
    parts.pop();
    setPostContent(parts.join('@') + mentionString);
    setShowMentionPicker(false);
    setMentionResults([]);
  };

  const confirmPostSubmit = async () => {
    setShowPostConfirmModal(false);
    try {
      const newPost = await api.posts.create({ 
        content: postContent, 
        category: postCategory || 'Tous',
        mediaUrls: postMediaFiles 
      });
      
      // Refresh user posts
      const updatedPosts = await api.posts.getAll(1, 50, 'Tous', 'Tous', user.id);
      setUserPosts(updatedPosts);
      
      setPostContent('');
      setPostCategory('');
      setPostMediaFiles([]);
      toast.success('Publication partagée !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la publication');
    }
  };

  const handleNextStep = () => {
    if (editStep === 1) {
      if (!formData.name || !formData.age || !formData.maritalStatus || !formData.profession || !formData.country) {
        toast.error('Veuillez remplir tous les champs obligatoires (Nom, Âge, Statut, Profession, Pays) pour continuer.');
        return;
      }
    }
    setEditStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setEditStep(prev => prev - 1);
  };

  const generateAISuggestion = async (type: 'skills' | 'vision') => {
    if (!formData.profession || !formData.country || !formData.age) {
      toast.error('Profession, Pays et Âge sont requis pour les suggestions IA.');
      return;
    }
    
    if (type === 'skills') setIsGeneratingSkills(true);
    else setIsGeneratingVision(true);
    
    try {
      const ai = getAI();
      const prompt = type === 'skills' 
        ? `En tant qu'expert JCE, suggère 5 compétences clés pour un ${formData.profession} de ${formData.age} ans au ${formData.country}. Réponds uniquement avec la liste des compétences séparées par des virgules.`
        : `En tant qu'expert JCE, suggère une vision inspirante pour un ${formData.profession} de ${formData.age} ans au ${formData.country}. Réponds uniquement avec la vision.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const suggestion = response.text;
      if (suggestion) {
        if (type === 'skills') {
          setFormData({ ...formData, skills: suggestion });
        } else {
          setFormData({ ...formData, goals: suggestion });
        }
        toast.success('Suggestion générée avec succès !', { icon: '✨' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération de la suggestion.');
    } finally {
      if (type === 'skills') setIsGeneratingSkills(false);
      else setIsGeneratingVision(false);
    }
  };

  const generateCourseSuggestions = async () => {
    if (!user?.interests) {
      toast.error('Centres d\'intérêt requis pour les suggestions.');
      return;
    }
    
    setIsGeneratingCourseSuggestions(true);
    try {
      const courses = await api.courses.getAll();
      const ai = getAI();
      const prompt = `En tant qu'assistant d'apprentissage, suggère les 3 meilleurs cours parmi la liste suivante basés sur les centres d'intérêt de l'utilisateur.
      
      Centres d'intérêt de l'utilisateur : ${user.interests}
      
      Liste des cours disponibles :
      ${courses.map((c: any) => `- ID: ${c.id}, Titre: ${c.title}, Description: ${c.description}`).join('\n')}
      
      Réponds UNIQUEMENT avec un tableau JSON contenant les IDs des cours suggérés.
      Exemple: [1, 5, 12]`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const suggestedIds = JSON.parse(response.text || '[]');
      const suggestedCourses = courses.filter((c: any) => suggestedIds.includes(c.id));
      setCourseSuggestions(suggestedCourses);
      toast.success('Suggestions générées !', { icon: '✨' });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération des suggestions.');
    } finally {
      setIsGeneratingCourseSuggestions(false);
    }
  };

  useEffect(() => {
    const fetchUserAndData = async () => {
      setLoading(true);
      try {
        const me = await api.users.me();
        setCurrentUser(me);
        
        const targetUserId = userId ? parseInt(userId) : me.id;
        const userData = userId ? await api.users.getById(targetUserId) : me;
        
        setUser(userData);
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
          age: userData.age || '',
          maritalStatus: userData.maritalStatus || '',
          whatsapp: userData.whatsapp || '',
          profession: userData.profession || '',
          country: userData.country || '',
          company: userData.company || '',
          companyId: userData.companyId || null,
          skills: userData.skills || '',
          marketing: userData.marketing || '',
          goals: userData.goals || '',
          avatarUrl: userData.avatarUrl || '',
          notificationPreferences: userData.notificationPreferences || {},
          visibility: userData.visibility || 'public',
          externalPortfolioUrl: userData.externalPortfolioUrl || ''
        });
        
        // Fetch data for the profile
        const [eventsData, servicesData, networkData, certsData, favCompaniesData, allCompaniesData, postsData] = await Promise.all([
          api.users.getEvents(targetUserId),
          api.users.getServices(),
          api.users.getFollowing(),
          api.users.getCertifications(),
          api.users.getFavoriteCompanies(),
          api.companies.getAll(),
          api.posts.getAll(1, 50, 'Tous', 'Tous', targetUserId)
        ]);
        
        let networkRequestsData = [];
        try {
          networkRequestsData = await api.users.getNetworkRequests();
        } catch (err) {
          console.warn('Failed to fetch network requests:', err);
        }
        
        setAllCompanies(allCompaniesData);
        const myCompany = allCompaniesData.find((c: any) => c.ownerId === targetUserId);
        setUserCompany(myCompany);
        
        // Fetch applications for each created service
        const servicesWithApplications = await Promise.all(
          (servicesData.created || []).map(async (service: any) => {
            try {
              const applications = await api.services.getApplications(service.id);
              return { ...service, applications };
            } catch (err) {
              console.error(`Error fetching applications for service ${service.id}:`, err);
              return { ...service, applications: [] };
            }
          })
        );
        
        setMyEvents(eventsData);
        setMyServices({ ...servicesData, created: servicesWithApplications });
        setMyNetwork({ following: networkData, requests: networkRequestsData });
        setIsConnected(networkData.some((n: any) => n.id === targetUserId));
        setCertifications(certsData);
        setFavoriteCompanies(favCompaniesData);
        setUserPosts(postsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndData();
  }, [userId]);

  const handleAddCert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newCert = await api.users.addCertification(certForm);
      setCertifications(prev => [newCert, ...prev]);
      setShowCertModal(false);
      setCertForm({ name: '', organization: '', dateObtained: '' });
      toast.success('Certification ajoutée');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleDeleteCert = async (id: number) => {
    if (!confirm('Supprimer cette certification ?')) return;
    try {
      await api.users.deleteCertification(id);
      setCertifications(prev => prev.filter(c => c.id !== id));
      toast.success('Certification supprimée');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const isOwnProfile = !userId || (currentUser && parseInt(userId) === currentUser.id);

  const openEditModal = () => {
    setEditStep(1);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;

    if (!formData.name || formData.name.trim().length < 3) {
      toast.error('Le nom d\'utilisateur doit contenir au moins 3 caractères.');
      return;
    }
    if (!emailRegex.test(formData.email)) {
      toast.error('Veuillez entrer une adresse email valide.');
      return;
    }
    if (formData.age && (formData.age < 18 || formData.age > 120)) {
      toast.error('Veuillez entrer un âge valide (entre 18 et 120 ans).');
      return;
    }
    if (formData.whatsapp && !phoneRegex.test(formData.whatsapp.replace(/\s/g, ''))) {
      toast.error('Veuillez entrer un numéro WhatsApp valide (ex: +2250102030405).');
      return;
    }

    setIsSaving(true);
    try {
      let companyId = formData.companyId;
      if (formData.company && !companyId) {
        // Check if it exists in allCompanies
        const existing = allCompanies.find(c => c.name.toLowerCase() === formData.company.toLowerCase());
        if (existing) {
          companyId = existing.id;
        } else {
          // Create new company
          const newCompany = await api.companies.create({ name: formData.company });
          companyId = newCompany.id;
        }
      }
      
      await api.users.updateProfile({...formData, companyId});
      setUser({ ...user, ...formData, companyId });
      setIsEditModalOpen(false);
      toast.success('Profil mis à jour avec succès !', {
        icon: '✅',
        style: { borderRadius: '12px', background: '#1e293b', color: '#fff' },
      });
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la mise à jour du profil.';
      toast.error(`Erreur : ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    try {
      let updatedFormData;
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        updatedFormData = {
          ...formData,
          [parent]: {
            ...(formData[parent] || { connections: true, comments: true, events: true, offers: true, messages: true }),
            [child]: value
          }
        };
      } else {
        updatedFormData = {
          ...formData,
          [key]: value
        };
      }
      
      setFormData(updatedFormData);
      await api.users.updateProfile(updatedFormData);
      setUser({ ...user, ...updatedFormData });
      toast.success('Paramètres synchronisés', { 
        icon: '⚙️',
        style: { borderRadius: '12px', background: '#1e293b', color: '#fff' }
      });
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la synchronisation');
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/login?ref=${user?.referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Lien de parrainage copié !', {
      icon: '🔗',
      style: { borderRadius: '12px', background: '#1e293b', color: '#fff' },
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const generateAvatar = async () => {
    const seed = Math.random().toString(36).substring(7);
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    setFormData({ ...formData, avatarUrl: url });
    toast.success('Avatar généré !', { icon: '✨' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImage(reader.result as string);
      setCropType(type);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    try {
      if (!cropImage || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(cropImage, croppedAreaPixels, rotation);
      if (cropType === 'avatar') {
        setFormData({ ...formData, avatarUrl: croppedImage });
      } else {
        setFormData({ ...formData, coverUrl: croppedImage });
      }
      setShowCropper(false);
      setCropImage(null);
      toast.success(`${cropType === 'avatar' ? 'Photo de profil' : 'Photo de couverture'} mise à jour !`, { icon: '📸' });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium">Chargement de votre univers...</p>
    </div>
  );

  if (!user) return <div className="text-center py-20 text-slate-500">Erreur de chargement du profil</div>;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-20 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="relative bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden transition-all duration-700">
        
        {/* Profile Info */}
        <div className="px-6 sm:px-10 lg:px-16 py-10 z-20">
          <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-8">
            <div className="flex flex-col lg:flex-row items-center lg:items-end gap-6 w-full lg:w-auto">
              {/* Avatar */}
              <div className="relative group shrink-0">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  className="w-32 h-32 sm:w-40 sm:h-40 md:w-52 md:h-52 rounded-[40px] sm:rounded-[56px] border-[6px] border-white bg-slate-50 overflow-hidden shadow-2xl relative"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user?.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl sm:text-6xl font-black bg-white">
                      {user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </motion.div>
                {isOwnProfile && (
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={openEditModal}
                    className="absolute bottom-2 right-2 p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-hover transition-all z-30 border-[3px] border-white"
                  >
                    <Camera size={18} />
                  </motion.button>
                )}
              </div>

              {/* User Details */}
              <div className="text-center lg:text-left space-y-3 flex-1 min-w-0 pb-2">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-3xl font-black text-slate-900 tracking-tighter leading-tight">{user?.name}</h1>
                    {user?.church && (
                      <div className="p-1 bg-blue-500 text-white rounded-full shadow-lg shadow-blue-200" title="Vérifié">
                        <CheckCircle2 size={16} />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                    <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-lg shadow-slate-200">
                      <Award size={10} className="text-amber-400" />
                      {user?.badge}
                    </div>
                    {user?.badges && user.badges.map((b: string) => (
                      <div key={b} className="px-3 py-1 bg-white text-slate-600 border border-slate-100 rounded-full text-[8px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 shadow-sm">
                        <Sparkles size={10} className="text-purple-500" />
                        {b}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <p className="text-lg sm:text-xl text-slate-600 font-semibold tracking-tight">
                    {user?.profession || 'Profession non renseignée'}
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-y-1.5 gap-x-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {user?.company && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Building2 size={12} className="text-blue-500" /> 
                        {user.companyId ? (
                          <button onClick={() => navigate(`/business`, { state: { selectedCompanyId: user.companyId } })} className="hover:underline text-blue-500">
                            {user.company}
                          </button>
                        ) : (
                          <span>{user.company}</span>
                        )}
                        {user?.role && <span className="text-slate-400 font-normal">({user.role})</span>}
                      </span>
                    )}
                    {user?.country && (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <MapPin size={12} className="text-rose-500" /> 
                        {user.country}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon size={12} className="text-orange-500" /> 
                      Depuis {user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy', { locale: fr }) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isOwnProfile ? (
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto pb-2">
                <div className="flex items-center gap-2">
                  {userCompany && userCompany.isShop === 1 && (
                    <motion.button 
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate('/business', { state: { openDashboard: true, companyId: userCompany.id } })}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-[18px] font-black shadow-xl shadow-slate-200 hover:bg-black transition-all text-[9px] uppercase tracking-[0.2em]"
                    >
                      <ShoppingBag size={16} />
                      Boutique
                    </motion.button>
                  )}
                  
                  <div className="flex gap-2">
                    <motion.button 
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => navigate('/favorites')}
                      className="flex items-center p-3.5 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-[18px] transition-all border border-slate-100"
                    >
                      <Heart size={18} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={copyReferralLink}
                      className="flex items-center p-3.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-[18px] transition-all border border-slate-100"
                    >
                      <Share2 size={18} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowSettings(true)}
                      className="flex items-center p-3.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-[18px] transition-all border border-slate-100"
                    >
                      <Settings size={18} />
                    </motion.button>
                    <motion.button 
                      whileHover={{ rotate: 15, scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={openEditModal}
                      className="flex items-center p-3.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-[18px] transition-all border border-slate-100"
                    >
                      <Edit3 size={18} />
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 w-full lg:w-auto pb-2">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      try {
                        await api.users.connect(user.id);
                        setIsConnected(true);
                        toast.success('Suivi !');
                      } catch (err) {
                        toast.error('Erreur lors du suivi');
                      }
                    }}
                    className={`flex items-center gap-2 px-6 py-3 rounded-[18px] font-black shadow-xl transition-all text-[9px] uppercase tracking-[0.2em] ${isConnected ? 'bg-slate-100 text-slate-600' : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'}`}
                  >
                    {isConnected ? <Check size={16} /> : <Users size={16} />}
                    {isConnected ? 'Abonné' : 'Suivre'}
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ rotate: 15, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(`/messages/${user.id}`)}
                    className="flex items-center p-3.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-[18px] transition-all border border-slate-100"
                  >
                    <Send size={18} />
                  </motion.button>
                </div>
              </div>
            )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Sidebar Info */}
          <div className="space-y-8">
          {/* About Card */}
          <ProgressiveSection>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6 relative overflow-hidden group"
            >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
            <button 
              onClick={() => setIsAboutOpen(!isAboutOpen)}                
              className="w-full flex items-center justify-between text-xl font-black text-slate-900 group relative z-10"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Info size={22} />
                </div>
                À propos
              </div>
              <ChevronRight className="sm:hidden text-slate-400 group-hover:text-primary transition-transform" />
            </button>
            
            <div className={`${isAboutOpen ? 'block' : 'hidden'} sm:block space-y-6 relative z-10`}>
              {user.marketing && (
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 italic text-slate-700 font-medium leading-relaxed relative">
                  <span className="absolute -top-2 -left-1 text-4xl text-primary/20 font-serif">"</span>
                  {user.marketing}
                  <span className="absolute -bottom-6 -right-1 text-4xl text-primary/20 font-serif">"</span>
                </div>
              )}
              
              <div className="space-y-4">
                {[
                  { icon: Mail, label: 'Email', value: user.email, color: 'text-blue-500', bg: 'bg-blue-50' },
                  { icon: Phone, label: 'WhatsApp', value: user.whatsapp, color: 'text-emerald-500', bg: 'bg-emerald-50', condition: user.whatsapp },
                  { icon: Heart, label: 'Statut', value: user.maritalStatus || 'Non spécifié', color: 'text-rose-500', bg: 'bg-rose-50' }
                ].map((item, idx) => item.condition !== false && (
                  <div key={idx} className="flex items-center gap-4 group/item">
                    <div className={`w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} transition-transform group-hover/item:scale-110`}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{item.label}</div>
                      <div className="font-bold text-slate-700 break-all">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          </ProgressiveSection>

          {/* Skills & Interests */}
          <ProgressiveSection>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-8"
            >
            <div className="space-y-4">
              <button 
                onClick={() => setIsSkillsOpen(!isSkillsOpen)}
                className="w-full flex items-center justify-between text-lg font-black text-slate-900 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
                    <Sparkles size={20} />
                  </div>
                  Compétences
                </div>
                <ChevronRight className="sm:hidden text-slate-400 group-hover:text-primary transition-transform" />
              </button>
              <div className={`${isSkillsOpen ? 'block' : 'hidden'} sm:block flex flex-wrap gap-2`}>
                {user.skills ? (Array.isArray(user.skills) ? user.skills : user.skills.split(',')).map((skill: string, i: number) => (
                  <motion.span 
                    key={i} 
                    whileHover={{ scale: 1.05 }}
                    className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-default"
                  >
                    {typeof skill === 'string' ? skill.trim() : skill}
                  </motion.span>
                )) : <p className="text-xs text-slate-400 italic">Aucune compétence renseignée</p>}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-50">
              <button 
                onClick={() => setIsInterestsOpen(!isInterestsOpen)}
                className="w-full flex items-center justify-between text-lg font-black text-slate-900 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-50 rounded-xl text-rose-500">
                    <Heart size={20} />
                  </div>
                  Centres d'intérêt
                </div>
                <ChevronRight className="sm:hidden text-slate-400 group-hover:text-primary transition-transform" />
              </button>
              <div className={`${isInterestsOpen ? 'block' : 'hidden'} sm:block flex flex-wrap gap-2`}>
                {user.interests ? (Array.isArray(user.interests) ? user.interests : user.interests.split(',')).map((interest: string, i: number) => (
                  <motion.span 
                    key={i} 
                    whileHover={{ scale: 1.05 }}
                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 hover:bg-white hover:shadow-md transition-all cursor-default"
                  >
                    {typeof interest === 'string' ? interest.trim() : interest}
                  </motion.span>
                )) : <p className="text-xs text-slate-400 italic">Aucun intérêt renseigné</p>}
              </div>
            </div>
          </motion.div>
          </ProgressiveSection>
        </div>

        {/* Right Column: Dynamic Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Navigation Tabs */}
          <div className="bg-white p-3 rounded-[32px] shadow-sm border border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide sticky top-4 z-40 backdrop-blur-md bg-white/80">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: Layout, color: 'text-blue-500' },
              { id: 'posts', label: isOwnProfile ? 'Mes Posts' : 'Publications', icon: MessageCircle, color: 'text-purple-500' },
              { id: 'events', label: isOwnProfile ? 'Mes Événements' : 'Événements', icon: CalendarIcon, color: 'text-orange-500' },
              { id: 'opportunities', label: isOwnProfile ? 'Opportunités' : 'Services', icon: Briefcase, color: 'text-emerald-500' },
              { id: 'network', label: isOwnProfile ? 'Mon Réseau' : 'Réseau', icon: Users, color: 'text-indigo-500' }
            ].map(tab => (
              <motion.button
                key={tab.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : tab.color} />
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Goals Section */}
                  <ProgressiveSection>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 space-y-8 relative overflow-hidden group"
                    >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-1000"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                          <Target size={26} />
                        </div>
                        Vision & Objectifs
                      </h3>
                      {isOwnProfile && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={generateCourseSuggestions}
                          disabled={isGeneratingCourseSuggestions}
                          className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50"
                        >
                          {isGeneratingCourseSuggestions ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} className="text-amber-400" />
                          )}
                          {isGeneratingCourseSuggestions ? 'Analyse...' : 'Suggérer des cours'}
                        </motion.button>
                      )}
                    </div>

                    <div className="relative z-10">
                      <p className="text-lg text-slate-600 leading-relaxed font-medium">
                        {user.goals || "Partagez votre vision et vos objectifs avec la communauté pour inspirer et être inspiré."}
                      </p>
                    </div>
                    
                    <AnimatePresence>
                      {courseSuggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-8 border-t border-slate-50 space-y-6 relative z-10"
                        >
                          <div className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest">
                            <Lightbulb size={16} className="text-amber-500" />
                            Recommandations IA
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {courseSuggestions.map((course: any, idx: number) => (
                              <motion.div 
                                key={course.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group/course cursor-pointer"
                              >
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover/course:bg-primary group-hover/course:text-white transition-colors">
                                  <Briefcase size={18} />
                                </div>
                                <h5 className="font-black text-slate-900 text-sm mb-2 group-hover/course:text-primary transition-colors">{course.title}</h5>
                                <p className="text-xs text-slate-500 line-clamp-2 font-medium leading-relaxed">{course.description}</p>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  </ProgressiveSection>

                  {/* Referral Program Section */}
                  {isOwnProfile && (
                    <ProgressiveSection>
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-amber-50 to-orange-50 p-10 rounded-[48px] shadow-sm border border-amber-100/50 space-y-8 relative overflow-hidden"
                      >
                      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full"></div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 mb-2">
                            <div className="p-3 bg-amber-500/20 text-amber-600 rounded-2xl">
                              <Share2 size={26} />
                            </div>
                            Programme de Parrainage
                          </h3>
                          <p className="text-slate-600 font-medium max-w-xl">Invitez vos amis à rejoindre JCE Connect et gagnez des badges exclusifs ainsi que de la visibilité dans le réseau.</p>
                        </div>
                        <div className="flex flex-col items-center sm:items-end gap-2 bg-white/80 backdrop-blur-sm p-4 rounded-3xl border border-amber-100/50">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Votre code</span>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-amber-600 tracking-widest">{user?.referralCode || 'GÉNÉRATION...'}</span>
                            <button 
                              onClick={copyReferralLink}
                              className="p-2 bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white rounded-xl transition-colors"
                              title="Copier le lien d'invitation"
                            >
                              <Share2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-amber-100/50 flex flex-col items-center text-center">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 font-black text-xl">1</div>
                          <h4 className="font-bold text-slate-900 mb-2">Partagez votre code</h4>
                          <p className="text-xs font-medium text-slate-500">Envoyez votre lien d'invitation à vos connaissances.</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-amber-100/50 flex flex-col items-center text-center">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 font-black text-xl">2</div>
                          <h4 className="font-bold text-slate-900 mb-2">Ils s'inscrivent</h4>
                          <p className="text-xs font-medium text-slate-500">Vos amis créent leur compte avec votre code.</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-amber-100/50 flex flex-col items-center text-center">
                          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4 font-black text-xl">3</div>
                          <h4 className="font-bold text-slate-900 mb-2">Gagnez des récompenses</h4>
                          <p className="text-xs font-medium text-slate-500">Obtenez des badges et mettez en avant votre profil.</p>
                        </div>
                      </div>
                    </motion.div>
                    </ProgressiveSection>
                  )}

                  {/* Participating Events Section */}
                  <ProgressiveSection>
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100 space-y-8"
                    >
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="p-3 bg-orange-50 rounded-2xl text-orange-500">
                          <CalendarIcon size={26} />
                        </div>
                        {isOwnProfile ? 'Mes Participations' : `Activités`}
                      </h3>
                      {myEvents.length > 0 && (
                        <button 
                          onClick={() => setActiveTab('events')}
                          className="text-xs font-black text-primary uppercase tracking-widest hover:underline"
                        >
                          Tout voir
                        </button>
                      )}
                    </div>

                    {myEvents.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                        <CalendarIcon size={40} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-400 font-bold">Aucune participation active</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {myEvents.slice(0, 4).map((event, idx) => (
                          <motion.div 
                            key={event.id}
                            whileHover={{ y: -5 }}
                            className="flex items-center gap-5 p-5 bg-slate-50 rounded-[32px] border border-slate-100 hover:bg-white hover:shadow-xl transition-all cursor-pointer group/event" 
                            onClick={() => navigate(`/events/${event.id}`)}
                          >
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-200 flex-shrink-0 shadow-sm group-hover/event:shadow-md transition-shadow">
                              {event.imageUrl ? (
                                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <CalendarIcon size={24} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 text-base truncate group-hover/event:text-primary transition-colors">{event.title}</h4>
                              <div className="flex items-center gap-2 mt-2 text-slate-500 font-bold text-xs">
                                <Clock size={14} className="text-orange-500" />
                                {format(new Date(event.startDate), 'd MMM yyyy', { locale: fr })}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                  </ProgressiveSection>

                  {/* Certifications */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Award size={22} className="text-primary" /> Mes certifications
                      </h3>
                      {isOwnProfile && (
                        <button 
                          onClick={() => setShowCertModal(true)}
                          className="text-sm font-bold text-primary hover:text-primary-hover"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                    {certifications.length === 0 ? (
                      <p className="text-slate-500 italic">Aucune certification ajoutée.</p>
                    ) : (
                      <div className="space-y-4">
                        {certifications.map(cert => (
                          <div key={cert.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                            <div>
                              <h4 className="font-bold text-slate-900">{cert.name}</h4>
                              <p className="text-sm text-slate-500">{cert.organization} • {cert.dateObtained}</p>
                            </div>
                            {isOwnProfile && (
                              <button onClick={() => handleDeleteCert(cert.id)} className="text-red-500 hover:text-red-700">
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Favorite Companies */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Heart size={22} className="text-rose-500" /> Entreprises favorites
                      </h3>
                      {favoriteCompanies.length > 0 && (
                        <button 
                          onClick={() => navigate('/favorites')}
                          className="text-sm font-bold text-primary hover:underline"
                        >
                          Voir tout
                        </button>
                      )}
                    </div>
                    {favoriteCompanies.length === 0 ? (
                      <p className="text-slate-500 italic">Aucune entreprise favorite.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {favoriteCompanies.map(company => (
                          <div key={company.id} className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{company.name}</h4>
                              <p className="text-xs text-slate-500">{company.sector}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'posts' && (
                <motion.div
                  key="posts"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Create Post UI (Only for own profile) */}
                  {isOwnProfile && (
                    <div className="bg-white p-4 sm:p-6 rounded-[30px] shadow-sm border border-slate-100 mb-8">
                      <form onSubmit={handlePostSubmit}>
                        <div className="flex gap-3 sm:gap-4 mb-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                            {currentUser?.avatarUrl ? (
                              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                {currentUser?.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 relative">
                            <textarea
                              value={postContent}
                              onChange={(e) => {
                                setPostContent(e.target.value);
                                const lastAt = e.target.value.lastIndexOf('@');
                                if (lastAt !== -1 && lastAt >= e.target.value.length - 20) {
                                  handleMentionSearch(e.target.value.substring(lastAt + 1));
                                } else {
                                  setShowMentionPicker(false);
                                }
                              }}
                              placeholder="Partagez quelque chose avec la communauté..."
                              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none text-sm"
                              rows={2}
                            />
                            {showMentionPicker && (
                              <MentionPicker 
                                results={mentionResults} 
                                onSelect={insertMention} 
                                className="top-full left-0 mt-2"
                              />
                            )}
                          </div>
                        </div>

                        {/* Media Preview */}
                        {postMediaFiles.length > 0 && (
                          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 pl-14">
                            {postMediaFiles.map((media, idx) => (
                              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-50">
                                {media.type === 'image' ? (
                                  <img src={media.url} alt="Preview" className="w-full h-full object-contain" />
                                ) : (
                                  <video src={media.url} className="w-full h-full object-contain" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => removePostMedia(idx)}
                                  className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:pl-14">
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                            <button 
                              type="button" 
                              onClick={() => postFileInputRef.current?.click()}
                              disabled={postMediaFiles.length >= 4}
                              className="flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                            >
                              <ImageIcon size={16} />
                              <span>Médias ({postMediaFiles.length}/4)</span>
                            </button>
                            <input 
                              type="file" 
                              ref={postFileInputRef} 
                              onChange={handlePostFileSelect} 
                              accept="image/jpeg, image/png, video/mp4, video/quicktime" 
                              multiple 
                              className="hidden" 
                            />
                            
                            <div className="relative flex-1 sm:flex-none">
                              <select
                                value={postCategory}
                                onChange={(e) => setPostCategory(e.target.value)}
                                className="w-full appearance-none px-4 py-2 pr-8 text-sm text-slate-600 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                              >
                                <option value="" disabled>Choisir une catégorie</option>
                                {CATEGORIES.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                              </select>
                              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={!postContent.trim() && postMediaFiles.length === 0}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                          >
                            <Send size={16} />
                            Publier
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {userPosts.length === 0 ? (
                    <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 text-center space-y-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <MessageCircle size={40} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-900">Aucune publication</h3>
                        <p className="text-slate-500">
                          {isOwnProfile 
                            ? "Vous n'avez pas encore publié de contenu sur votre fil d'actualité." 
                            : `${user.name} n'a pas encore publié de contenu.`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {userPosts.map(post => (
                        <PostCard 
                          key={post.id} 
                          post={post} 
                          currentUser={currentUser}
                          onShowReactions={handleShowReactions}
                          openLightbox={openLightbox}
                          onDelete={(postId) => {
                            if (window.confirm('Supprimer ce post ?')) {
                              api.posts.delete(postId).then(() => {
                                setUserPosts(prev => prev.filter(p => p.id !== postId));
                                toast.success('Post supprimé');
                              });
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'events' && (
                <motion.div
                  key="events"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {myEvents.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                      <CalendarIcon size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-medium">Aucun événement prévu</p>
                    </div>
                  ) : (
                    myEvents.map(event => (
                      <div key={event.id} className="bg-white rounded-[35px] overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="h-32 bg-slate-200 relative">
                          {event.imageUrl && <img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain" />}
                          <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-primary">
                            {event.category}
                          </div>
                        </div>
                        <div className="p-6">
                          <h4 className="font-black text-slate-900 mb-2 truncate">{event.title}</h4>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <CalendarIcon size={14} className="text-primary" />
                              {format(new Date(event.startDate), 'd MMMM yyyy', { locale: fr })}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <MapPin size={14} className="text-primary" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'opportunities' && (
                <motion.div
                  key="opportunities"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Mes candidatures */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6">Mes candidatures</h3>
                    {myServices.applied.length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic">Aucune candidature en cours</p>
                    ) : (
                      <div className="space-y-4">
                        {myServices.applied.map(service => (
                          <div key={service.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                              <h4 className="font-bold text-slate-900">{service.title}</h4>
                              <p className="text-xs text-slate-500">Postulé le {format(new Date(service.createdAt), 'dd/MM/yyyy')}</p>
                            </div>
                            <ChevronRight size={20} className="text-slate-300" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Candidatures reçues */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6">Candidatures reçues</h3>
                    {myServices.created.length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic">Aucune offre créée pour le moment.</p>
                    ) : (
                      <div className="space-y-6">
                        {myServices.created.map(service => (
                          <div key={service.id} className="space-y-3">
                            <h4 className="font-bold text-primary">{service.title}</h4>
                            {service.applications && service.applications.length === 0 ? (
                              <p className="text-xs text-slate-400 italic ml-2">Aucune candidature reçue.</p>
                            ) : (
                              <div className="space-y-3">
                                {service.applications && service.applications.map((app: any) => (
                                  <div key={app.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                      <p className="font-bold text-slate-900">{app.userName}</p>
                                      <p className="text-xs text-slate-500">{app.message}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">Reçu le {format(new Date(app.createdAt), 'dd/MM/yyyy')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'network' && (
                <motion.div
                  key="network"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Demandes reçues */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6">Demandes reçues</h3>
                    {myNetwork.requests.length === 0 ? (
                      <p className="text-slate-400 text-center py-8 italic">Aucune nouvelle demande</p>
                    ) : (
                      <div className="space-y-4">
                        {myNetwork.requests.map((req: any) => (
                          <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              <img src={req.avatarUrl} alt={req.name} className="w-10 h-10 rounded-full" />
                              <span className="font-bold text-slate-900">{req.name}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => toast.success('Accepté')} className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                                <Check size={16} />
                              </button>
                               <button onClick={() => toast.error('Refusé')} className="p-2 bg-red-100 text-red-600 rounded-full">
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Réseau actuel */}
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-6">Mon réseau ({myNetwork.following.length})</h3>
                    {myNetwork.following.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                        <Users size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500 font-medium">Votre réseau est encore vide</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {myNetwork.following.map(member => (
                          <div key={member.id} onClick={() => navigate(`/profile/${member.id}`)} className="flex items-center gap-4 p-4 bg-white rounded-[30px] border border-slate-100 shadow-sm hover:border-primary/30 transition-all cursor-pointer">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-black bg-white">
                                  {member.name?.[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-black text-slate-900 text-sm truncate">{member.name}</h4>
                              <p className="text-xs text-slate-500 truncate">{member.profession || 'Membre'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Post Confirmation Modal */}
      <AnimatePresence>
        {showPostConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                <Send size={40} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-slate-900">Publier maintenant ?</h3>
                <p className="text-slate-500">Votre publication sera visible par toute la communauté sur le fil d'actualité.</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowPostConfirmModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmPostSubmit}
                  className="flex-1 px-6 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                >
                  Confirmer
                </button>
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
      {/* Reactions Modal */}
      <AnimatePresence>
        {reactionsModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Réactions</h3>
                <button onClick={() => setReactionsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {loadingReactions ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : postReactions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">Aucune réaction pour le moment</div>
                ) : (
                  <div className="space-y-4">
                    {postReactions.map((reaction, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                            {reaction.avatarUrl ? (
                              <img src={reaction.avatarUrl} alt={reaction.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                {reaction.name?.[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-slate-900">{reaction.name}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50">
                          {reaction.type === 'like' ? <Heart size={16} className="fill-red-500 text-red-500" /> :
                           reaction.type === 'applause' ? <span>👏</span> :
                           <Lightbulb size={16} className="fill-purple-500 text-purple-500" />}
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

      {/* Settings & Info Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Paramètres & Informations</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JCEConnect • Centre de contrôle</p>
                  </div>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                  <X size={24} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-x-auto md:overflow-y-auto flex md:flex-col">
                  {[
                    { id: 'legal', label: 'Mentions Légales', icon: Info },
                    { id: 'privacy', label: 'Confidentialité', icon: ShieldCheck },
                    { id: 'cookies', label: 'Cookies & Données', icon: Database },
                    { id: 'terms', label: 'Conditions (CGU)', icon: FileText },
                    { id: 'account', label: 'Mon Compte', icon: UserIcon },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSettingsTab(tab.id as any)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
                        activeSettingsTab === tab.id 
                          ? 'bg-white text-primary shadow-sm border border-slate-100' 
                          : 'text-slate-500 hover:bg-white/50'
                      }`}
                    >
                      <tab.icon size={18} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-10 overflow-y-auto bg-white">
                  {activeSettingsTab === 'legal' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <h3 className="text-2xl font-black text-slate-900">Mentions Légales</h3>
                      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
                        <section>
                          <h4 className="font-bold text-slate-900">Éditeur de la plateforme</h4>
                          <p>La plateforme JCEConnect est éditée par <strong>Lokossou Sètondji Michaël</strong>.</p>
                          <p><strong>Adresse :</strong> Air-france3, Bouaké TSF, Côte-d'Ivoire.</p>
                          <p><strong>Téléphone :</strong> +225 05 06 47 06 47</p>
                          <p><strong>Email :</strong> mailreseaujce@gmail.com</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Responsable de traitement</h4>
                          <p>Le responsable du traitement des données à caractère personnel est Lokossou Sètondji Michaël, conformément aux dispositions de la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel en Côte d'Ivoire et aux normes de l'UEMOA.</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Hébergement</h4>
                          <p>La plateforme est hébergée sur des serveurs sécurisés garantissant la disponibilité et la confidentialité des données des membres de la Jeune Chambre Économique.</p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'privacy' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <h3 className="text-2xl font-black text-slate-900">Politique de Confidentialité</h3>
                      
                      <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                          <ShieldCheck className="text-primary" size={24} />
                          <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Contrôle de visibilité</h4>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900">Visibilité du profil</p>
                            <p className="text-xs text-slate-500">Définissez qui peut voir vos informations</p>
                          </div>
                          <select 
                            value={formData.visibility || 'public'}
                            onChange={(e) => updatePreference('visibility', e.target.value)}
                            className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm outline-none focus:border-primary transition-all"
                          >
                            <option value="public">Public (Tout le monde)</option>
                            <option value="network">Réseau (Connexions uniquement)</option>
                            <option value="private">Privé (Moi uniquement)</option>
                          </select>
                        </div>
                      </div>

                      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
                        <p>Chez JCEConnect, nous accordons une importance capitale à la protection de votre vie privée. Cette politique détaille comment nous collectons et utilisons vos données.</p>
                        <section>
                          <h4 className="font-bold text-slate-900">Collecte des données</h4>
                          <p>Nous collectons les informations que vous nous fournissez lors de la création de votre profil (nom, profession, entreprise, contact) afin de faciliter le réseautage au sein de la communauté.</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Finalité du traitement</h4>
                          <p>Vos données sont utilisées exclusivement pour :</p>
                          <ul className="list-disc pl-5">
                            <li>La gestion de votre compte membre</li>
                            <li>La mise en relation professionnelle</li>
                            <li>L'envoi de notifications relatives aux activités de la JCE</li>
                            <li>L'amélioration des services de la plateforme</li>
                          </ul>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Vos droits</h4>
                          <p>Conformément aux normes UEMOA, vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de vos données. Vous pouvez exercer ces droits depuis vos paramètres ou en nous contactant.</p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'cookies' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <h3 className="text-2xl font-black text-slate-900">Politique des Cookies & Données</h3>
                      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
                        <p>JCEConnect utilise des cookies et des technologies similaires pour améliorer votre expérience de navigation.</p>
                        <section>
                          <h4 className="font-bold text-slate-900">Qu'est-ce qu'un cookie ?</h4>
                          <p>Un cookie est un petit fichier texte déposé sur votre terminal lors de la visite de la plateforme. Il permet de mémoriser vos préférences et de sécuriser votre connexion.</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Types de cookies utilisés</h4>
                          <ul className="list-disc pl-5">
                            <li><strong>Cookies essentiels :</strong> Nécessaires au fonctionnement de la plateforme (authentification).</li>
                            <li><strong>Cookies de performance :</strong> Pour analyser l'utilisation de la plateforme et l'optimiser.</li>
                            <li><strong>Cookies de personnalisation :</strong> Pour mémoriser vos choix (langue, préférences d'affichage).</li>
                          </ul>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Gestion des cookies</h4>
                          <p>Vous pouvez configurer votre navigateur pour refuser les cookies, mais cela pourrait limiter certaines fonctionnalités de JCEConnect.</p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'terms' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                      <h3 className="text-2xl font-black text-slate-900">Conditions Générales d'Utilisation</h3>
                      <div className="prose prose-slate max-w-none space-y-4 text-slate-600 leading-relaxed">
                        <p>L'utilisation de JCEConnect implique l'acceptation pleine et entière des présentes CGU.</p>
                        <section>
                          <h4 className="font-bold text-slate-900">Objet</h4>
                          <p>JCEConnect est un outil de réseautage et de collaboration destiné aux membres de la Jeune Chambre Économique.</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Obligations de l'utilisateur</h4>
                          <p>L'utilisateur s'engage à fournir des informations exactes et à ne pas publier de contenu illicite, injurieux ou contraire aux valeurs de la JCE.</p>
                        </section>
                        <section>
                          <h4 className="font-bold text-slate-900">Propriété intellectuelle</h4>
                          <p>Tous les éléments de la plateforme (logos, textes, graphismes) sont la propriété exclusive de l'éditeur ou de ses partenaires.</p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSettingsTab === 'account' && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
                      <div className="space-y-4">
                        <h3 className="text-2xl font-black text-slate-900">Gestion du compte</h3>
                        <p className="text-slate-500">Gérez la sécurité et les notifications de votre présence sur JCEConnect.</p>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Bell size={16} /> Préférences de notifications
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { id: 'connections', label: 'Nouvelles connexions' },
                            { id: 'comments', label: 'Commentaires & Réactions' },
                            { id: 'events', label: 'Événements' },
                            { id: 'offers', label: 'Offres & Opportunités' },
                            { id: 'messages', label: 'Messages privés' }
                          ].map(pref => (
                            <div key={pref.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                              <span className="text-sm font-bold text-slate-700">{pref.label}</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={formData.notificationPreferences?.[pref.id] ?? true}
                                  onChange={(e) => updatePreference(`notificationPreferences.${pref.id}`, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-8 bg-red-50 rounded-[32px] border border-red-100 space-y-6">
                        <div className="flex items-center gap-4 text-red-600">
                          <div className="p-3 bg-white rounded-2xl shadow-sm">
                            <Trash2 size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-lg">Zone de danger</h4>
                            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Action irréversible</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <p className="text-sm text-red-700 leading-relaxed font-medium">
                            La suppression de votre compte entraînera la perte définitive de :
                          </p>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              'Votre profil et vos informations personnelles',
                              'Toutes vos publications et médias',
                              'Vos conversations et messages privés',
                              'Vos participations aux événements',
                              'Vos connexions et votre réseau',
                              'Vos entreprises et boutiques créées'
                            ].map((item, i) => (
                              <li key={i} className="flex items-center gap-2 text-xs text-red-600 font-bold">
                                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-[0.98]"
                        >
                          Supprimer mon compte définitivement
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl p-8 space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Confirmation finale</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Cette action est <span className="text-red-600 font-bold">irréversible</span>. 
                    Toutes vos données seront supprimées de nos serveurs conformément aux normes de protection des données de l'UEMOA.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pour confirmer, tapez "SUPPRIMER"</p>
                <input 
                  type="text"
                  placeholder="SUPPRIMER"
                  className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl focus:border-red-500 transition-all text-center font-black uppercase tracking-widest"
                  onChange={(e) => {
                    if (e.target.value === 'SUPPRIMER') {
                      // Enable button logic if needed
                    }
                  }}
                  id="delete-confirm-input"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    const input = document.getElementById('delete-confirm-input') as HTMLInputElement;
                    if (input?.value === 'SUPPRIMER') {
                      handleDeleteAccount();
                    } else {
                      toast.error('Veuillez saisir SUPPRIMER pour confirmer.');
                    }
                  }}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
                >
                  Confirmer la suppression
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                    <Edit3 size={20} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900">Modifier mon profil</h2>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Steps Indicator */}
                <div className="flex items-center justify-center gap-4 mb-8">
                  {[1, 2, 3].map(step => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${editStep === step ? 'bg-primary text-white' : editStep > step ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                        {editStep > step ? <Check size={16} /> : step}
                      </div>
                      {step < 3 && <div className={`w-12 h-1 rounded-full ${editStep > step ? 'bg-primary/20' : 'bg-slate-100'}`} />}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleUpdate} className="space-y-10">
                  {editStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                      {/* Visuals Section */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <Camera size={20} className="text-primary" /> Photos & Visuels
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Cover Update */}
                          {/* Avatar Update */}
                          <div className="space-y-3">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Photo de profil</label>
                            <div className="flex items-center gap-6">
                              <div className="relative group">
                                <div className="w-24 h-24 rounded-[25px] bg-slate-100 overflow-hidden border-4 border-white shadow-lg">
                                  {formData.avatarUrl ? (
                                    <img src={formData.avatarUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl font-black">
                                      {formData.name?.[0]}
                                    </div>
                                  )}
                                </div>
                                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-[25px]">
                                  <Camera className="text-white" size={20} />
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'avatar')} />
                                </label>
                              </div>
                              <div className="space-y-2">
                                <button 
                                  type="button"
                                  onClick={generateAvatar}
                                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                                >
                                  <RefreshCw size={14} /> Générer aléatoirement
                                </button>
                                <p className="text-[10px] text-slate-400">Format carré recommandé</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Basic Info */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <UserIcon size={20} className="text-primary" /> Informations personnelles
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom complet *</label>
                            <input 
                              value={formData.name || ''} 
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Votre nom" 
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Âge *</label>
                            <input 
                              type="number" 
                              value={formData.age || ''} 
                              onChange={(e) => setFormData({...formData, age: Number(e.target.value)})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Votre âge" 
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Situation matrimoniale *</label>
                            <select 
                              value={formData.maritalStatus || ''} 
                              onChange={(e) => setFormData({...formData, maritalStatus: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
                              required
                            >
                              <option value="">Non spécifié</option>
                              <option value="Célibataire">Célibataire</option>
                              <option value="Marié(e)">Marié(e)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                            <input 
                              value={formData.whatsapp || ''} 
                              onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="+225 ..." 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profession *</label>
                            <input 
                              value={formData.profession || ''} 
                              onChange={(e) => setFormData({...formData, profession: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Ex: Architecte" 
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pays *</label>
                            <input 
                              value={formData.country || ''} 
                              onChange={(e) => setFormData({...formData, country: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Ex: France" 
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {editStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                      {/* Professional Info */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <Briefcase size={20} className="text-primary" /> Parcours Professionnel
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entreprise</label>
                            <input 
                              value={formData.company || ''} 
                              onChange={(e) => setFormData({...formData, company: e.target.value, companyId: null})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Nom de l'entreprise"
                              onBlur={() => setTimeout(() => setFormData({...formData, company: formData.company}), 200)} // Close dropdown on blur
                            />
                            {formData.company && formData.company.length > 0 && formData.companyId === null && (
                              <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-2xl mt-1 max-h-40 overflow-y-auto shadow-lg">
                                {allCompanies
                                  .filter(c => c.name.toLowerCase().includes(formData.company.toLowerCase()))
                                  .map(c => (
                                    <div 
                                      key={c.id} 
                                      className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                                      onClick={() => setFormData({...formData, company: c.name, companyId: c.id})}
                                    >
                                      {c.name}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle / Poste</label>
                            <input 
                              value={formData.role || ''} 
                              onChange={(e) => setFormData({...formData, role: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Ex: Comptable" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lien Portfolio Externe</label>
                            <input 
                              value={formData.externalPortfolioUrl || ''} 
                              onChange={(e) => setFormData({...formData, externalPortfolioUrl: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="https://mon-portfolio.com" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between ml-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compétences (virgules)</label>
                              <button 
                                type="button"
                                onClick={() => generateAISuggestion('skills')}
                                disabled={isGeneratingSkills}
                                className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                              >
                                {isGeneratingSkills ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Suggérer (IA)
                              </button>
                            </div>
                            <input 
                              value={formData.skills || ''} 
                              onChange={(e) => setFormData({...formData, skills: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Design, Management..." 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Vision Section */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <Target size={20} className="text-primary" /> Vision & Objectifs
                        </h3>
                        <div className="space-y-6">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Slogan / Marketing</label>
                            <input 
                              value={formData.marketing || ''} 
                              onChange={(e) => setFormData({...formData, marketing: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                              placeholder="Votre message clé" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between ml-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Objectifs détaillés</label>
                              <button 
                                type="button"
                                onClick={() => generateAISuggestion('vision')}
                                disabled={isGeneratingVision}
                                className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                              >
                                {isGeneratingVision ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Suggérer (IA)
                              </button>
                            </div>
                            <textarea 
                              value={formData.goals || ''} 
                              onChange={(e) => setFormData({...formData, goals: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium min-h-[120px]" 
                              placeholder="Partagez vos ambitions..." 
                              rows={4}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {editStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                      {/* Notification Preferences */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <Bell size={20} className="text-primary" /> Préférences de notifications
                        </h3>
                        <div className="space-y-4">
                          {[
                            { id: 'connections', label: 'Nouvelles connexions', desc: 'Lorsqu\'un membre souhaite se connecter avec vous' },
                            { id: 'comments', label: 'Commentaires & Réactions', desc: 'Quand quelqu\'un interagit avec vos publications' },
                            { id: 'events', label: 'Événements', desc: 'Rappels et invitations aux événements' },
                            { id: 'offers', label: 'Offres & Opportunités', desc: 'Nouvelles offres correspondant à votre profil' },
                            { id: 'messages', label: 'Messages privés', desc: 'Lorsque vous recevez un nouveau message' }
                          ].map(pref => (
                            <div key={pref.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{pref.label}</h4>
                                <p className="text-xs text-slate-500">{pref.desc}</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={formData.notificationPreferences?.[pref.id] ?? true}
                                  onChange={(e) => updatePreference(`notificationPreferences.${pref.id}`, e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Visibility Section */}
                      <div className="space-y-6">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2">
                          <UserIcon size={20} className="text-primary" /> Visibilité & Vie Privée
                        </h3>
                        <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl text-primary shadow-sm">
                              <ShieldCheck size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm">Mode de visibilité</h4>
                              <p className="text-xs text-slate-500">Qui peut voir votre profil complet</p>
                            </div>
                          </div>
                          <select 
                            value={formData.visibility || 'public'}
                            onChange={(e) => updatePreference('visibility', e.target.value)}
                            className="bg-white border-none rounded-xl px-4 py-2 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          >
                            <option value="public">Public</option>
                            <option value="network">Réseau</option>
                            <option value="private">Privé</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Modal Footer */}
                  <div className="pt-8 flex gap-4 border-t border-slate-100">
                    {editStep > 1 ? (
                      <button 
                        type="button" 
                        onClick={handlePrevStep} 
                        className="flex-1 py-4 text-slate-600 font-black hover:bg-slate-100 rounded-[20px] transition-all"
                      >
                        Précédent
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => setIsEditModalOpen(false)} 
                        className="flex-1 py-4 text-slate-600 font-black hover:bg-slate-100 rounded-[20px] transition-all"
                      >
                        Annuler
                      </button>
                    )}
                    
                    {editStep < 3 ? (
                      <button 
                        type="button" 
                        onClick={handleNextStep}
                        className="flex-[2] flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-[20px] font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                      >
                        Suivant <ChevronRight size={20} />
                      </button>
                    ) : (
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex-[2] flex items-center justify-center gap-2 py-4 bg-primary text-white rounded-[20px] font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw size={22} className="animate-spin" />
                            Sauvegarde...
                          </>
                        ) : (
                          <>
                            <Save size={22} />
                            Enregistrer
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cropper Modal */}
      {showCropper && cropImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[40px] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Recadrer la photo</h3>
              <button onClick={() => setShowCropper(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="relative h-96 bg-slate-900">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={cropType === 'avatar' ? 1 : 16 / 6}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                cropShape={cropType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <ZoomOut size={20} className="text-slate-400" />
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <ZoomIn size={20} className="text-slate-400" />
                </div>
                
                <div className="flex items-center gap-4">
                  <RotateCcw size={20} className="text-slate-400" />
                  <input
                    type="range"
                    value={rotation}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-sm font-bold text-slate-600 w-8">{rotation}°</span>
                </div>
              </div>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowCropper(false)}
                  className="flex-1 py-4 border-2 border-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleSaveCrop}
                  className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <Check size={22} />
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Logout */}
      <div className="md:hidden pt-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-red-50 text-red-500 rounded-[25px] font-black shadow-sm hover:bg-red-50 transition-all"
        >
          <LogOut size={22} />
          Déconnexion
        </button>
      </div>

      {/* Certification Modal */}
      <AnimatePresence>
        {showCertModal && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-900">Ajouter une certification</h2>
                <button onClick={() => setShowCertModal(false)} className="p-2 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm">
                  <X size={24} className="text-slate-500" />
                </button>
              </div>
              <form onSubmit={handleAddCert} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de la certification</label>
                  <input 
                    required
                    value={certForm.name} 
                    onChange={(e) => setCertForm({...certForm, name: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                    placeholder="Ex: AWS Certified Solutions Architect" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Organisation</label>
                  <input 
                    required
                    value={certForm.organization} 
                    onChange={(e) => setCertForm({...certForm, organization: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                    placeholder="Ex: Amazon Web Services" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date d'obtention</label>
                  <input 
                    required
                    type="month"
                    value={certForm.dateObtained} 
                    onChange={(e) => setCertForm({...certForm, dateObtained: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" 
                  />
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShowCertModal(false)} 
                    className="flex-1 py-4 text-slate-600 font-black hover:bg-slate-100 rounded-[20px] transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-primary text-white rounded-[20px] font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* Message Modal */}
        {isMessageModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-lg rounded-[28px] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">Message à {user.name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nouvelle conversation</p>
                  </div>
                </div>
                <button onClick={() => setIsMessageModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSendMessage} className="p-6 space-y-4">
                <textarea 
                  required
                  autoFocus
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[20px] focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none text-slate-700 placeholder:text-slate-400"
                  placeholder={`Écrivez votre message à ${user.name}...`}
                />
                
                <button 
                  type="submit"
                  disabled={isSendingMessage || !messageContent.trim()}
                  className="w-full py-4 bg-slate-900 text-white rounded-[20px] font-black hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-[0.1em]"
                >
                  {isSendingMessage ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={18} />
                      Envoyer le message
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
