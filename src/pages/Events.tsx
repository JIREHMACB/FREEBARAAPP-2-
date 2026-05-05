import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MapPin, Calendar as CalendarIcon, Users, Plus, Edit3, Trash2, Map as MapIcon, ChevronRight, ChevronLeft, Image as ImageIcon, Video, Euro, Info, X, Eye, CalendarDays, Heart, Share2, Facebook, Linkedin, MessageCircle, Link, Instagram, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import MapComponent from '../components/MapComponent';
import Calendar from '../components/Calendar';
import { isSameDay, parseISO } from 'date-fns';

// Helper to calculate distance in km using Haversine formula
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

// Simple cache for events to optimize repeated loads
let eventsCache: any[] | null = null;
let userDataCache: any | null = null;
let countriesCache: string[] | null = null;

export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => console.error("Error getting location: ", error)
      );
    }
  }, []);

  const [events, setEvents] = useState<any[]>(eventsCache || []);
  const [loading, setLoading] = useState(!eventsCache);
  const [showCreate, setShowCreate] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(userDataCache);
  const [countries, setCountries] = useState<string[]>(countriesCache || []);

  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [confirmEventId, setConfirmEventId] = useState<number | null>(null);
  const [sharingEvent, setSharingEvent] = useState<any | null>(null);
  const [dashboardEvent, setDashboardEvent] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    category: 'Tous',
    country: 'Tous'
  });
  const [step, setStep] = useState(1);
  const [eventData, setEventData] = useState({
    title: '',
    category: 'business',
    description: '',
    location: '',
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    startDate: '',
    endDate: '',
    price: '0',
    imageUrl: '',
    visualUrl: '',
    communityId: null as number | null
  });
  const [isPaid, setIsPaid] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{cover: string | null, visual: string | null}>({
    cover: null,
    visual: null
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const fetchEvents = async (forceRefresh = false) => {
    if (!forceRefresh && eventsCache && userDataCache) {
      setLoading(false);
      return;
    }

    try {
      if (forceRefresh) setLoading(true);
      const [eventsData, userData] = await Promise.all([
        api.events.getAll(),
        api.users.me()
      ]);
      
      eventsCache = eventsData;
      userDataCache = userData;
      
      setEvents(eventsData);
      setCurrentUser(userData);
      
      // Extract unique countries for filter
      const uniqueCountries = Array.from(new Set(eventsData.map((e: any) => e.country).filter(Boolean))) as string[];
      countriesCache = uniqueCountries;
      setCountries(uniqueCountries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openDashboard = async (event: any) => {
    setDashboardEvent(event);
    try {
      const participantsData = await api.request(`/events/${event.id}/participants`);
      setParticipants(participantsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvents();
    
    // Check for date parameter in URL
    const params = new URLSearchParams(location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      try {
        const date = parseISO(dateParam);
        setSelectedDate(date);
        setShowCalendar(true);
      } catch (e) {
        console.error('Invalid date parameter', e);
      }
    }
  }, [location.search]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEventData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'visual') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setMediaFiles(prev => ({ ...prev, [type]: result }));
        if (type === 'cover') {
          setEventData(prev => ({ ...prev, imageUrl: result }));
        } else if (type === 'visual') {
          setEventData(prev => ({ ...prev, visualUrl: result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!eventData.title || !eventData.description || !eventData.country || !eventData.city || !eventData.location || !eventData.startDate || !eventData.endDate || !eventData.category) {
      toast.error('Tous les champs obligatoires doivent être remplis');
      return;
    }
    
    try {
      const payload = { 
        ...eventData, 
        isPaid, 
        price: isPaid ? Number(eventData.price) : 0,
        latitude: eventData.latitude ? Number(eventData.latitude) : null,
        longitude: eventData.longitude ? Number(eventData.longitude) : null,
        imageUrl: mediaFiles.cover,
        visualUrl: mediaFiles.visual
      };

      if (editingEventId) {
        await api.events.update(editingEventId, payload);
        toast.success('Événement mis à jour avec succès !');
      } else {
        await api.events.create(payload);
        toast.success('Événement créé avec succès !');
      }

      setShowCreate(false);
      setEditingEventId(null);
      setStep(1);
      setEventData({
        title: '',
        category: 'business',
        description: '',
        location: '',
        city: '',
        country: '',
        latitude: '',
        longitude: '',
        startDate: '',
        endDate: '',
        price: '0',
        imageUrl: '',
        visualUrl: '',
        communityId: null
      });
      setMediaFiles({ cover: null, visual: null });
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error(editingEventId ? 'Erreur lors de la mise à jour' : 'Erreur lors de la création');
    }
  };

  const handleFavoriteEvent = async (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    try {
      const response = await api.events.favorite(event.id);
      setEvents(prev => prev.map(ev => 
        ev.id === event.id 
          ? { 
              ...ev, 
              isFavorite: response.isFavorite, 
              favoritesCount: response.isFavorite ? (ev.favoritesCount || 0) + 1 : (ev.favoritesCount || 1) - 1 
            } 
          : ev
      ));
      toast.success(response.isFavorite ? 'Ajouté aux favoris' : 'Retiré des favoris');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'ajout aux favoris');
    }
  };

  const handleShareClick = (e: React.MouseEvent, event: any) => {
    e.stopPropagation();
    setSharingEvent(event);
  };

  const handleShareAction = async (platform: string) => {
    if (!sharingEvent) return;

    const shareUrl = `${window.location.origin}/events/${sharingEvent.id}`;
    const text = `Découvrez cet événement : ${sharingEvent.title}`;

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
      const response = await api.events.share(sharingEvent.id);
      setEvents(prev => prev.map(ev => 
        ev.id === sharingEvent.id ? { ...ev, shares_count: response.shares_count } : ev
      ));
    } catch (err) {
      console.error(err);
    }

    if (platform !== 'copy') {
      setSharingEvent(null);
    }
  };

  const handleEditEvent = (event: any) => {
    setEditingEventId(event.id);
    setEventData({
      title: event.title || '',
      category: event.category || 'business',
      description: event.description || '',
      location: event.location || '',
      city: event.city || '',
      country: event.country || '',
      latitude: event.latitude?.toString() || '',
      longitude: event.longitude?.toString() || '',
      startDate: event.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
      price: event.price?.toString() || '0',
      imageUrl: event.imageUrl || '',
      visualUrl: event.visualUrl || '',
      communityId: event.communityId || null
    });
    setMediaFiles({ cover: event.imageUrl || null, visual: event.visualUrl || null });
    setIsPaid(event.price > 0);
    setShowCreate(true);
    setStep(1);
  };

  const handleParticipate = async (event: any) => {
    if (event.price > 0) {
      // In a real app, generate a proper invoice here
      // For now, assume we generate one or just show the payment modal
      setSharingEvent(event); // Reuse sharing modal or create a new one
      return;
    }
    
    try {
      await api.events.participate(event.id);
      toast.success('Participation confirmée !');
      // Update local state to show participation immediately
      setEvents(prev => prev.map(ev => {
        if (ev.id === event.id) {
          return {
            ...ev,
            participantsCount: (ev.participantsCount || 0) + 1,
            isParticipating: true
          };
        }
        return ev;
      }));
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la participation');
    }
  };

  const filteredEvents = events.filter(event => {
    const categoryMatch = filters.category === 'Tous' || event.category?.toLowerCase() === filters.category.toLowerCase();
    const countryMatch = filters.country === 'Tous' || event.country === filters.country;
    const dateMatch = !selectedDate || isSameDay(new Date(event.startDate), selectedDate);
    return categoryMatch && countryMatch && dateMatch;
  });

  const filteredAndSortedEvents = filteredEvents.sort((a, b) => {
    const now = new Date().getTime();
    const proximityA = Math.abs(new Date(a.startDate).getTime() - now);
    const proximityB = Math.abs(new Date(b.startDate).getTime() - now);
    
    // Prioritize proximity to today. If locations are available, distance could be a tertiary tie-breaker,
    // but the request is specifically for date closeness.
    return proximityA - proximityB;
  });

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;
    try {
      await api.events.delete(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      toast.success('Événement supprimé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="max-w-[1850px] mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Événements</h1>
          <p className="text-slate-500 text-sm sm:text-base">Découvrez et participez aux événements de la communauté</p>
        </div>
        <button 
          onClick={() => {
            setEditingEventId(null);
            setEventData({
              title: '',
              category: 'business',
              description: '',
              location: '',
              city: '',
              country: '',
              latitude: '',
              longitude: '',
              startDate: '',
              endDate: '',
              price: '0',
              imageUrl: '',
              visualUrl: '',
              communityId: null
            });
            setMediaFiles({ cover: null, visual: null });
            setShowCreate(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          <span>Créer un événement</span>
        </button>
      </div>

      {/* Filters & Calendar Toggle */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Catégorie</label>
              <select 
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
              >
                <option value="Tous">Toutes les catégories</option>
                <option value="business">Business</option>
                <option value="formation">Formation</option>
                <option value="conferences">Conférences</option>
                <option value="networking">Networking</option>
                <option value="meetup">Meetup</option>
                <option value="forum">Forum</option>
                <option value="salon">Salon</option>
                <option value="venteprivee">Vente privée</option>
                <option value="foire">Foire</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Pays</label>
              <select 
                value={filters.country}
                onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none appearance-none"
              >
                <option value="Tous">Tous les pays</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={() => setShowCalendar(!showCalendar)}
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${showCalendar ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'}`}
              >
                <CalendarDays size={20} />
                <span className="text-sm font-bold hidden sm:inline">{showCalendar ? 'Masquer Calendrier' : 'Afficher Calendrier'}</span>
              </button>
            </div>
          </div>

          {selectedDate && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between bg-primary/5 border border-primary/10 p-4 rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <CalendarIcon size={18} />
                </div>
                <span className="text-sm font-bold text-slate-700">
                  Événements du {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-xs font-black text-primary uppercase tracking-widest hover:underline"
              >
                Effacer le filtre
              </button>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {showCalendar && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full lg:w-[400px]"
            >
              <Calendar 
                events={events} 
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Multi-step Create Event Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{editingEventId ? 'Modifier l\'événement' : 'Créer un événement'}</h2>
                  <p className="text-slate-500 text-sm">Étape {step} sur 3</p>
                </div>
                <button 
                  onClick={() => { setShowCreate(false); setStep(1); setEditingEventId(null); }}
                  className="p-3 bg-white hover:bg-slate-100 rounded-full transition-colors shadow-sm"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / 3) * 100}%` }}
                  className="h-full bg-primary"
                />
              </div>

              {/* Content */}
              <div className="p-8 overflow-y-auto flex-1">
                <form onSubmit={handleCreate} className="space-y-6">
                  {step === 1 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <Info size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Informations de base</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-bold text-slate-700 mb-2">Titre de l'événement</label>
                          <input 
                            name="title" 
                            required 
                            value={eventData.title}
                            onChange={handleInputChange}
                            placeholder="Ex: Conférence sur l'entrepreneuriat"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date de début</label>
                            <input 
                              type="datetime-local" 
                              name="startDate" 
                              required 
                              value={eventData.startDate}
                              onChange={handleInputChange}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date de fin</label>
                            <input 
                              type="datetime-local" 
                              name="endDate" 
                              required 
                              value={eventData.endDate}
                              onChange={handleInputChange}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie</label>
                          <select 
                            name="category" 
                            required 
                            value={eventData.category}
                            onChange={handleInputChange}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none appearance-none"
                          >
                            <option value="business">Business</option>
                            <option value="formation">Formation</option>
                            <option value="conferences">Conférences</option>
                            <option value="networking">Networking</option>
                            <option value="meetup">Meetup</option>
                            <option value="forum">Forum</option>
                            <option value="salon">Salon</option>
                            <option value="venteprivee">Vente privée</option>
                            <option value="foire">Foire</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Pays</label>
                          <input 
                            name="country" 
                            required 
                            value={eventData.country}
                            onChange={handleInputChange}
                            placeholder="Ex: France"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Ville</label>
                          <input 
                            name="city" 
                            required 
                            value={eventData.city}
                            onChange={handleInputChange}
                            placeholder="Ex: Paris"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                          <textarea 
                            name="description" 
                            required 
                            rows={4} 
                            value={eventData.description}
                            onChange={handleInputChange}
                            placeholder="Décrivez votre événement en quelques mots..."
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none resize-none" 
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <MapPin size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Lieu et Date</h3>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Lieu (Adresse)</label>
                          <input 
                            name="location" 
                            required 
                            value={eventData.location}
                            onChange={handleInputChange}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                            placeholder="Adresse complète" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Latitude (Optionnel)</label>
                            <input 
                              type="number" 
                              step="any" 
                              name="latitude" 
                              value={eventData.latitude}
                              onChange={handleInputChange}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                              placeholder="ex: 48.8566" 
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Longitude (Optionnel)</label>
                            <input 
                              type="number" 
                              step="any" 
                              name="longitude" 
                              value={eventData.longitude}
                              onChange={handleInputChange}
                              className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                              placeholder="ex: 2.3522" 
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <Euro size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Visuels et Accès</h3>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative group">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Photo de couverture</label>
                            <div className="relative h-40 bg-slate-900 border-2 border-solid border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group">
                              {mediaFiles.cover ? (
                                <>
                                  <img 
                                    src={mediaFiles.cover} 
                                    alt="" 
                                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30" 
                                  />
                                  <img src={mediaFiles.cover} className="relative w-full h-full object-contain z-10" alt="Cover" />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                    <div className="bg-white p-2 rounded-full shadow-lg">
                                      <RefreshCw size={20} className="text-primary" />
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="text-slate-400 group-hover:text-primary transition-colors" size={32} />
                                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Image de couverture</span>
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleFileChange(e, 'cover')}
                                className="absolute inset-0 opacity-0 cursor-pointer z-30" 
                              />
                            </div>
                          </div>
                          <div className="relative group">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Visuel/Vidéo (MP4)</label>
                            <div className="relative h-40 bg-slate-900 border-2 border-solid border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group">
                              {mediaFiles.visual ? (
                                <div className="flex flex-col items-center gap-1 w-full h-full relative">
                                  {mediaFiles.visual.includes('video/mp4') || mediaFiles.visual.includes('data:video') ? (
                                    <video src={mediaFiles.visual} className="w-full h-full object-contain z-10" />
                                  ) : (
                                    <>
                                      <img 
                                        src={mediaFiles.visual} 
                                        alt="" 
                                        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30" 
                                      />
                                      <img src={mediaFiles.visual} className="relative w-full h-full object-contain z-10" alt="Visual" />
                                    </>
                                  )}
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                    <div className="bg-white p-2 rounded-full shadow-lg">
                                      <RefreshCw size={20} className="text-primary" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Video className="text-slate-400 group-hover:text-primary transition-colors" size={32} />
                                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Média supplémentaire</span>
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*,video/mp4" 
                                onChange={(e) => handleFileChange(e, 'visual')}
                                className="absolute inset-0 opacity-0 cursor-pointer z-30" 
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-3">Type d'accès</label>
                          <div className="flex p-1 bg-slate-100 rounded-2xl w-full">
                            <button 
                              type="button" 
                              onClick={() => setIsPaid(false)} 
                              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!isPaid ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                            >
                              Gratuit
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setIsPaid(true)} 
                              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${isPaid ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                            >
                              Payant
                            </button>
                          </div>
                          {isPaid && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 space-y-4"
                            >
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Prix (F CFA)</label>
                                <div className="relative">
                                  <Euro size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input 
                                    type="number" 
                                    name="price" 
                                    value={eventData.price}
                                    onChange={handleInputChange}
                                    placeholder="0" 
                                    className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Numéro WhatsApp</label>
                                <input 
                                  name="whatsappNumber" 
                                  value={eventData.whatsappNumber || ''}
                                  onChange={handleInputChange}
                                  placeholder="Ex: +221770000000"
                                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none" 
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                {step > 1 && (
                  <button 
                    onClick={() => setStep(prev => prev - 1)}
                    className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <ChevronLeft size={20} />
                    Précédent
                  </button>
                )}
                {step < 3 ? (
                  <button 
                    onClick={() => {
                      if (step === 1) {
                        const requiredFields = ['title', 'description', 'country', 'city', 'startDate', 'endDate', 'category'];
                        const missingFields = requiredFields.filter(field => !eventData[field as keyof typeof eventData]);
                        if (missingFields.length > 0) {
                          toast.error('Veuillez remplir tous les champs obligatoires de cette étape');
                          return;
                        }
                      } else if (step === 2) {
                        if (!eventData.location) {
                          toast.error('Veuillez spécifier un lieu pour votre événement');
                          return;
                        }
                      }
                      setStep(prev => prev + 1);
                    }}
                    className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    Suivant
                    <ChevronRight size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={handleCreate}
                    className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                  >
                    {editingEventId ? 'Enregistrer les modifications' : 'Créer l\'événement'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {loading ? (
        <div className="text-center py-8 text-slate-500">Chargement...</div>
      ) : filteredAndSortedEvents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
          Aucun événement à venir dans les 7 prochains jours.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedEvents.map((event) => {
            const getCategoryBorderColor = (category: string) => {
              switch (category?.toLowerCase()) {
                case 'business': return '#3b82f6'; // blue-500
                case 'formation': return '#22c55e'; // green-500
                case 'priere': return '#f97316'; // orange-500
                case 'networking': return '#155be3'; // primary
                default: return '#f1f5f9'; // slate-100
              }
            };

            return (
              <motion.div 
                key={event.id} 
                whileHover={{ 
                  y: -8,
                  borderColor: getCategoryBorderColor(event.category),
                  transition: { duration: 0.2, ease: "easeOut" }
                }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col transition-shadow hover:shadow-xl"
              >
                <div className="h-48 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                {event.imageUrl ? (
                  <>
                    <img 
                      src={event.imageUrl} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-30" 
                    />
                    <img src={event.imageUrl} alt={event.title} className="relative w-full h-full object-contain z-10" />
                  </>
                ) : (
                  <div className="w-full h-full gradient-bg opacity-80 flex items-center justify-center">
                    <CalendarIcon size={48} className="text-white opacity-50" />
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-primary uppercase tracking-wide z-20">
                  {event.category}
                </div>

                {/* Favorite and Share Counts Overlay */}
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <button 
                    onClick={(e) => handleFavoriteEvent(e, event)}
                    className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform"
                  >
                    <Heart size={16} className={event.isFavorite ? "fill-red-500 text-red-500" : "text-slate-400"} />
                    <span className="text-xs font-bold text-slate-700">{event.favoritesCount || 0}</span>
                  </button>
                  <button 
                    onClick={(e) => handleShareClick(e, event)}
                    className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform"
                  >
                    <Share2 size={16} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">{event.shares_count || 0}</span>
                  </button>
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold text-slate-900">{event.title}</h3>
                  {event.latitude && event.longitude && (
                    <button 
                      onClick={() => navigate(`/jce?lat=${event.latitude}&lng=${event.longitude}&eventId=${event.id}`)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary-hover transition-colors"
                    >
                      <MapIcon size={12} />
                      Voir sur la carte
                    </button>
                  )}
                </div>
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">{event.description}</p>
                
                <div className="space-y-2 mb-6 mt-auto">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarIcon size={16} className="text-primary" />
                    <span>{format(new Date(event.startDate), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="text-primary" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users size={16} className="text-primary" />
                    <span>{event.participantsCount || 0} participants</span>
                  </div>
                </div>

                {event.latitude && event.longitude && (
                  <div className="mb-4">
                    <MapComponent 
                      lat={event.latitude} 
                      lng={event.longitude} 
                      title={event.title} 
                    />
                  </div>
                )}

                {event.creatorId === currentUser?.id ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={18} />
                      Détails
                    </button>
                    <button 
                      onClick={() => handleEditEvent(event)}
                      className="p-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button 
                      onClick={() => handleDeleteEvent(event.id)}
                      className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={18} />
                      Détails
                    </button>
                    <button 
                      onClick={() => {
                        if (event.isParticipating) {
                          toast.error('Vous participez déjà à cet événement');
                        } else {
                          setConfirmEventId(event.id);
                        }
                      }}
                      disabled={event.isParticipating}
                      className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                        event.isParticipating 
                          ? 'bg-green-50 text-green-600 cursor-default' 
                          : 'bg-primary text-white hover:bg-primary-hover'
                      }`}
                    >
                      {event.isParticipating ? (
                        <>
                          <Users size={18} />
                          Inscrit
                        </>
                      ) : (
                        event.price > 0 ? 'Payer' : 'Participer'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        </div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {sharingEvent && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              {/* Payment/Share Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {sharingEvent.price > 0 ? 'Payer et participer' : 'Partager l\'événement'}
                </h3>
                <button onClick={() => setSharingEvent(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              {sharingEvent.price > 0 ? (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Montant à payer</p>
                    <p className="text-3xl font-black text-slate-900">{sharingEvent.price} F CFA</p>
                  </div>
                  <button 
                    onClick={() => window.open(`https://wa.me/${sharingEvent.whatsappNumber?.replace(/\D/g, '')}?text=Je+souhaite+participer+à+l'événement+${sharingEvent.title}`, '_blank')}
                    className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={20} />
                    Continuer pour payer
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <button 
                      onClick={() => handleShareAction('whatsapp')}
                      className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors group"
                    >
                      <MessageCircle className="text-green-600 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-green-700">WhatsApp</span>
                    </button>
                    <button 
                      onClick={() => handleShareAction('facebook')}
                      className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors group"
                    >
                      <Facebook className="text-blue-600 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-blue-700">Facebook</span>
                    </button>
                    <button 
                      onClick={() => handleShareAction('linkedin')}
                      className="flex flex-col items-center gap-2 p-4 bg-sky-50 rounded-2xl hover:bg-sky-100 transition-colors group"
                    >
                      <Linkedin className="text-sky-600 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-sky-700">LinkedIn</span>
                    </button>
                    <button 
                      onClick={() => handleShareAction('copy')}
                      className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors group"
                    >
                      <Link className="text-slate-600 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-slate-700">Copier</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Aperçu TikTok & Instagram</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Pour TikTok et Instagram, copiez le lien et collez-le dans votre bio ou vos stories.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dashboard Modal */}
      {dashboardEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">{dashboardEvent.title} - Dashboard</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Participants</p>
                <p className="text-2xl font-bold">{participants.length}</p>
              </div>
            </div>
            <h4 className="font-bold mb-2">Liste des participants</h4>
            <div className="space-y-2">
              {participants.map(p => (
                <a key={p.id} href={`/profile/${p.id}`} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <img src={p.avatarUrl} className="w-8 h-8 rounded-full" alt={p.name} />
                  <span>{p.name}</span>
                </a>
              ))}
            </div>
            <button onClick={() => setDashboardEvent(null)} className="mt-6 w-full py-3 bg-slate-100 rounded-xl font-bold">Fermer</button>
          </div>
        </div>
      )}

      {confirmEventId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirmer la participation</h3>
            <p className="text-slate-600 mb-8">Êtes-vous sûr de vouloir participer à cet événement ?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmEventId(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  const event = events.find(e => e.id === confirmEventId);
                  if (event) {
                    handleParticipate(event);
                  }
                  setConfirmEventId(null);
                }}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
