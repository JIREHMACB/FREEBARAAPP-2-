import React from 'react';
import { motion } from 'framer-motion';
import { Users, ChevronLeft, ChevronRight, UserPlus, Send, MessageCircle, Check, Clock } from 'lucide-react';

interface UserCarouselProps {
  title: string;
  users: any[];
  icon: any;
  onConnect: (id: number) => void;
  onConnectWithMessage: (user: any) => void;
  onMessage: (id: number) => void;
  onViewProfile: (id: number) => void;
}

const countryFlags: Record<string, string> = {
  "France": "🇫🇷",
  "Côte d'Ivoire": "🇨🇮",
  "Canada": "🇨🇦",
  "Sénégal": "🇸🇳",
  "Cameroun": "🇨🇲",
  "Belgique": "🇧🇪",
  "Suisse": "🇨🇭",
  "Togo": "🇹🇬",
  "Bénin": "🇧🇯",
  "Gabon": "🇬🇦"
};

const UserCarousel = React.memo(({ title, users, icon: Icon, onConnect, onConnectWithMessage, onMessage, onViewProfile }: UserCarouselProps) => {
  if (users.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Icon size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <ChevronLeft size={20} />
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 snap-x">
        {users.map((user) => (
          <motion.div 
            key={user.id} 
            whileHover={{ y: -5 }}
            className="min-w-[260px] max-w-[260px] snap-start bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center cursor-pointer relative"
            onClick={() => onViewProfile(user.id)}
          >
            {user.country && countryFlags[user.country] && (
              <div className="absolute top-4 right-4 text-2xl" title={user.country}>
                {countryFlags[user.country]}
              </div>
            )}
            <div className="w-24 h-24 rounded-3xl bg-slate-200 mb-4 overflow-hidden ring-4 ring-slate-50 shadow-inner group-hover:ring-primary/20 transition-all">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-4xl font-black bg-white">
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <h3 className="font-black text-lg text-slate-900 truncate w-full group-hover:text-primary transition-colors">{user.name}</h3>
            <p className="text-xs font-bold text-primary/80 mb-1 truncate w-full uppercase tracking-wider">{user.profession || 'Leader'}</p>
            <p className="text-xs text-slate-400 mb-4 truncate w-full">{user.company || 'Indépendant'}</p>
            
            <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-slate-50 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <Users size={12} className="text-primary" />
              <span>{user.followersCount || 0} connexions</span>
            </div>
            
            <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold mb-6">
              {user.badge}
            </div>

            <div className="flex gap-2 w-full mt-auto">
              {user.isFollowing ? (
                <button 
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-600 py-2 rounded-xl text-sm font-medium"
                >
                  <Check size={16} />
                  Connecté
                </button>
              ) : user.requestSent ? (
                <button 
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-500 py-2 rounded-xl text-sm font-medium"
                >
                  <Clock size={16} />
                  En attente
                </button>
              ) : (
                <div className="flex gap-2 w-full">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => { e.stopPropagation(); onConnect(user.id); }}
                    title="Se connecter"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    <UserPlus size={16} />
                    Connecter
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); onConnectWithMessage(user); }}
                    title="Connecter avec un message"
                    className="flex items-center justify-center p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors"
                  >
                    <Send size={16} />
                  </motion.button>
                </div>
              )}
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: '#f1f5f9' }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => { e.stopPropagation(); onMessage(user.id); }}
                className="flex items-center justify-center p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <MessageCircle size={20} />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default UserCarousel;
