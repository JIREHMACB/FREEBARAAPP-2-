import React, { useState } from 'react';
import { Calendar, MapPin, Users, Bed } from 'lucide-react';

export default function ReservationUI({ company }: { company: any }) {
  const isTransport = company.domaine === 'Transport';
  const [formData, setFormData] = useState({
    dateDepart: '',
    dateArrivee: '',
    pointDepart: '',
    destination: '',
    passagers: 1,
    typeChambre: '',
    dureeSejour: 1,
  });

  const handleBooking = () => {
    alert(`Réservation effectuée pour ${company.name}`);
  };

  return (
    <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100">
      <h2 className="text-2xl font-black text-slate-900 mb-6">
        {isTransport ? 'Réserver votre voyage' : 'Réserver votre séjour'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isTransport ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Départ</label>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <MapPin className="text-primary" size={20} />
                <input type="text" className="bg-transparent w-full focus:outline-none font-medium" placeholder="Ville de départ" onChange={e => setFormData({...formData, pointDepart: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Arrivée</label>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <MapPin className="text-primary" size={20} />
                <input type="text" className="bg-transparent w-full focus:outline-none font-medium" placeholder="Destination" onChange={e => setFormData({...formData, destination: e.target.value})} />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Type de chambre</label>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Bed className="text-primary" size={20} />
              <select className="bg-transparent w-full focus:outline-none font-medium" onChange={e => setFormData({...formData, typeChambre: e.target.value})}>
                <option>Simple</option>
                <option>Double</option>
                <option>Suite Premium</option>
              </select>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Calendar className="text-primary" size={20} />
            <input type="date" className="bg-transparent w-full focus:outline-none font-medium" onChange={e => setFormData({...formData, dateDepart: e.target.value})} />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Voyageurs</label>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-4 rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Users className="text-primary" size={20} />
            <input type="number" className="bg-transparent w-full focus:outline-none font-medium" placeholder="1" onChange={e => setFormData({...formData, passagers: parseInt(e.target.value)})} />
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleBooking}
        className="w-full mt-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-95"
      >
        Réserver maintenant
      </button>
    </div>
  );
}
