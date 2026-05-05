import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';
import { MapPin, Calendar, Briefcase, Navigation, X, Users, Church, Filter, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const EventIcon = L.divIcon({
  html: `<div class="bg-primary p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg></div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const CompanyIcon = L.divIcon({
  html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const CellIcon = L.divIcon({
  html: `<div class="bg-orange-500 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const ChurchIcon = L.divIcon({
  html: `<div class="bg-purple-600 p-2 rounded-full border-2 border-white shadow-lg text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 8V21H4V11l8-8Z"/><path d="M12 13v4"/><path d="M10 15h4"/></svg></div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function JCEMap() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [cells, setCells] = useState<any[]>([]);
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.8566, 2.3522]); // Paris default
  const [zoom, setZoom] = useState(5);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, companiesData, cellsData, churchesData] = await Promise.all([
          api.events.getAll(),
          api.companies.getAll(),
          api.cells.getAll(),
          api.churches.getAll()
        ]);
        
        // Only keep items with coordinates
        const eventsWithCoords = eventsData.filter((e: any) => e.latitude && e.longitude);
        const companiesWithCoords = companiesData.filter((c: any) => c.latitude && c.longitude);
        const cellsWithCoords = (cellsData || []).filter((c: any) => c.latitude && c.longitude);
        const churchesWithCoords = (churchesData || []).filter((c: any) => c.latitude && c.longitude);
        
        setEvents(eventsWithCoords);
        setCompanies(companiesWithCoords);
        setCells(cellsWithCoords);
        setChurches(churchesWithCoords);

        // Check for URL parameters
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');
        const eventId = searchParams.get('eventId');

        if (lat && lng) {
          setMapCenter([parseFloat(lat), parseFloat(lng)]);
          setZoom(15);
          
          if (eventId) {
            const event = eventsWithCoords.find((e: any) => e.id === parseInt(eventId));
            if (event) {
              setSelectedItem({ ...event, type: 'event' });
            }
          }
        } else if (eventsWithCoords.length > 0) {
          setMapCenter([eventsWithCoords[0].latitude, eventsWithCoords[0].longitude]);
          setZoom(10);
        } else if (companiesWithCoords.length > 0) {
          setMapCenter([companiesWithCoords[0].latitude, companiesWithCoords[0].longitude]);
          setZoom(10);
        } else if (cellsWithCoords.length > 0) {
          setMapCenter([cellsWithCoords[0].latitude, cellsWithCoords[0].longitude]);
          setZoom(10);
        }
      } catch (err) {
        console.error('Error fetching map data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchParams]);

  const countries = useMemo(() => {
    const all = [
      ...events.map(e => e.country),
      ...companies.map(c => c.country),
      ...cells.map(c => c.country),
      ...churches.map(c => c.country)
    ].filter(Boolean);
    return Array.from(new Set(all)).sort();
  }, [events, companies, cells, churches]);

  const cities = useMemo(() => {
    const all = [
      ...events.map(e => e.city),
      ...companies.map(c => c.city),
      ...cells.map(c => c.city),
      ...churches.map(c => c.city)
    ].filter(Boolean);
    return Array.from(new Set(all)).sort();
  }, [events, companies, cells, churches]);

  const filteredItems = useMemo(() => {
    const applyFilters = (items: any[], type: string) => {
      return items.filter(item => {
        const matchesType = filterType === 'all' || filterType === type;
        const matchesCountry = filterCountry === 'all' || item.country === filterCountry;
        const matchesCity = filterCity === 'all' || item.city === filterCity;
        const matchesSearch = searchQuery === '' || 
          (item.name || item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesCountry && matchesCity && matchesSearch;
      }).map(item => ({ ...item, type }));
    };

    return [
      ...applyFilters(events, 'event'),
      ...applyFilters(companies, 'company'),
      ...applyFilters(cells, 'cell'),
      ...applyFilters(churches, 'church')
    ];
  }, [events, companies, cells, churches, filterType, filterCountry, filterCity, searchQuery]);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setZoom(13);
      });
    }
  };

  if (loading) return <div className="h-96 flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-100"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Navigation className="text-primary" size={24} />
          Carte Interactive de la Communauté
        </h3>
        <button 
          onClick={handleLocateMe}
          className="flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-full hover:bg-primary hover:text-white transition-all shadow-sm"
        >
          <MapPin size={14} />
          Me localiser
        </button>
      </div>

      {/* Modern Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="all">Tous les types</option>
              <option value="event">Événements</option>
              <option value="company">Entreprises</option>
              <option value="cell">Cellules</option>
              <option value="church">Églises</option>
            </select>
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="all">Tous les pays</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 outline-none appearance-none cursor-pointer"
            >
              <option value="all">Toutes les villes</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="relative h-[600px] w-full rounded-[32px] overflow-hidden border border-slate-200 shadow-2xl">
        <MapContainer 
          center={mapCenter} 
          zoom={zoom} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <ChangeView center={mapCenter} zoom={zoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredItems.map((item, index) => {
            let iconMarkup = EventIcon;
            if (item.type === 'company') iconMarkup = CompanyIcon;
            if (item.type === 'cell') iconMarkup = CellIcon;
            if (item.type === 'church') iconMarkup = ChurchIcon;

            return (
              <Marker 
                key={`${item.type}-${item.id}-${index}`} 
                position={[item.latitude, item.longitude]}
                icon={iconMarkup}
                eventHandlers={{
                  click: () => setSelectedItem(item)
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h4 className="font-bold text-slate-900">{item.title || item.name}</h4>
                    <p className="text-xs text-slate-500 mb-2">{item.location || item.address || item.city}</p>
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${
                      item.type === 'event' ? 'text-primary' : 
                      item.type === 'company' ? 'text-blue-600' :
                      item.type === 'cell' ? 'text-orange-500' : 'text-purple-600'
                    }`}>
                      {item.type === 'event' ? <Calendar size={10} /> : 
                       item.type === 'company' ? <Briefcase size={10} /> :
                       item.type === 'cell' ? <Users size={10} /> : <Church size={10} />}
                      {item.type === 'event' ? 'Événement' : 
                       item.type === 'company' ? 'Entreprise' :
                       item.type === 'cell' ? 'Cellule' : 'Église'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Detail Card */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div 
              initial={{ x: 350, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 350, opacity: 0 }}
              className="absolute top-4 right-4 bottom-4 w-80 bg-white/95 backdrop-blur-md shadow-2xl rounded-[32px] z-[1000] border border-slate-100 flex flex-col overflow-hidden"
            >
              <div className="relative h-40 bg-slate-100">
                {selectedItem.imageUrl || selectedItem.logoUrl || selectedItem.coverUrl ? (
                  <img src={selectedItem.imageUrl || selectedItem.logoUrl || selectedItem.coverUrl} alt={selectedItem.title || selectedItem.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    {itemTypeIcon(selectedItem.type)}
                  </div>
                )}
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-sm shadow-sm"
                >
                  <X size={18} />
                </button>
                <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-lg ${itemTypeColor(selectedItem.type)}`}>
                  {itemTypeName(selectedItem.type)}
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <h4 className="font-bold text-slate-900 text-lg mb-1 leading-tight">{selectedItem.title || selectedItem.name}</h4>
                <p className="text-sm text-slate-500 mb-4 flex items-center gap-1.5 font-medium">
                  <MapPin size={14} className="text-slate-400" />
                  {selectedItem.location || selectedItem.address || `${selectedItem.city}, ${selectedItem.country}`}
                </p>
                <div className="h-px bg-slate-100 w-full mb-4" />
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-6 mb-6">
                  {selectedItem.description}
                </p>
                
                <button 
                  onClick={() => {
                    let path = '/';
                    if (selectedItem.type === 'event') path = `/events/${selectedItem.id}`;
                    else if (selectedItem.type === 'company') path = `/business?id=${selectedItem.id}`;
                    else if (selectedItem.type === 'cell') path = `/reseau?cellId=${selectedItem.id}`;
                    else if (selectedItem.type === 'church') path = '/reseau';
                    
                    navigate(path);
                  }}
                  className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  Voir les détails
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-3xl z-[1000] border border-slate-100 shadow-xl space-y-3 min-w-[200px]">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Légende</h4>
          {[
            { color: 'bg-primary', label: 'Événements JCE', icon: Calendar },
            { color: 'bg-blue-600', label: 'Entreprises Partenaires', icon: Briefcase },
            { color: 'bg-orange-500', label: 'Cellules de Développement', icon: Users },
            { color: 'bg-purple-600', label: 'Églises Impactantes', icon: Church },
          ].map(leg => (
            <div key={leg.label} className="flex items-center gap-3 text-xs font-semibold text-slate-700">
              <div className={`w-3.5 h-3.5 ${leg.color} rounded-full border-2 border-white shadow-sm flex-shrink-0`}></div>
              {leg.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function itemTypeIcon(type: string) {
  switch (type) {
    case 'event': return <Calendar size={56} />;
    case 'company': return <Briefcase size={56} />;
    case 'cell': return <Users size={56} />;
    case 'church': return <Church size={56} />;
    default: return <MapPin size={56} />;
  }
}

function itemTypeColor(type: string) {
  switch (type) {
    case 'event': return 'bg-primary';
    case 'company': return 'bg-blue-600';
    case 'cell': return 'bg-orange-500';
    case 'church': return 'bg-purple-600';
    default: return 'bg-slate-500';
  }
}

function itemTypeName(type: string) {
  switch (type) {
    case 'event': return 'Événement';
    case 'company': return 'Entreprise';
    case 'cell': return 'Cellule';
    case 'church': return 'Église';
    default: return 'Communauté';
  }
}
