import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Search, Building2, Plus, Users, ExternalLink, Heart, Share2, Facebook, Linkedin, Link, Image as ImageIcon, CreditCard, Sparkles, ShoppingBag, ChevronRight, History, MapPin, Loader2, X, MessageCircle, Package, Star, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import BusinessDetail from './BusinessDetail';
import FinancePage from './Finance';
import AdsCreationWizard from '../components/AdsCreationWizard';
import ProductSuggestions from '../components/ProductSuggestions';
import BusinessMap from '../components/BusinessMap';
import BusinessHistory from '../components/BusinessHistory';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Business() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [newCompanies, setNewCompanies] = useState<any[]>([]);
  const [trendingCompanies, setTrendingCompanies] = useState<any[]>([]);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myCompany, setMyCompany] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [favoriteCompanies, setFavoriteCompanies] = useState<any[]>([]);
  const [favoriteProducts, setFavoriteProducts] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdWizard, setShowAdWizard] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [modalStep, setModalStep] = useState(1);
  const [sharingProduct, setSharingProduct] = useState<any>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [initialShowDashboard, setInitialShowDashboard] = useState(false);
  const [initialDashboardTab, setInitialDashboardTab] = useState<'shops' | 'orders' | 'stock' | 'dashboard' | 'assistant' | 'score' | undefined>(undefined);
  const [showFinance, setShowFinance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyForm, setCompanyForm] = useState<any>({
    name: '', sector: '', domaine: 'Produits', description: '', address: '', whatsapp: '',
    facebook: '', twitter: '', linkedin: '',
    logoUrl: '', coverUrl: '', isShop: 0, specialty: '', categories: ''
  });
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', category: '', imageUrls: [] as string[]
  });

  const addToHistory = (id: number) => {
    const history = localStorage.getItem('business_view_history');
    let ids: number[] = history ? JSON.parse(history) : [];
    ids = [id, ...ids.filter(i => i !== id)].slice(0, 10);
    localStorage.setItem('business_view_history', JSON.stringify(ids));
  };

  const fetchMarketplaceData = async () => {
    try {
      const [all, news, trending, recents, favCompanies, favProducts, user] = await Promise.all([
        api.companies.getAll(),
        api.companies.getNew(),
        api.companies.getTrending(),
        api.companies.getRecentProducts(),
        api.users.getFavoriteCompanies(),
        api.users.getFavoriteProducts(),
        api.users.me(),
      ]);
      setCompanies(all || []);
      console.log('ALL COMPANIES', all);
      setNewCompanies(news || []);
      setTrendingCompanies(trending || []);
      setRecentProducts(recents || []);
      setFavoriteCompanies(favCompanies || []);
      setFavoriteProducts(favProducts || []);
      setCurrentUser(user);
      if (user?.id) {
        const manageable = all.find((c: any) => c.ownerId === user.id || c.managerId === user.id);
        const amIManager = all.some((c: any) => c.managerId === user.id && c.ownerId !== user.id);
        setMyCompany(manageable);
        (window as any).amIManagerOfSomething = amIManager;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplaceData();
    
    if (location.state) {
      const { selectedCompanyId: stateId, openDashboard, companyId, initialTab } = location.state as any;
      if (stateId) {
        setSelectedCompanyId(Number(stateId));
      } else if (openDashboard && companyId) {
        setSelectedCompanyId(Number(companyId));
        setInitialShowDashboard(true);
        if (initialTab) setInitialDashboardTab(initialTab);
      }
    }
  }, [location.state]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string, isProduct: boolean = false) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.match('image/(jpeg|png)')) {
        toast.error('Format non supporté. Utilisez JPEG ou PNG.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isProduct) {
          setProductForm(prev => ({ 
            ...prev, 
            imageUrls: [...prev.imageUrls, reader.result as string].slice(0, 4) 
          }));
        } else {
          setCompanyForm((prev: any) => ({ ...prev, [field]: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let companyId = companyForm.id;
      if (companyId) {
        await api.companies.update(companyId, companyForm);
      } else {
        const res = await api.companies.create(companyForm);
        companyId = res.id;
      }
      
      if (modalStep === 1) {
        setShowCreateModal(false);
        fetchMarketplaceData();
        toast.success(companyForm.id ? 'Entreprise mise à jour' : 'Entreprise créée');
      } else if (modalStep === 2) {
        setShowCreateModal(false);
        setModalStep(1);
        fetchMarketplaceData();
        toast.success('Boutique activée !');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myCompany) return;

    try {
      await api.companies.addProduct(myCompany.id, {
        ...productForm
      });
      setProductForm({ name: '', description: '', price: '', category: '', imageUrls: [] });
      toast.success('Produit ajouté !');
      fetchMarketplaceData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'ajout du produit');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette entreprise ?')) return;
    try {
      await api.companies.delete(id);
      if (selectedCompanyId === id) setSelectedCompanyId(null);
      fetchMarketplaceData();
      toast.success('Entreprise supprimée');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleFavorite = async (companyId: number) => {
    const isFavorite = favoriteCompanies.some(c => c.id === companyId);
    try {
      if (isFavorite) {
        await api.companies.unfavorite(companyId);
        setFavoriteCompanies(prev => prev.filter(c => c.id !== companyId));
        toast.success('Retiré des favoris');
      } else {
        await api.companies.favorite(companyId);
        const company = companies.find(c => c.id === companyId);
        if (company) {
          setFavoriteCompanies(prev => [...prev, company]);
        }
        toast.success('Ajouté aux favoris');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'ajout aux favoris');
    }
  };

  const handleToggleProductFavorite = async (product: any) => {
    try {
      const isFav = favoriteProducts.some(p => p.id === product.id);
      if (isFav) {
        await api.companies.unfavoriteProduct(product.id);
        setFavoriteProducts(prev => prev.filter(p => p.id !== product.id));
        toast.success("Retiré des favoris");
      } else {
        await api.companies.favoriteProduct(product.id);
        setFavoriteProducts(prev => [...prev, product]);
        toast.success("Ajouté aux favoris");
      }
      
      const updateList = (list: any[]) => list.map(p => 
        p.id === product.id 
          ? { ...p, isFavorite: !isFav, favoritesCount: (p.favoritesCount || 0) + (isFav ? -1 : 1) } 
          : p
      );
      
      setRecentProducts(prev => updateList(prev));
      // If favoriteProducts is used directly in render, it's already updated, 
      // but if we show counts there too:
      setFavoriteProducts(prev => updateList(prev));
    } catch (err) {
      toast.error("Une erreur est survenue");
    }
  };

  const handleShareAction = async (product: any, platform: 'whatsapp' | 'facebook' | 'linkedin' | 'link') => {
    try {
      await api.companies.shareProduct(product.id);
      
      const updateList = (list: any[]) => list.map(p => 
        p.id === product.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p
      );
      setRecentProducts(prev => updateList(prev));
      setFavoriteProducts(prev => updateList(prev));

      if (platform === 'whatsapp') shareOnWhatsApp(product);
      else if (platform === 'facebook') shareOnFacebook(product);
      else if (platform === 'linkedin') shareOnLinkedIn(product);
      else if (platform === 'link') copyProductLink(product);
    } catch (err) {
      console.error(err);
    }
  };

  const shareOnWhatsApp = (product: any) => {
    const text = `Découvrez ${product.name} sur ${product.companyName} !\n\nPrix: ${product.price} FCFA\n${window.location.origin}/business/${product.companyId}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOnFacebook = (product: any) => {
    const url = `${window.location.origin}/business/${product.companyId}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnLinkedIn = (product: any) => {
    const url = `${window.location.origin}/business/${product.companyId}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const copyProductLink = (product: any) => {
    const url = `${window.location.origin}/business/${product.companyId}?product=${product.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('Tous');
  const [followersFilter, setFollowersFilter] = useState(0);
  const [activeMarketplaceTab, setActiveMarketplaceTab] = useState<'shops' | 'reservations' | 'companies'>('shops');

  const filteredCompanies = companies.filter(c => 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (sectorFilter === 'Tous' || c.sector === sectorFilter) &&
    ((c.followers || 0) >= followersFilter) &&
    (activeMarketplaceTab === 'shops' ? c.isShop === 1 : 
     activeMarketplaceTab === 'reservations' ? ['Transport', 'Hébergement'].includes(c.domaine) : 
     c.isShop !== 1 && !['Transport', 'Hébergement'].includes(c.domaine))
  );

  const filteredTrending = trendingCompanies.filter(c => 
    (activeMarketplaceTab === 'shops' ? c.isShop === 1 : c.isShop !== 1)
  );
  
  const filteredNew = newCompanies.filter(c => 
    (activeMarketplaceTab === 'shops' ? c.isShop === 1 : c.isShop !== 1)
  );

  const sectors = ['Tous', ...Array.from(new Set(companies.map(c => c.sector)))];

  const MarketplaceSection = ({ title, subtitle, children }: { title: string, subtitle?: string, children: React.ReactNode }) => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between px-1 gap-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-slate-500 font-medium text-sm">{subtitle}</p>}
        </div>
        <button className="text-primary font-bold text-sm hover:underline">Voir tout</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      {showAdWizard && myCompany && (
        <AdsCreationWizard 
          company={myCompany} 
          onClose={() => setShowAdWizard(false)} 
          onComplete={() => {
            setShowAdWizard(false);
            toast.success('Publicité créée avec succès !');
          }}
        />
      )}
      <div className="max-w-[1850px] mx-auto p-4 md:p-8">
        {showFinance ? (
        <FinancePage onBack={() => setShowFinance(false)} />
      ) : selectedCompanyId ? (
        <BusinessDetail 
          company={companies.find(c => c.id === selectedCompanyId)} 
          onBack={() => {
            setSelectedCompanyId(null);
            setInitialShowDashboard(false);
            setInitialDashboardTab(undefined);
          }} 
          currentUser={currentUser}
          initialShowDashboard={initialShowDashboard}
          initialDashboardTab={initialDashboardTab}
          onEdit={(company) => {
            setCompanyForm(company);
            setShowCreateModal(true);
            setModalStep(1);
          }}
          onDelete={handleDelete}
          onActivateShop={() => {
            setCompanyForm(myCompany);
            setShowCreateModal(true);
            setModalStep(2);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
          <div className="lg:col-span-9 space-y-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Marketplace</h1>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => setShowFinance(true)}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  title="Finance"
                >
                  <CreditCard size={20} />
                </button>
                {myCompany ? (
                  <button 
                    onClick={() => {
                      setSelectedCompanyId(myCompany.id);
                      addToHistory(myCompany.id);
                    }}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                  >
                    <Building2 size={18} />
                    {myCompany.ownerId === currentUser?.id ? 'Ma Boutique' : 'Ma Gestion'}
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      const amIManager = companies.some(c => c.managerId === currentUser?.id);
                      if (amIManager) {
                        toast.error('Un gestionnaire ne peut pas créer sa propre boutique tant qu\'il occupe ce poste.', {
                          icon: '🚫'
                        });
                        return;
                      }
                      setShowCreateModal(true);
                    }}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                  >
                    <Plus size={18} />
                    Créer
                  </button>
                )}
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Rechercher un produit, une boutique..." 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {sectors.map(s => (
                  <button
                    key={s}
                    onClick={() => setSectorFilter(s)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                      sectorFilter === s 
                      ? 'bg-primary text-white shadow-md shadow-primary/20' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                onClick={() => setActiveMarketplaceTab('shops')}
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all ${activeMarketplaceTab === 'shops' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Boutiques
              </button>
              <button 
                onClick={() => setActiveMarketplaceTab('reservations')}
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all ${activeMarketplaceTab === 'reservations' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Réservation
              </button>
              <button 
                onClick={() => setActiveMarketplaceTab('companies')}
                className={`flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all ${activeMarketplaceTab === 'companies' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Entreprises
              </button>
            </div>

            {/* AI Suggestions Section */}
            <ProductSuggestions 
              products={recentProducts} 
              onSelectProduct={(product) => {
                setSelectedCompanyId(product.companyId);
                addToHistory(product.companyId);
              }}
              onToggleFavorite={handleToggleProductFavorite}
              onShare={(product) => setSharingProduct(product)}
            />

            {/* 1. Produits Récents */}
            <MarketplaceSection 
              title="Produits Récents" 
              subtitle="Découvrez les dernières nouveautés ajoutées par nos vendeurs locaux."
            >
              {recentProducts.length > 0 ? recentProducts.map(product => {
                let imageUrl = '';
                try {
                  const urls = product.imageUrls ? JSON.parse(product.imageUrls) : null;
                  imageUrl = (urls && Array.isArray(urls) && urls[0]) || product.imageUrl;
                } catch(e) {}
                
                return (
                  <motion.div 
                    key={product.id}
                    whileHover={{ y: -5 }}
                    className="min-w-[200px] w-[200px] bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm group relative"
                  >
                    <div className="aspect-square bg-slate-50 relative overflow-hidden cursor-zoom-in" onClick={() => imageUrl && setFullscreenImage(imageUrl)}>
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon size={40} />
                        </div>
                      )}
                      
                      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleToggleProductFavorite(product); }}
                          className={`p-1.5 rounded-full shadow-sm backdrop-blur-md transition-all ${product.isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-600 hover:text-red-500'}`}
                        >
                          <Heart size={14} fill={product.isFavorite ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSharingProduct(product); }}
                          className="p-1.5 bg-white/90 backdrop-blur-md rounded-full text-slate-600 hover:text-primary shadow-sm"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>

                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black text-slate-900 shadow-sm flex items-center gap-2">
                        <span>NOUVEAU</span>
                      </div>
                      
                      {/* Compteurs */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black text-slate-900 shadow-sm">
                          <Heart size={10} fill={product.isFavorite ? "currentColor" : "none"} className={product.isFavorite ? "text-red-500" : ""} />
                          <span>{product.favoritesCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black text-slate-900 shadow-sm">
                          <Share2 size={10} />
                          <span>{product.shares_count || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-1 cursor-pointer" onClick={() => { setSelectedCompanyId(product.companyId); addToHistory(product.companyId); }}>
                      <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest truncate">{product.companyName}</p>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex flex-col">
                          {(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue && (
                            <span className="text-slate-400 font-medium text-xs line-through">{product.price.toLocaleString()} F</span>
                          )}
                          <span className="text-slate-900 font-black text-sm">
                            {(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue 
                              ? (product.price * (1 - parseInt(product.tagValue) / 100)).toLocaleString() 
                              : product.price.toLocaleString()} F
                          </span>
                        </div>
                        <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                          <Plus size={14} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="w-full py-12 text-center bg-slate-50 rounded-3xl border-2 border-solid border-slate-200">
                  <Sparkles className="mx-auto mb-2 text-slate-300" size={32} />
                  <p className="text-slate-500 font-medium">Aucun produit récent pour le moment</p>
                </div>
              )}
            </MarketplaceSection>

            {/* 1.1 Mes Produits Favoris */}
            {favoriteProducts.length > 0 && (
              <MarketplaceSection 
                title="Mes Favoris" 
                subtitle="Retrouvez ici tous vos coups de cœur."
              >
                {favoriteProducts.map(product => {
                  let imageUrl = '';
                  try {
                    const urls = product.imageUrls ? JSON.parse(product.imageUrls) : null;
                    imageUrl = (urls && Array.isArray(urls) && urls[0]) || product.imageUrl;
                  } catch(e) {}
                  
                  return (
                    <motion.div 
                      key={product.id}
                      whileHover={{ y: -5 }}
                      className="min-w-[200px] w-[200px] bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm group relative"
                    >
                      <div className="aspect-square bg-slate-50 relative overflow-hidden cursor-zoom-in" onClick={() => imageUrl && setFullscreenImage(imageUrl)}>
                        {imageUrl ? (
                          <img 
                            src={imageUrl} 
                            alt={product.name} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={40} />
                          </div>
                        )}
                        
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleProductFavorite(product); }}
                            className="p-1.5 rounded-full shadow-sm backdrop-blur-md bg-red-500 text-white"
                          >
                            <Heart size={14} fill="currentColor" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSharingProduct(product); }}
                            className="p-1.5 bg-white/90 backdrop-blur-md rounded-full text-slate-600 hover:text-primary shadow-sm"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                        
                        {/* Compteurs */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-2 text-white">
                          <div className="flex items-center gap-1 bg-slate-900/40 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black shadow-sm">
                            <Heart size={10} fill="currentColor" className="text-red-500" />
                            <span>{product.favoritesCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 bg-slate-900/40 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-black shadow-sm">
                            <Share2 size={10} />
                            <span>{product.shares_count || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-1 cursor-pointer" onClick={() => { setSelectedCompanyId(product.companyId); addToHistory(product.companyId); }}>
                        <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest truncate">{product.companyName}</p>
                          {product.averageRating > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Star size={10} className="fill-yellow-400 text-yellow-400" />
                              <span className="text-[10px] font-bold text-slate-400">{product.averageRating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-900 font-black text-sm">{product.price.toLocaleString()} F</span>
                          <div className="w-7 h-7 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                            <Plus size={14} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </MarketplaceSection>
            )}

            {/* 2. Boutiques en vedette (Trending) */}
            <MarketplaceSection title="Boutiques en vedette">
              {filteredTrending.map(company => (
                <motion.div 
                  key={company.id}
                  whileHover={{ y: -5 }}
                  className="min-w-[280px] w-[280px] bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm cursor-pointer"
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    addToHistory(company.id);
                  }}
                >
                  <div className="h-24 bg-slate-100 relative">
                    {company.coverUrl && <img src={company.coverUrl} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />}
                    <div className="absolute -bottom-6 left-6 w-12 h-12 bg-white rounded-2xl shadow-md p-1">
                      <div className="w-full h-full bg-primary/10 rounded-xl flex items-center justify-center text-primary overflow-hidden">
                        {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Building2 size={20} />}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 pt-8 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-900 text-lg">{company.name}</h4>
                        {company.averageRating > 0 && (
                          <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-lg">
                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-bold text-yellow-700">{company.averageRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">{company.sector}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1"><Users size={14} /> {company.followers || 0}</span>
                      <span className="flex items-center gap-1"><ShoppingBag size={14} /> {company.isShop ? 'Boutique' : 'Entreprise'}</span>
                    </div>
                    <button className="w-full py-2.5 bg-slate-50 text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors">
                      Visiter
                    </button>
                  </div>
                </motion.div>
              ))}
            </MarketplaceSection>

            {/* 4. Nouvelles boutiques */}
            <MarketplaceSection title="Nouvelles boutiques">
              {filteredNew.map(company => (
                <div 
                  key={company.id}
                  className="min-w-[160px] w-[160px] flex flex-col items-center gap-3 cursor-pointer group"
                  onClick={() => {
                    setSelectedCompanyId(company.id);
                    addToHistory(company.id);
                  }}
                >
                  <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm border border-slate-100 p-1 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-full h-full bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-400 overflow-hidden">
                      {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Building2 size={32} />}
                    </div>
                  </div>
                  <div className="text-center">
                    <h4 className="font-bold text-slate-900 text-sm truncate w-full px-2">{company.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{company.sector}</p>
                  </div>
                </div>
              ))}
            </MarketplaceSection>

            {/* Interactive Map Section */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Carte des entreprises</h2>
              </div>
              <BusinessMap 
                companies={companies} 
                onSelectCompany={(id) => {
                  setSelectedCompanyId(id);
                  addToHistory(id);
                }} 
              />
            </div>

            {/* Full Directory (Filtered) */}
            <div id="directory-section" className="space-y-6 pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Toutes les entreprises</h2>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <input 
                    type="number"
                    placeholder="Min. abonnés"
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    value={followersFilter || ''}
                    onChange={(e) => setFollowersFilter(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredCompanies.map(company => (
                  <div 
                    key={company.id} 
                    className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedCompanyId(company.id);
                      addToHistory(company.id);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary overflow-hidden shrink-0">
                        {company.logoUrl ? <img src={company.logoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Building2 size={24} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{company.name}</h3>
                        <p className="text-xs text-slate-500 truncate">{company.sector}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(company.id); }}
                        className={`p-2 rounded-full transition-colors ${favoriteCompanies.some(c => c.id === company.id) ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        <Heart size={18} className={favoriteCompanies.some(c => c.id === company.id) ? 'fill-current' : ''} />
                      </button>
                      <ChevronRight size={20} className="text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Widget (Desktop) / History Section (Mobile) */}
          <div className="lg:col-span-3 space-y-8">
            <div className="sticky top-8">
                  <BusinessHistory 
                    favoriteCompanies={favoriteCompanies} 
                    recentCompanies={(() => {
                      const history = localStorage.getItem('business_view_history');
                      const ids: number[] = history ? JSON.parse(history) : [];
                      return ids.map(id => companies.find(c => c.id === id)).filter(Boolean);
                    })()}
                    onSelectCompany={(id) => {
                      setSelectedCompanyId(id);
                      addToHistory(id);
                    }} 
                  />

                  {myCompany && (
                    <div className="mt-8 p-8 bg-emerald-900 rounded-[40px] text-white space-y-4 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Award size={100} />
                      </div>
                      <div className="relative z-10">
                        <Sparkles className="text-emerald-400 mb-4" size={32} />
                        <h3 className="text-xl font-black leading-tight text-white">Votre Score de Financement</h3>
                        <p className="text-emerald-300/80 text-sm font-medium leading-relaxed mt-2">
                          Analysez votre éligibilité au crédit et déposez votre dossier en un clic.
                        </p>
                        <button 
                          onClick={() => {
                            setSelectedCompanyId(myCompany.id);
                            setInitialShowDashboard(true);
                            setInitialDashboardTab('score');
                          }}
                          className="w-full mt-6 py-4 bg-white text-emerald-900 rounded-2xl font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus size={18} />
                          +Analyser
                        </button>
                      </div>
                    </div>
                  )}
              
              {/* Additional Desktop Widgets could go here */}
              <div className="mt-8 p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] text-white space-y-4 shadow-xl">
                <Sparkles className="text-primary" size={32} />
                <h3 className="text-xl font-black leading-tight text-white">Boostez votre visibilité</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Mettez votre entreprise en avant et touchez plus de clients potentiels dans votre région.
                </p>
                <button 
                  onClick={() => setShowAdWizard(true)}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
                >
                  Démarrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Create/Shop Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] w-full max-w-2xl p-6 sm:p-10 shadow-2xl my-8 relative"
          >
            <button 
              onClick={() => {
                setShowCreateModal(false);
                setModalStep(1);
              }} 
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Plus size={24} className="rotate-45 text-slate-400" />
            </button>

            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
                {modalStep === 1 ? (companyForm.id ? 'Modifier mon entreprise' : 'Créer mon entreprise') : 
                 'Activer ma boutique'}
              </h2>
              <p className="text-slate-500 font-medium">
                {modalStep === 1 ? 'Étape 1: Informations générales' : 
                 'Étape 2: Configuration de la boutique'}
              </p>
              
              {/* Progress Bar */}
              <div className="flex gap-2 mt-6">
                {[1, 2].map(s => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= modalStep ? 'bg-primary' : 'bg-slate-100'}`} />
                ))}
              </div>
            </div>

            {modalStep === 1 && (
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo (JPEG/PNG)</label>
                    <div className="aspect-square border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden hover:bg-slate-50 transition-colors group">
                      {companyForm.logoUrl ? (
                        <img src={companyForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="mx-auto mb-2 text-slate-300" size={32} />
                          <span className="text-xs font-bold text-slate-400">Choisir</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Couverture (JPEG/PNG)</label>
                    <div className="aspect-[2/1] border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden hover:bg-slate-50 transition-colors group">
                      {companyForm.coverUrl ? (
                        <img src={companyForm.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="mx-auto mb-2 text-slate-300" size={32} />
                          <span className="text-xs font-bold text-slate-400">Choisir</span>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverUrl')} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de l'entreprise</label>
                    <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: JCE Tech" value={companyForm.name || ''} onChange={e => setCompanyForm({...companyForm, name: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Domaine d'activité</label>
                    <select required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" value={companyForm.domaine || 'Produits'} onChange={e => setCompanyForm({...companyForm, domaine: e.target.value})}>
                      <option value="Produits">Produits</option>
                      <option value="Transport">Transport</option>
                      <option value="Hébergement">Hébergement</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secteur d'activité</label>
                    <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: Technologie" value={companyForm.sector || ''} onChange={e => setCompanyForm({...companyForm, sector: e.target.value})} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Décrivez votre activité..." rows={3} value={companyForm.description || ''} onChange={e => setCompanyForm({...companyForm, description: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adresse</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: Abidjan, Cocody" value={companyForm.address || ''} onChange={e => setCompanyForm({...companyForm, address: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                    <input className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: +225..." value={companyForm.whatsapp || ''} onChange={e => setCompanyForm({...companyForm, whatsapp: e.target.value})} />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Annuler</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                    {isSaving ? 'Enregistrement...' : 'Valider'}
                  </button>
                </div>
              </form>
            )}

            {modalStep === 2 && (
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Spécialité de la boutique</label>
                  <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: Vêtements de luxe, High-tech..." value={companyForm.specialty || ''} onChange={e => setCompanyForm({...companyForm, specialty: e.target.value, isShop: 1})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégories de produits (séparées par des virgules)</label>
                  <input required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-primary/20 transition-all font-medium" placeholder="Ex: Homme, Femme, Accessoires" value={companyForm.categories || ''} onChange={e => setCompanyForm({...companyForm, categories: e.target.value})} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setModalStep(1)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Retour</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : null}
                    {isSaving ? 'Activation...' : 'Activer la boutique'}
                  </button>
                </div>
              </form>
            )}


          </motion.div>
        </div>
      )}

      {/* Modal Partage */}
      <AnimatePresence>
        {sharingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingProduct(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Partager</h2>
                    <p className="text-slate-500 font-medium mt-1">Faites découvrir ce produit</p>
                  </div>
                  <button 
                    onClick={() => setSharingProduct(null)}
                    className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleShareAction(sharingProduct, 'whatsapp')}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                  >
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <MessageCircle size={24} />
                    </div>
                    <span className="text-xs font-bold">WhatsApp</span>
                  </button>

                  <button 
                    onClick={() => handleShareAction(sharingProduct, 'facebook')}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                  >
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Facebook size={24} />
                    </div>
                    <span className="text-xs font-bold">Facebook</span>
                  </button>

                  <button 
                    onClick={() => handleShareAction(sharingProduct, 'linkedin')}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-all"
                  >
                    <div className="w-12 h-12 bg-cyan-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                      <Linkedin size={24} />
                    </div>
                    <span className="text-xs font-bold">LinkedIn</span>
                  </button>

                  <button 
                    onClick={() => handleShareAction(sharingProduct, 'link')}
                    className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                  >
                    <div className="w-12 h-12 bg-slate-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-500/20">
                      <Link size={24} />
                    </div>
                    <span className="text-xs font-bold">Lien</span>
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-4">Aperçu du produit</p>
                  <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl text-left border border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-white overflow-hidden shadow-sm shrink-0">
                      {(() => {
                        let url = '';
                        try {
                          const urls = sharingProduct.imageUrls ? JSON.parse(sharingProduct.imageUrls) : null;
                          url = (urls && Array.isArray(urls) && urls[0]) || sharingProduct.imageUrl;
                        } catch(e) {}
                        
                        return url ? (
                          <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package className="w-full h-full p-2.5 text-slate-200" />
                        );
                      })()}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{sharingProduct.name}</h4>
                      <p className="text-xs text-primary font-black">{sharingProduct.price} F</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullscreenImage(null)}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-full flex items-center justify-center"
            >
              <img 
                src={fullscreenImage} 
                alt="Full size" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
              />
              <button 
                onClick={() => setFullscreenImage(null)}
                className="absolute -top-4 -right-4 md:top-0 md:right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
