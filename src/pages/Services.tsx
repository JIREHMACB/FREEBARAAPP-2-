import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Edit3, Trash2, Briefcase, Upload, FileText, MapPin, Tag } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serviceForm, setServiceForm] = useState<any>({
    title: '', 
    description: '', 
    availability: '', 
    budget: '',
    type: 'offre',
    location: '',
    contractType: 'CDI',
    category: '',
    fileUrl: '',
    fileName: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match('application/pdf|image/(jpeg|png)')) {
        toast.error('Format non supporté. Utilisez PDF, JPEG ou PNG.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setServiceForm((prev: any) => ({ ...prev, fileUrl: reader.result as string, fileName: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchServices = async () => {
    try {
      const data = await api.services.getAll();
      setServices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (serviceForm.id) {
        await api.services.update(serviceForm.id, serviceForm);
      } else {
        await api.services.create(serviceForm);
      }
      setShowCreateModal(false);
      setServiceForm({ 
        title: '', description: '', availability: '', budget: '', 
        type: 'offre', location: '', contractType: 'CDI', category: '', 
        fileUrl: '', fileName: '' 
      });
      fetchServices();
      toast.success('Service enregistré');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce service ?')) return;
    try {
      await api.services.delete(id);
      fetchServices();
      toast.success('Service supprimé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Offres</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold"
        >
          <Plus size={20} /> Ajouter une offre
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map(service => (
          <div key={service.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${service.type === 'projet' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                  {service.type === 'projet' ? 'Projet' : 'Offre d\'emploi'}
                </span>
                <h3 className="font-bold text-lg mt-2">{service.title}</h3>
                {service.category && <p className="text-xs text-primary font-medium">{service.category}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setServiceForm(service); setShowCreateModal(true); }} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-colors"><Edit3 size={18} /></button>
                <button onClick={() => handleDelete(service.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
              </div>
            </div>
            
            <p className="text-slate-500 text-sm mb-6 line-clamp-3">{service.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-slate-500">
                <MapPin size={14} />
                <span className="text-xs">{service.location || 'Non spécifié'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Briefcase size={14} />
                <span className="text-xs">{service.contractType || 'N/A'}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-50">
              <span className="text-sm font-bold text-primary">{service.budget || 'Budget non spécifié'}</span>
              {service.fileUrl && (
                <a 
                  href={service.fileUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary"
                >
                  <FileText size={14} />
                  Voir document
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[40px] w-full max-w-2xl p-8 shadow-2xl my-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">{serviceForm.id ? 'Modifier l\'annonce' : 'Créer une annonce'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Plus size={24} className="rotate-45 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Type d'annonce</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20"
                    value={serviceForm.type}
                    onChange={e => setServiceForm({...serviceForm, type: e.target.value})}
                  >
                    <option value="offre">Offre d'emploi</option>
                    <option value="projet">Projet / Mission</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Catégorie</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                      placeholder="Ex: Informatique, Design..." 
                      value={serviceForm.category} 
                      onChange={e => setServiceForm({...serviceForm, category: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Titre</label>
                <input 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                  placeholder="Titre de l'annonce" 
                  value={serviceForm.title} 
                  onChange={e => setServiceForm({...serviceForm, title: e.target.value})} 
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                  placeholder="Détails de l'annonce..." 
                  rows={4} 
                  value={serviceForm.description} 
                  onChange={e => setServiceForm({...serviceForm, description: e.target.value})} 
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Lieu</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      className="w-full p-4 pl-12 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                      placeholder="Ex: Paris, Remote..." 
                      value={serviceForm.location} 
                      onChange={e => setServiceForm({...serviceForm, location: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Type de contrat</label>
                  <select 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20"
                    value={serviceForm.contractType}
                    onChange={e => setServiceForm({...serviceForm, contractType: e.target.value})}
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Stage">Stage</option>
                    <option value="Alternance">Alternance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Budget / Salaire</label>
                  <input 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                    placeholder="Ex: 45k€, 500€/jour..." 
                    value={serviceForm.budget} 
                    onChange={e => setServiceForm({...serviceForm, budget: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Disponibilité</label>
                  <input 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-primary/20" 
                    placeholder="Ex: Immédiate, Sous 1 mois..." 
                    value={serviceForm.availability} 
                    onChange={e => setServiceForm({...serviceForm, availability: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Document joint (PDF/Image)</label>
                <div className="relative group">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,image/*"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-primary/30 transition-all group-hover:bg-white"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-slate-400 group-hover:text-primary transition-colors" />
                      <p className="text-sm text-slate-500">
                        {serviceForm.fileName ? (
                          <span className="text-primary font-bold">{serviceForm.fileName}</span>
                        ) : (
                          <>
                            <span className="font-bold">Cliquez pour uploader</span> ou glissez-déposez
                          </>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG (max. 5MB)</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {serviceForm.id ? 'Mettre à jour' : 'Publier l\'annonce'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
