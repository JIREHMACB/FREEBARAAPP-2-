import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { 
  Plus, Edit3, X, Search, CreditCard, Building2, Landmark, 
  Target, Clock, FileText, CheckCircle2, ChevronRight, 
  ShieldAlert, Sparkles, BarChart3, TrendingUp, Users,
  ArrowUpRight, AlertCircle, Info, FileStack, BadgeCheck, MapPin, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

interface CreditInstitution {
  id: number;
  eligibilityConditions: string;
  name: string;
  type: string;
  description: string;
  terms: string;
  eligibility: string;
  targets: string;
  processingTime: string;
  logoUrl: string;
  coverUrl: string;
  city: string;
  country: string;
  isHabilitated: number;
  createdAt: string;
}
interface CreditInstitution {
  id: number;
  eligibilityConditions: string;
  name: string;
  type: string;
  description: string;
  terms: string;
  eligibility: string;
  targets: string;
  processingTime: string;
  logoUrl: string;
  coverUrl: string;
  city: string;
  country: string;
  isHabilitated: number;
  createdAt: string;
}

// 👇 AJOUTE ICI
type FormDataType = {
  name: string;
  slogan: string;
  description: string;
  type: string;
  logoUrl: string;
  eligibilityConditions: string;
  offers: string;
  isConfirmed: boolean;
  city: string;
  country: string;
}; 

export default function InstitutionSpace() {
  const [activeTab, setActiveTab] = useState<'hub' | 'explorer' | 'my-requests' | 'my-institutions' | 'manage'>('hub');
  const [allInstitutions, setAllInstitutions] = useState<CreditInstitution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [myInstitutions, setMyInstitutions] = useState<CreditInstitution[]>([]);
  const [submittedRequests, setSubmittedRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstitution, setSelectedInstitution] = useState<CreditInstitution | null>(null);
  const [institutionRequests, setInstitutionRequests] = useState<any[]>([]);
  const [showRequestDetail, setShowRequestDetail] = useState<any>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
const [formData, setFormData] = useState<FormDataType>({
  name: '',
  slogan: '',
  description: '',
  type: 'Banque',
  logoUrl: '',
  eligibilityConditions: '',
  offers: '',
  isConfirmed: false,
  city: '',        // 👈 AJOUT
  country: ''      // 👈 AJOUT
});

  // ... (rest of the component)

  const handleOpenCreateModal = () => {
    setShowWarningModal(true);
  };

  const handleProceedToCreation = () => {
    setShowWarningModal(false);
    setShowCreateModal(true);
    setModalStep(1);
  };

  // ... (rest of the handlers)

  const [myCompanies, setMyCompanies] = useState<any[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<number | null>(null);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    companyId: '',
    fundingType: 'Crédit Court Terme',
    amount: '',
    reason: ''
  });

  useEffect(() => {
    fetchData();
    fetchMyCompanies();
  }, []);

  const fetchMyCompanies = async () => {
    try {
      const all = await api.companies.getAll();
      const user = await api.users.me();
      if (user?.id) {
        const mine = all.filter((c: any) => (c.ownerId === user.id || c.managerId === user.id) && c.isShop);
        setMyCompanies(mine);
        if (mine.length === 1) {
          setRequestForm(prev => ({ ...prev, companyId: mine[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch my companies", err);
    }
  };

  const isEligible = (company: any, institution: CreditInstitution) => {
    if (!institution.targets || !company.sector) return true; 
    return institution.targets.toLowerCase().includes(company.sector.toLowerCase());
  };

  const getEligibleCompanies = (institution: CreditInstitution) => {
    return myCompanies.filter(c => isEligible(c, institution));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.companyId || !requestForm.amount || !selectedInstId) {
      toast.error('Veuillez remplir les champs obligatoires (Entreprise, Montant)');
      return;
    }

    setSubmittingRequest(true);
    try {
      await api.companies.submitFundingRequest(parseInt(requestForm.companyId), {
        fundingType: requestForm.fundingType,
        amount: parseFloat(requestForm.amount),
        reason: requestForm.reason,
        institutionId: selectedInstId
      });
      toast.success('Demande déposée avec succès !');
      setShowFundingModal(false);
      setRequestForm({
        companyId: myCompanies.length === 1 ? myCompanies[0].id.toString() : '',
        fundingType: 'Crédit Court Terme',
        amount: '',
        reason: ''
      });
      fetchData(); 
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du dépôt du dossier');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [institutions, myRequests, allInsts] = await Promise.all([
        api.institutions.getMy(),
        api.companies.getMyFundingRequests(),
        api.institutions.getAll()
      ]);
      setMyInstitutions(institutions);
      setSubmittedRequests(myRequests);
      setAllInstitutions(allInsts);
      
      if (institutions.length > 0) {
        setSelectedInstitution(institutions[0]);
        fetchInstitutionRequests(institutions[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchInstitutionRequests = async (id: number) => {
    setLoadingRequests(true);
    try {
      const data = await api.institutions.getRequests(id);
      setInstitutionRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return toast.error("Le nom est obligatoire");
    if (!formData.type) return toast.error("Le type est obligatoire");
    if (!formData.description.trim()) return toast.error("La description est obligatoire");
    if (!formData.city.trim() || !formData.country.trim()) return toast.error("La localisation (Ville & Pays) est obligatoire");

    if (!formData.isConfirmed) {
      toast.error("Veuillez confirmer votre statut réglementaire");
      return;
    }

    try {
      await api.institutions.create(formData);
      toast.success('Institution créée avec succès !');
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la création');
    }
  };

  const handleUpdateStatus = async (requestId: number, status: string) => {
    try {
      await api.companies.updateFundingRequestStatus(requestId, status);
      toast.success(`Statut mis à jour : ${status}`);
      if (selectedInstitution) fetchInstitutionRequests(selectedInstitution.id);
      setShowRequestDetail(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Hub */}
      <div className="bg-white p-8 sm:p-12 rounded-[48px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 text-primary rotate-12">
            <Landmark size={240} />
         </div>
         <div className="relative z-10 space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Mon Institution</h1>
            <p className="text-slate-500 font-medium max-w-md">Pilotez votre établissement financier ou suivez vos dossiers de financement en temps réel.</p>
         </div>
         <div className="flex flex-wrap gap-4 relative z-10">
            <button 
              onClick={() => setActiveTab('hub')}
              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'hub' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-white border-transparent border-2 hover:border-slate-200'}`}
            >
               Tableau de bord
            </button>
            <button 
              onClick={() => setActiveTab('explorer')}
              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'explorer' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-white border-transparent border-2 hover:border-slate-200'}`}
            >
               Explorer
            </button>
            <button 
              onClick={() => setActiveTab('my-requests')}
              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'my-requests' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-white border-transparent border-2 hover:border-slate-200'}`}
            >
               Mes Dossiers
            </button>
            {myInstitutions.length > 0 && (
              <button 
                onClick={() => setActiveTab('my-institutions')}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'my-institutions' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-white border-transparent border-2 hover:border-slate-200'}`}
              >
                 Ma Gestion
              </button>
            )}
            <button 
              onClick={handleOpenCreateModal}
              className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2"
            >
               <Plus size={18} />
               Créer une Institution
            </button>
         </div>
      </div>
      {/* Content Area */}
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white p-8 rounded-[48px] shadow-sm border border-slate-100"
      >
        {activeTab === 'hub' && <div className="text-center py-20 text-slate-500 font-bold">Tableau de bord (Contenu à venir)</div>}
        {activeTab === 'explorer' && <div className="text-center py-20 text-slate-500 font-bold">Explorer les institutions (Contenu à venir)</div>}
        {activeTab === 'my-requests' && <div className="text-center py-20 text-slate-500 font-bold">Mes Dossiers (Contenu à venir)</div>}
        {activeTab === 'my-institutions' && <div className="text-center py-20 text-slate-500 font-bold">Gestion des institutions (Contenu à venir)</div>}
        {activeTab === 'manage' && <div className="text-center py-20 text-slate-500 font-bold">Gérer l'institution (Contenu à venir)</div>}
      </motion.div>
      {/* Modals */}
      <AnimatePresence>
        {/* Warning Modal */}
        {showWarningModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 max-w-lg w-full space-y-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Responsabilité Légale</h2>
              <p className="text-slate-600 font-medium">Seule une institution légalement établie est autorisée à créer un profil sur cette plateforme. En poursuivant, vous certifiez être le représentant légal ou le responsable mandaté de l'institution que vous allez enregistrer.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowWarningModal(false)} className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-[20px] font-bold">Annuler</button>
                <button onClick={handleProceedToCreation} className="flex-1 px-6 py-4 bg-primary text-white rounded-[20px] font-bold">J'accepte et je continue</button>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Creation Wizard */}
        {showCreateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Wizard Content */}
              <h2 className="text-3xl font-black text-slate-900 mb-8">
                {modalStep === 1 && "Identification de l'institution"}
                {modalStep === 2 && "Branding"}
                {modalStep === 3 && "Éligibilité & Offres"}
              </h2>
              
              <div className="space-y-6">
                {modalStep === 1 && (
                  <>
                    <input type="text" placeholder="Nom de l'institution" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    <input type="text" placeholder="Slogan" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" value={formData.slogan} onChange={(e) => setFormData({...formData, slogan: e.target.value})} />
                    <textarea placeholder="Description..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" rows={4} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                      <option value="Banque">Banque</option>
                      <option value="Microfinance">Microfinance</option>
                      <option value="Assurance">Assurance</option>
                      <option value="Associations">Associations</option>
                    </select>
                  </>
                )}
                {modalStep === 2 && (
                  <input type="text" placeholder="URL du Logo" className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" value={formData.logoUrl} onChange={(e) => setFormData({...formData, logoUrl: e.target.value})} />
                )}
                {modalStep === 3 && (
                  <>
                    <textarea placeholder="Conditions d'éligibilité..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" rows={4} value={formData.eligibilityConditions} onChange={(e) => setFormData({...formData, eligibilityConditions: e.target.value})} />
                    <textarea placeholder="Offres et services..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[20px] px-6 py-4 font-bold" rows={4} value={formData.offers} onChange={(e) => setFormData({...formData, offers: e.target.value})} />
                  </>
                )}
              </div>
              <div className="flex justify-end gap-4 mt-8">
                <button onClick={() => setShowCreateModal(false)} className="px-6 py-4 bg-slate-100 rounded-[20px] font-bold">Annuler</button>
                {modalStep > 1 && <button onClick={() => setModalStep(modalStep - 1)} className="px-6 py-4 bg-slate-100 rounded-[20px] font-bold">Précédent</button>}
                {modalStep < 3 && <button onClick={() => setModalStep(modalStep + 1)} className="px-6 py-4 bg-primary text-white rounded-[20px] font-bold">Suivant</button>}
                {modalStep === 3 && <button onClick={handleCreateInstitution} className="px-6 py-4 bg-primary text-white rounded-[20px] font-bold">Finaliser</button>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
