import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Building2, Users, Phone, ExternalLink, Edit3, Trash2, ShoppingBag, MapPin, Tag, Package, LayoutDashboard, Eye, ShoppingCart, X, MessageCircle, UserX, Loader2, Heart, Share2, Facebook, Linkedin, Link, Star } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import ShopDashboard from '../components/ShopDashboard';
import ReservationUI from '../components/ReservationUI';
import Reviews from '../components/Reviews';

interface BusinessDetailProps {
  company: any;
  onBack: () => void;
  currentUser: any;
  onEdit: (company: any) => void;
  onDelete: (id: number) => void;
  onActivateShop?: () => void;
  initialShowDashboard?: boolean;
  initialDashboardTab?: 'shops' | 'orders' | 'stock' | 'dashboard' | 'assistant' | 'score';
}

export default function BusinessDetail({ 
  company, 
  onBack, 
  currentUser, 
  onEdit, 
  onDelete, 
  onActivateShop,
  initialShowDashboard,
  initialDashboardTab
}: BusinessDetailProps) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDashboard, setShowDashboard] = useState(initialShowDashboard || false);
  const [dashboardTab, setDashboardTab] = useState<'shops' | 'orders' | 'stock' | 'dashboard' | 'assistant' | 'score' | undefined>(initialDashboardTab);
  
  const [cart, setCart] = useState<any[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [quickBuyProduct, setQuickBuyProduct] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [isUpdatingManager, setIsUpdatingManager] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const [sharingProduct, setSharingProduct] = useState<any>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [companyStats, setCompanyStats] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(company.isFavorite);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentImageIndexForModal, setCurrentImageIndexForModal] = useState(0);

  useEffect(() => {
    if (company?.id) {
      fetchCatalog();
      fetchCompanyStats();
      if (company.ownerId === currentUser?.id) {
        fetchConnections();
      }
    }
    if (initialShowDashboard) {
      setShowDashboard(true);
    }
  }, [company?.id, initialShowDashboard, currentUser?.id]);

  const fetchConnections = async () => {
    try {
      const data = await api.users.getConnections();
      setConnections(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const data = await api.companies.getCatalog(company.id);
      setCatalog(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyStats = async () => {
    try {
      const data = await api.reviews.get('company', company.id);
      setCompanyStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  };

  if (!company) return <div>Entreprise introuvable</div>;

  const getPriceDetails = (product: any) => {
    const basePrice = Number(product.price);
    const tagVal = Number(product.tagValue || 0);
    
    let discount = 0;
    if (product.tag === 'Promotion' || product.tag === 'Offre flash') {
      discount = basePrice * (tagVal / 100);
    } else if (tagVal > 0) {
      discount = tagVal;
    }
    
    return {
      basePrice,
      discount,
      finalPrice: basePrice - discount
    };
  };

  const isOwner = company.ownerId === currentUser?.id;
  const isManager = company.managerId === currentUser?.id;
  const isAuthorized = isOwner || isManager;

  const handleOrder = async (product: any) => {
    try {
      const { finalPrice } = getPriceDetails(product);
      // Create order record for tracking
      await api.companies.createOrder(company.id, {
        productId: product.id,
        quantity: 1,
        totalPrice: finalPrice
      });
      
      const message = `Bonjour, je suis intéressé par votre produit : ${product.name} (${finalPrice} FCFA)`;
      window.open(`https://wa.me/${company.whatsapp?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création de la commande');
    }
  };

  const handleQuickBuy = (product: any) => {
    setQuickBuyProduct(product);
    setTimeout(() => {
      setQuickBuyProduct(null);
    }, 5000);
  };

  if (showDashboard && isAuthorized) {
    return <ShopDashboard company={company} initialTab={dashboardTab} onClose={() => {
      setShowDashboard(false);
      setDashboardTab(undefined);
      fetchCatalog(); // Refresh catalog when returning
    }} />;
  }

  const toggleFollow = async () => {
    try {
      if (isFollowing) {
        await api.companies.unfavorite(company.id);
        setIsFollowing(false);
        toast.success('Retiré des favoris');
      } else {
        await api.companies.favorite(company.id);
        setIsFollowing(true);
        toast.success('Ajouté aux favoris');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdateManager = async (managerId: number | null) => {
    if (isUpdatingManager) return;
    setIsUpdatingManager(true);
    
    const promise = api.companies.updateManager(company.id, managerId);
    
    toast.promise(promise, {
      loading: managerId ? 'Désignation en cours...' : 'Révocation en cours...',
      success: () => {
        setTimeout(() => window.location.reload(), 800);
        return managerId ? 'Gestionnaire désigné avec succès' : 'Gestionnaire révoqué';
      },
      error: 'Erreur lors de la mise à jour du gestionnaire',
    });

    try {
      await promise;
      setShowManagerModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingManager(false);
    }
  };

  const handleResign = async () => {
    if (isResigning) return;
    if (!confirm('Voulez-vous vraiment renoncer à votre rôle de gestionnaire pour cette boutique ?')) return;
    
    setIsResigning(true);
    const promise = api.companies.resignManager(company.id);
    
    toast.promise(promise, {
      loading: 'Traitement de votre démission...',
      success: () => {
        setTimeout(() => window.location.reload(), 800);
        return 'Vous n\'êtes plus gestionnaire de cette boutique';
      },
      error: 'Erreur lors de la résiliation du rôle',
    });

    try {
      await promise;
    } catch (err) {
      console.error(err);
    } finally {
      setIsResigning(false);
    }
  };

  const handleToggleFavoriteProduct = async (product: any) => {
    try {
      const isFav = product.isFavorite;
      if (isFav) {
        await api.companies.unfavoriteProduct(product.id);
        toast.success("Retiré des favoris");
      } else {
        await api.companies.favoriteProduct(product.id);
        toast.success("Ajouté aux favoris");
      }
      setCatalog(catalog.map(p => p.id === product.id ? { 
        ...p, 
        isFavorite: !isFav,
        favoritesCount: (p.favoritesCount || 0) + (isFav ? -1 : 1)
      } : p));
    } catch (err) {
      toast.error("Une erreur est survenue");
    }
  };

  const handleShareAction = async (product: any, platform: 'whatsapp' | 'facebook' | 'linkedin' | 'link') => {
    try {
      await api.companies.shareProduct(product.id);
      setCatalog(catalog.map(p => p.id === product.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p));
      
      if (platform === 'whatsapp') shareOnWhatsApp(product);
      else if (platform === 'facebook') shareOnFacebook(product);
      else if (platform === 'linkedin') shareOnLinkedIn(product);
      else if (platform === 'link') copyProductLink(product);
    } catch (err) {
      console.error(err);
    }
  };

  const shareOnWhatsApp = (product: any) => {
    const text = `Découvrez ${product.name} sur ${company.name} !\n\nPrix: ${product.price} FCFA\n${window.location.origin}/business/${company.id}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOnFacebook = (product: any) => {
    const url = `${window.location.origin}/business/${company.id}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const shareOnLinkedIn = (product: any) => {
    const url = `${window.location.origin}/business/${company.id}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  };

  const copyProductLink = (product: any) => {
    const url = `${window.location.origin}/business/${company.id}?product=${product.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  };


  // Fix: Ensure catalog is an array
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const categories = Array.from(new Set(safeCatalog.map(p => p.category).filter(Boolean)));
  
  const filteredCatalog = safeCatalog.filter(p => {
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;
    const matchesSearch = searchQuery 
      ? (p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesCategory && matchesSearch;
  });

  const nouveautes = safeCatalog.filter(p => p.tag === 'Nouveautés');
  const promotions = safeCatalog.filter(p => p.tag === 'Promotion');
  const offresFlash = safeCatalog.filter(p => p.tag === 'Offre flash');
  const bestSellers = safeCatalog.filter(p => p.tag === 'Best-seller');

  // Utils
const safeParseImages = (jsonStr: string) => {
    try {
      if (!jsonStr) return [];
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse imageUrls:', e);
      return [];
    }
  };

const ProductCard = ({ product, isVitrine, setFullscreenImage, handleToggleFavoriteProduct, setSharingProduct, handleQuickBuy, setSelectedProduct, setQuantity }: any) => {
  const images = safeParseImages(product.imageUrls);
  const [imageIndex, setImageIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div 
      key={product.id}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col relative border border-slate-100/50 ${isVitrine ? 'min-w-[280px] w-[280px]' : ''}`}
    >
      <div className="aspect-[4/3] sm:aspect-square bg-slate-100 relative overflow-hidden cursor-zoom-in" onClick={() => images.length > 0 && setFullscreenImage(images[imageIndex])}>
        {images.length > 0 ? (
          <>
            <img src={images[imageIndex]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            
            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/50 p-1 rounded-full text-slate-700 hover:text-primary"><ChevronLeft size={16}/></button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/50 p-1 rounded-full text-slate-700 hover:text-primary"><ChevronRight size={16}/></button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full">
                  {imageIndex + 1} / {images.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50">
            <Package size={48} />
          </div>
        )}
        
        {/* Category Badge */}
        <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black text-primary uppercase tracking-widest shadow-sm">
          {product.category}
        </div>

        {/* Tag Badge */}
        {product.quantity === 0 && (
           <div className="absolute top-3 left-3 px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
             Rupture de stock
           </div>
        )}
        {product.tag && product.quantity > 0 && (
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm text-white ${
            product.tag === 'Nouveautés' ? 'bg-blue-500' :
            product.tag === 'Promotion' ? 'bg-orange-500' :
            product.tag === 'Best-seller' ? 'bg-emerald-500' :
            'bg-red-500'
          }`}>
            {product.tag} {product.tagValue ? (product.tag === 'Promotion' ? `-${product.tagValue}%` : `${product.tagValue}F`) : ''}
          </div>
        )}

        {/* Action Buttons Overlay */}
        <div className={`absolute ${product.tag ? 'top-12' : 'top-3'} right-3 flex flex-col gap-2`}>
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); setQuantity(1); }}
            className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-700 hover:text-primary hover:scale-110 transition-all shadow-sm"
          >
            <Eye size={18} />
          </button>
          {product.quantity > 0 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleToggleFavoriteProduct(product); }}
                className={`w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center transition-all shadow-sm ${product.isFavorite ? 'text-red-500' : 'text-slate-700 hover:text-red-500 hover:scale-110'}`}
              >
                <Heart size={18} fill={product.isFavorite ? "currentColor" : "none"} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setSharingProduct(product); }}
                className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-slate-700 hover:text-blue-500 hover:scale-110 transition-all shadow-sm"
              >
                <Share2 size={18} />
              </button>
            </>
          )}
        </div>

        {/* Compteurs */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-black text-slate-900 shadow-sm border border-slate-100">
            <Heart size={10} fill={product.isFavorite ? "currentColor" : "none"} className={product.isFavorite ? "text-red-500" : ""} />
            <span>{product.favoritesCount || 0}</span>
          </div>
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[10px] font-black text-slate-900 shadow-sm border border-slate-100">
            <Share2 size={10} />
            <span>{product.shares_count || 0}</span>
          </div>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col bg-white">
        <div className="flex justify-between items-start mb-1 gap-2">
          <h3 className="font-bold text-slate-900 text-lg line-clamp-1">{product.name}</h3>
          <div className="flex flex-col items-end">
            {(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue && (
              <span className="text-xs text-slate-400 line-through">
                {product.price.toLocaleString()} FCFA
              </span>
            )}
            <span className="font-black text-primary whitespace-nowrap">
              {(product.tag === 'Promotion' || product.tag === 'Offre flash') && product.tagValue 
                ? (product.price * (1 - parseInt(product.tagValue) / 100)).toLocaleString() 
                : product.price.toLocaleString()} FCFA
            </span>
          </div>
        </div>
        
        {product.averageRating > 0 && (
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={10}
                  className={star <= Math.round(product.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-400">({product.reviewCount})</span>
          </div>
        )}

        <p className="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{product.description}</p>
        
        <button 
          onClick={() => handleQuickBuy(product)}
          disabled={product.quantity === 0}
          className={`w-full py-3.5 ${product.quantity === 0 ? 'bg-slate-300' : 'bg-slate-900'} text-white rounded-xl text-sm font-black uppercase tracking-widest hover:${product.quantity === 0 ? 'bg-slate-300' : 'bg-slate-800'} transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2`}
        >
          <ShoppingCart size={18} />
          {product.quantity === 0 ? 'Rupture' : 'Acheter'}
        </button>
      </div>
    </motion.div>
  );
};

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        {/* Cover Photo */}
        <div className="h-64 bg-slate-200 relative">
          {company.coverUrl ? (
            <img src={company.coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/20 to-blue-500/20" />
          )}
          <button onClick={onBack} className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          
          {isOwner && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => onEdit(company)} className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white text-slate-700 transition-colors shadow-sm">
                <Edit3 size={20} />
              </button>
              <button onClick={() => onDelete(company.id)} className="p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-red-50 text-red-500 transition-colors shadow-sm">
                <Trash2 size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 sm:-mt-20 mb-6">
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-[32px] shadow-xl flex items-center justify-center text-primary border-4 border-white overflow-hidden shrink-0">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 size={48} className="sm:scale-125" />
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">{company.name}</h1>
                {companyStats && companyStats.reviewCount > 0 && (
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={14}
                          className={star <= Math.round(companyStats.averageRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      {companyStats.averageRating.toFixed(1)} ({companyStats.reviewCount})
                    </span>
                  </div>
                )}
                {company.isShop === 1 && (
                  <div className="flex justify-center sm:block">
                    <span className="px-3 py-1 bg-green-100 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-full">Boutique</span>
                  </div>
                )}
              </div>
              <p className="text-base sm:text-xl text-primary font-bold">{company.sector}</p>
              {company.address && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-500 text-sm mt-1.5 font-medium">
                  <MapPin size={14} />
                  <span>{company.address}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
            {isAuthorized && company.isShop === 1 && (
              <button 
                onClick={() => setShowDashboard(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                <LayoutDashboard size={18} />
                Gérer ma boutique
              </button>
            )}
            {isOwner && (
              <button 
                onClick={() => setShowManagerModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                <Users size={18} />
                Gérer les rôles
              </button>
            )}
            {isOwner && company.isShop === 0 && (
              <button 
                onClick={onActivateShop}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
              >
                <ShoppingBag size={18} />
                Activer ma boutique
              </button>
            )}
            {isManager && (
              <button 
                onClick={handleResign}
                disabled={isResigning}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-red-100 text-red-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-200 transition-all border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResigning ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UserX size={18} />
                )}
                Quitter la gestion
              </button>
            )}
            <button 
              onClick={toggleFollow}
              className={`flex-1 sm:flex-none px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-sm ${
                isFollowing ? 'bg-slate-100 text-slate-700' : 'bg-primary text-white hover:bg-primary-hover'
              }`}
            >
              {isFollowing ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-3 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-3">À propos</h2>
                <div className="relative">
                  <p className={`text-slate-600 leading-relaxed whitespace-pre-wrap ${!showFullDescription ? 'line-clamp-3' : ''}`}>
                    {company.description || "Aucune description fournie."}
                  </p>
                  {company.description && company.description.length > 150 && (
                    <button 
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-primary font-bold text-sm mt-2 hover:underline"
                    >
                      {showFullDescription ? 'Réduire' : 'Tout lire'}
                    </button>
                  )}
                </div>
              </div>

              {company.isShop === 1 && (
                <div className="space-y-12">
                  {['Transport', 'Hébergement'].includes(company.domaine) && <ReservationUI company={company} />}
                  {/* Vitrine Section */}
                  {(nouveautes.length > 0 || promotions.length > 0 || offresFlash.length > 0 || bestSellers.length > 0 || safeCatalog.length > 0) && (
                    <div className="space-y-8">
                      {safeCatalog.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-indigo-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            Produits Populaires
                          </h3>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {[...safeCatalog].sort((a,b) => ((b.favoritesCount || 0) + (b.shares_count || 0)) - ((a.favoritesCount || 0) + (a.shares_count || 0))).slice(0, 5).map(p => (
                              <ProductCard 
                                key={p.id}
                                product={p} 
                                isVitrine={true}
                                handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                                setFullscreenImage={setFullscreenImage}
                                setSharingProduct={setSharingProduct}                
                                handleQuickBuy={handleQuickBuy}
                                setSelectedProduct={setSelectedProduct}
                                setQuantity={setQuantity}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <h2 className="text-2xl font-black text-slate-900">Vitrine</h2>
                      
                      {bestSellers.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-emerald-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Best-sellers
                          </h3>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {bestSellers.map(p => (
                              <ProductCard 
                                key={p.id}
                                product={p} 
                                isVitrine={true}
                                handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                                setFullscreenImage={setFullscreenImage}
                                setSharingProduct={setSharingProduct}                
                                handleQuickBuy={handleQuickBuy}
                                setSelectedProduct={setSelectedProduct}
                                setQuantity={setQuantity}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {nouveautes.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            Nouveautés
                          </h3>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {nouveautes.map(p => (
                              <ProductCard 
                                key={p.id}
                                product={p} 
                                isVitrine={true}
                                handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                                setFullscreenImage={setFullscreenImage}
                                setSharingProduct={setSharingProduct}                
                                handleQuickBuy={handleQuickBuy}
                                setSelectedProduct={setSelectedProduct}
                                setQuantity={setQuantity}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {promotions.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-orange-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            En Promotion
                          </h3>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {promotions.map(p => (
                              <ProductCard 
                                key={p.id}
                                product={p} 
                                isVitrine={true}
                                handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                                setFullscreenImage={setFullscreenImage}
                                setSharingProduct={setSharingProduct}                
                                handleQuickBuy={handleQuickBuy}
                                setSelectedProduct={setSelectedProduct}
                                setQuantity={setQuantity}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {offresFlash.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            Offres Flash
                          </h3>
                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {offresFlash.map(p => (
                              <ProductCard 
                                key={p.id}
                                product={p} 
                                isVitrine={true}
                                handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                                setFullscreenImage={setFullscreenImage}
                                setSharingProduct={setSharingProduct}                
                                handleQuickBuy={handleQuickBuy}
                                setSelectedProduct={setSelectedProduct}
                                setQuantity={setQuantity}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Categories Carousel */}
                  {categories.length > 0 && (
                    <div className="space-y-4">
                      <h2 className="text-xl font-bold text-slate-900">Catégories</h2>
                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button
                          onClick={() => setSelectedCategory(null)}
                          className={`px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                            selectedCategory === null 
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <LayoutDashboard size={16} />
                          Tout voir
                        </button>
                        {categories.map((cat, idx) => {
                          const colors = [
                            'bg-blue-50 text-blue-600 hover:bg-blue-100',
                            'bg-purple-50 text-purple-600 hover:bg-purple-100',
                            'bg-pink-50 text-pink-600 hover:bg-pink-100',
                            'bg-orange-50 text-orange-600 hover:bg-orange-100',
                            'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          ];
                          const activeColors = [
                            'bg-blue-600 text-white shadow-lg shadow-blue-600/20',
                            'bg-purple-600 text-white shadow-lg shadow-purple-600/20',
                            'bg-pink-600 text-white shadow-lg shadow-pink-600/20',
                            'bg-orange-600 text-white shadow-lg shadow-orange-600/20',
                            'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          ];
                          const colorIdx = idx % colors.length;
                          
                          return (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={`px-6 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                                selectedCategory === cat ? activeColors[colorIdx] : colors[colorIdx]
                              }`}
                            >
                              <Tag size={16} />
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h2 className="text-xl font-bold text-slate-900">Catalogue Produits</h2>                
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Rechercher un produit..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Tag className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      </div>                
                      {company.specialty && (
                        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                          <Tag size={16} />
                          <span>Spécialité: {company.specialty}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCatalog.map((product) => (
                        <ProductCard 
                          key={product.id}
                          product={product} 
                          handleToggleFavoriteProduct={handleToggleFavoriteProduct}
                          setFullscreenImage={setFullscreenImage}
                          setSharingProduct={setSharingProduct}                
                          handleQuickBuy={handleQuickBuy}
                          setSelectedProduct={setSelectedProduct}
                          setQuantity={setQuantity}
                        />
                      ))}
                      {filteredCatalog.length === 0 && !loading && (
                        <div className="col-span-full py-12 text-center bg-slate-50 rounded-[32px] border-2 border-solid border-slate-200">
                          <Package className="mx-auto mb-3 text-slate-300" size={48} />
                          <p className="text-slate-500 font-medium">Aucun produit dans cette catégorie.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-1 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                <h3 className="font-bold text-slate-900">Coordonnées</h3>
                
                {company.whatsapp && (
                  <a href={`https://wa.me/${company.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 hover:text-green-600 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <Phone size={18} />
                    </div>
                    <span className="font-medium">{company.whatsapp}</span>
                  </a>
                )}
                
                {company.linkedin && (
                  <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 hover:text-blue-600 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <ExternalLink size={18} />
                    </div>
                    <span className="font-medium truncate">LinkedIn</span>
                  </a>
                )}

                {company.facebook && (
                  <a href={company.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 hover:text-blue-600 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <ExternalLink size={18} />
                    </div>
                    <span className="font-medium truncate">Facebook</span>
                  </a>
                )}
                
                {company.twitter && (
                  <a href={company.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-600 hover:text-blue-400 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                      <ExternalLink size={18} />
                    </div>
                    <span className="font-medium truncate">Twitter</span>
                  </a>
                )}
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary shadow-sm">
                  <Users size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{company.followers || 0}</div>
                  <div className="text-sm text-slate-500 font-medium">Abonnés</div>
                </div>
              </div>

              {/* Section Avis Entreprise */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <Reviews 
                  targetType="company" 
                  targetId={company.id} 
                  currentUser={currentUser} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal (Voir) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="relative h-64 bg-slate-100 cursor-zoom-in" onClick={() => {
                try {
                  const images = selectedProduct.imageUrls ? JSON.parse(selectedProduct.imageUrls) : [];
                  if (Array.isArray(images) && images.length > 0) {
                    setFullscreenImage(images[currentImageIndex]);
                  }
                } catch(e) {}
              }}>
                {(() => {
                  try {
                    const images = selectedProduct.imageUrls ? JSON.parse(selectedProduct.imageUrls) : [];
                    return Array.isArray(images) && images.length > 0 ? (
                      <img src={images[currentImageIndex]} alt={selectedProduct.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package size={48} />
                      </div>
                    );
                  } catch(e) {
                    return <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={48} /></div>;
                  }
                })()}
                <button 
                  onClick={() => {
                    setSelectedProduct(null);
                    setCurrentImageIndex(0);
                  }}
                  className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors z-10"
                >
                  <X size={20} />
                </button>
                {(() => {
                  try {
                    const images = selectedProduct.imageUrls ? JSON.parse(selectedProduct.imageUrls) : [];
                    if (Array.isArray(images) && images.length > 1) {
                      return (
                        <>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors z-10"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors z-10"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {images.map((_: any, idx: number) => (
                              <div 
                                key={idx} 
                                className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                              />
                            ))}
                          </div>
                        </>
                      );
                    }
                  } catch(e) {}
                  return null;
                })()}
              </div>
              <div className="p-6 sm:p-8">
                <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">{selectedProduct.category}</div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedProduct.name}</h2>
                <div className="text-xl font-bold text-slate-900 mb-4">{selectedProduct.price} FCFA</div>
                <p className="text-slate-600 mb-6 text-sm leading-relaxed">{selectedProduct.description}</p>
                
                <div className="flex items-center justify-between mb-6 bg-slate-50 p-2 rounded-2xl">
                  <span className="font-bold text-slate-700 ml-4">Quantité</span>
                  <div className="flex items-center gap-4 bg-white px-2 py-1 rounded-xl shadow-sm border border-slate-100">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-lg"
                    >
                      -
                    </button>
                    <span className="font-bold w-4 text-center">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-lg"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const existingItem = cart.find(item => item.product.id === selectedProduct.id);
                    if (existingItem) {
                      setCart(cart.map(item => item.product.id === selectedProduct.id ? { ...item, quantity: item.quantity + quantity } : item));
                    } else {
                      setCart([...cart, { product: selectedProduct, quantity }]);
                    }
                    toast.success('Ajouté au panier !');
                    setSelectedProduct(null);
                  }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/25 hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  {/* Display price details on button */}
                  {(() => {
                    const { finalPrice } = getPriceDetails(selectedProduct);
                    return `Ajouter au panier - ${finalPrice * quantity} FCFA`;
                  })()}
                </button>

                {/* Section Avis Produit */}
                <div className="mt-6 pt-6 border-t border-slate-100 max-h-[300px] overflow-y-auto scrollbar-hide">
                  <Reviews 
                    targetType="product" 
                    targetId={selectedProduct.id} 
                    currentUser={currentUser} 
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            onClick={() => setShowCartModal(true)}
            className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 bg-slate-900 text-white p-4 rounded-full shadow-2xl z-40 flex items-center gap-3 hover:scale-105 transition-transform"
          >
            <div className="relative">
              <ShoppingCart size={24} />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900">
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            </div>
            <span className="font-bold hidden sm:inline">Mon Panier</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Modal (Invoice) */}
      <AnimatePresence>
        {showCartModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-10">
                <h2 className="text-xl font-black text-slate-900">Facture de la commande</h2>
                <button onClick={() => setShowCartModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                        {(() => {
                           try {
                             const urls = item.product.imageUrls ? JSON.parse(item.product.imageUrls) : null;
                             const firstUrl = Array.isArray(urls) && urls[0];
                             if (firstUrl) return <img src={firstUrl} alt={item.product.name} className="w-full h-full object-cover" />;
                           } catch(e) {}
                           return <Package size={24} className="m-auto mt-3 text-slate-300" />;
                        })()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{item.product.name}</h4>
                        {(() => {
                          const { basePrice, discount, finalPrice } = getPriceDetails(item.product);
                          return (
                            <div className="text-xs">
                              {discount > 0 && <p className="text-slate-400 line-through">{item.product.price} FCFA</p>}
                              <p className="text-slate-600">{item.quantity} x {finalPrice} FCFA</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      {(() => {
                        const { finalPrice } = getPriceDetails(item.product);
                        return `${item.quantity * finalPrice} FCFA`;
                      })()}
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex items-center justify-between text-lg">
                  <span className="font-bold text-slate-500">Total</span>
                  <span className="font-black text-primary">
                    {cart.reduce((acc, item) => {
                      const { finalPrice } = getPriceDetails(item.product);
                      return acc + (item.quantity * finalPrice);
                    }, 0)} FCFA
                  </span>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <button 
                  onClick={async () => {
                    try {
                      // Record each item in the cart as an order
                      for (const item of cart) {
                        const { finalPrice } = getPriceDetails(item.product);
                        await api.companies.createOrder(company.id, {
                          productId: item.product.id,
                          quantity: item.quantity,
                          totalPrice: item.quantity * finalPrice
                        });
                      }
                      
                      const message = `Bonjour, je souhaite passer la commande suivante :\n\n` + 
                        cart.map(item => {
                          const { finalPrice } = getPriceDetails(item.product);
                          return `- ${item.quantity}x ${item.product.name} (${item.quantity * finalPrice} FCFA)`;
                        }).join('\n') +
                        `\n\n*Total : ${cart.reduce((acc, item) => {
                          const { finalPrice } = getPriceDetails(item.product);
                          return acc + (item.quantity * finalPrice);
                        }, 0)} FCFA*`;
                      window.open(`https://wa.me/${company.whatsapp?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                      setCart([]);
                      setShowCartModal(false);
                    } catch (err) {
                      console.error(err);
                      toast.error('Erreur lors de la création de la commande');
                    }
                  }}
                  className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold shadow-lg shadow-[#25D366]/25 hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle size={20} />
                  Commander via WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Buy Popup */}
      <AnimatePresence>
        {quickBuyProduct && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-24 left-1/2 sm:bottom-8 z-[60] w-[90%] max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-50 flex items-center gap-3 bg-slate-50/50">
              <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                {(() => {
                   try {
                     const urls = quickBuyProduct.imageUrls ? JSON.parse(quickBuyProduct.imageUrls) : null;
                     const firstUrl = Array.isArray(urls) && urls[0];
                     if (firstUrl) return <img src={firstUrl} alt={quickBuyProduct.name} className="w-full h-full object-cover" />;
                   } catch(e) {}
                   return <Package size={20} className="m-auto mt-2.5 text-slate-300" />;
                })()}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{quickBuyProduct.name}</h4>
                <p className="text-xs text-slate-500 font-medium">{quickBuyProduct.price} FCFA</p>
              </div>
              <button onClick={() => setQuickBuyProduct(null)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <button 
                onClick={async () => {
                  try {
                    await api.companies.createOrder(company.id, {
                      productId: quickBuyProduct.id,
                      quantity: 1,
                      totalPrice: quickBuyProduct.price
                    });
                    const message = `Bonjour, je souhaite acheter immédiatement ce produit :\n\n- 1x ${quickBuyProduct.name} (${quickBuyProduct.price} FCFA)`;
                    window.open(`https://wa.me/${company.whatsapp?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                    setQuickBuyProduct(null);
                  } catch (err) {
                    console.error(err);
                    toast.error('Erreur lors de la création de la commande');
                  }
                }}
                className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold shadow-md shadow-[#25D366]/20 hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2 text-sm"
              >
                <MessageCircle size={18} />
                Commander via WhatsApp
              </button>
            </div>
            {/* Progress bar for 5 seconds */}
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
              className="h-1 bg-primary"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Gestionnaire */}
      <AnimatePresence>
        {showManagerModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManagerModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des rôles</h2>
                    <p className="text-slate-500 font-medium mt-1">Désignez un gestionnaire pour votre boutique</p>
                  </div>
                  <button 
                    onClick={() => setShowManagerModal(false)}
                    className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <p className="text-sm text-blue-700 leading-relaxed font-medium">
                      Le gestionnaire aura un accès complet à toutes les fonctionnalités de votre boutique : 
                      inventaire, ventes, analyses IA et modification des informations.
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest pl-1">Membres de votre réseau</h3>
                    
                    {connections.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                        <Users className="mx-auto text-slate-300 mb-2" size={32} />
                        <p className="text-slate-500 text-sm font-medium">Aucun contact trouvé dans votre réseau</p>
                      </div>
                    ) : (
                      connections.map((u) => {
                        const isCurrentManager = u.id === company.managerId;
                        return (
                          <div 
                            key={u.id}
                            className={`p-4 rounded-[28px] border-2 transition-all flex items-center justify-between group ${
                              isCurrentManager ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Users className="w-full h-full p-3 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 leading-none mb-1">{u.name}</h4>
                                <p className="text-xs text-slate-500 font-medium line-clamp-1">{u.profession || u.company || 'Profession non renseignée'}</p>
                              </div>
                            </div>
                            
                            <button
                              disabled={isUpdatingManager}
                              onClick={() => handleUpdateManager(isCurrentManager ? null : u.id)}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                isCurrentManager 
                                  ? 'bg-red-50 text-red-500 hover:bg-red-100' 
                                  : 'bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 opacity-0 group-hover:opacity-100'
                              } disabled:opacity-50`}
                            >
                              {isUpdatingManager && (
                                <Loader2 size={12} className="animate-spin" />
                              )}
                              {isCurrentManager ? 'Révoquer' : 'Désigner'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <button 
                    onClick={() => setShowManagerModal(false)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Fermer
                  </button>
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
              <div className="relative group">
                <img 
                  src={fullscreenImage} 
                  alt="Full size" 
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl transition-transform duration-300 cursor-zoom-in group-hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.transform = e.currentTarget.style.transform === 'scale(2)' ? 'scale(1)' : 'scale(2)';
                  }}
                />
              </div>
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
                        try {
                          const urls = sharingProduct.imageUrls ? JSON.parse(sharingProduct.imageUrls) : null;
                          const firstUrl = Array.isArray(urls) && urls[0];
                          if (firstUrl) return <img src={firstUrl} className="w-full h-full object-cover" />;
                        } catch(e) {}
                        return <Package className="w-full h-full p-2.5 text-slate-200" />;
                      })()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{sharingProduct.name}</h4>
                      <p className="text-xs text-primary font-black">{sharingProduct.price} FCFA</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
