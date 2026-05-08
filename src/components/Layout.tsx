import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Calendar, Briefcase, User, LogOut, MessageCircle, Bell, Settings, Trash2, ChevronDown, AlertTriangle, Rocket, ChevronRight, ChevronLeft, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, connectSocket, disconnectSocket, socket } from '../lib/api';
import toast from 'react-hot-toast';

const navItems = [
  { icon: Home, label: 'Actualité', path: '/' },
  { icon: Briefcase, label: 'Business', path: '/business' },
  { icon: Rocket, label: 'Outils', path: '/groups' },
  { icon: Users, label: 'Réseau', path: '/reseau' },
  { icon: Calendar, label: 'Événements', path: '/events' },
  { icon: User, label: 'Profil', path: '/profile' },
];

const mobileNavItems = [
  { icon: Home, label: 'Actualité', path: '/' },
  { icon: Briefcase, label: 'Business', path: '/business' },
  { icon: Rocket, label: 'Outils', path: '/groups' },
  { icon: Users, label: 'Réseau', path: '/reseau' },
  { icon: Calendar, label: 'Événements', path: '/events' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSidebarProfileMenu, setShowSidebarProfileMenu] = useState(false);

  const fetchStatsTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const fetchStats = async () => {
    if (fetchStatsTimeout.current) {
      clearTimeout(fetchStatsTimeout.current);
    }

    fetchStatsTimeout.current = setTimeout(async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const [notifs, convs, user] = await Promise.all([
          api.notifications.getAll(),
          api.messages.getConversations(),
          api.users.me()
        ]);
        setUnreadCount(notifs.filter((n: any) => !n.read).length);
        setUnreadMessagesCount(convs.reduce((acc: number, c: any) => acc + (c.unreadCount || 0), 0));
        setCurrentUser(user);
      } catch (err) {
        console.error(err);
      }
    }, 500);
  };

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    connectSocket();
    
    const handleNewMessage = () => {
      fetchStats();
    };
    
    const handleNewNotification = (data: any) => {
      if (!data) return;
      fetchStats();
      
      // Browser notification
      if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
        new Notification('FreeBara', { body: data.content || 'Nouvelle activité' });
      }

      // Custom toast based on notification type
      if (data.type === 'message') {
        toast.success(data.content, {
          icon: '💬',
          duration: 4000,
        });
      } else if (data.type === 'connection_request') {
        toast.success(data.content, {
          icon: '🤝',
          duration: 5000,
        });
      } else if (data.type === 'comment') {
        toast.success(data.content, {
          icon: '📝',
          duration: 4000,
        });
      } else if (data.type === 'like') {
        toast.success(data.content, {
          icon: '❤️',
          duration: 3000,
        });
      } else if (data.type === 'follow') {
        toast.success(data.content, {
          icon: '👤',
          duration: 4000,
        });
      } else if (data.type === 'event_participation') {
        toast.success(data.content, {
          icon: '📅',
          duration: 5000,
        });
      } else if (data.type === 'service_application') {
        toast.success(data.content, {
          icon: '💼',
          duration: 5000,
        });
      } else if (data.type === 'shop_order') {
        toast.success(data.content, {
          icon: '🛒',
          duration: 6000,
        });
      } else if (data.type === 'pannel_join' || data.type === 'pannel_add_member') {
        toast.success(data.content, {
          icon: '🎓',
          duration: 5000,
        });
      } else if (data.type === 'cell_add_member') {
        toast.success(data.content, {
          icon: '👥',
          duration: 5000,
        });
      } else if (data.type === 'mention') {
        toast.success(data.content, {
          icon: '🏷️',
          duration: 5000,
        });
      } else {
        toast.success(data.message || data.content || 'Nouvelle notification');
      }
    };

    socket.on('message', handleNewMessage);
    socket.on('notification', handleNewNotification);
    
    return () => {
      socket.off('message', handleNewMessage);
      socket.off('notification', handleNewNotification);
      disconnectSocket();
    };
  }, []);

  useEffect(() => {
    fetchStats();
    // Poll every 30s as fallback
    const interval = setInterval(fetchStats, 30000);
    
    // Check tasks deadlines
    const taskInterval = setInterval(async () => {
      try {
        const tasks = await api.request('/tasks');
        const now = new Date();
        tasks.forEach((task: any) => {
          if (!task.dueDate || task.status === 'done') return;
          
          const dueDate = new Date(task.dueDate);
          const timeUntilDeadline = dueDate.getTime() - now.getTime();
          
          // If within 24 hours (86400000ms) but not already alerted
          if (timeUntilDeadline > 0 && timeUntilDeadline < 86400000) {
            const lastReminder = localStorage.getItem(`reminder_${task.id}`);
            if (!lastReminder || Date.now() - parseInt(lastReminder) > 86400000) {
                toast.error(`Rappel : La tâche "${task.title}" arrive à échéance dans moins de 24h !`, {
                    duration: 10000,
                    icon: '⚠️'
                });
                localStorage.setItem(`reminder_${task.id}`, Date.now().toString());
            }
          }
        });
      } catch (e) {
        console.error('Error checking tasks', e);
      }
    }, 60000);
    
    return () => {
      clearInterval(interval);
      clearInterval(taskInterval);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Déconnexion réussie');
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    try {
      await api.users.deleteAccount();
      localStorage.removeItem('token');
      navigate('/login');
      toast.success('Votre compte a été supprimé.');
    } catch (error) {
      toast.error('Erreur lors de la suppression du compte.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col ${isSidebarExpanded ? 'lg:w-64 md:w-20' : 'w-20'} bg-white border-r border-slate-200 fixed h-full z-10 transition-all duration-300`}>
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm hover:bg-primary-hover transition-colors"
              >
                {isSidebarExpanded ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
              </button>
              {isSidebarExpanded && <span className="text-xl font-extrabold text-primary tracking-tight hidden lg:inline">FreeBara</span>}
            </div>
            {isSidebarExpanded && (
              <Link to="/notifications" className="relative p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-colors">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0 rounded-full border-2 border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {navItems
          .filter(item => item.label !== 'Profil')
          .map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/home');
            const Icon = item.icon;
            return (
              <React.Fragment key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center'} px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
                    isActive 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={!isSidebarExpanded ? item.label : ''}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                    {isSidebarExpanded && <span className="hidden lg:inline">{item.label}</span>}
                  </div>
                  {isSidebarExpanded && item.path === '/messages' && unreadMessagesCount > 0 && (
                    <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadMessagesCount}
                    </span>
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <Link
            to="/messages"
            className={`flex items-center gap-3 p-3 mb-2 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 ${!isSidebarExpanded ? 'justify-center' : ''}`}
          >
             <MessageCircle size={18} /> {isSidebarExpanded && <span>Messages</span>}
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowSidebarProfileMenu(!showSidebarProfileMenu)}
              className={`flex items-center ${isSidebarExpanded ? 'justify-between' : 'justify-center'} w-full p-2 hover:bg-slate-50 rounded-xl transition-colors`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-slate-500 m-1.5" />
                  )}
                </div>
                {isSidebarExpanded && <span className="text-sm font-medium text-slate-700 hidden lg:inline">{currentUser?.name || 'Mon Profil'}</span>}
              </div>
              {isSidebarExpanded && <ChevronRight size={16} className={`text-slate-400 transition-transform ${showSidebarProfileMenu ? 'rotate-90' : ''}`} />}
            </button>

            <AnimatePresence>
              {showSidebarProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50"
                >
                  <Link
                    to="/profile"
                    onClick={() => setShowSidebarProfileMenu(false)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700"
                  >
                    <User size={18} /> Profil
                  </Link>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <Settings size={18} /> Paramètres
                    </div>
                    <ChevronDown size={16} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                  </button>
                  {showSettings && (
                    <div className="pl-4 pr-2 py-1 space-y-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 hover:bg-red-50 rounded-lg text-sm font-medium text-red-600 transition-colors">
                        <LogOut size={16} /> Déconnexion
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${isSidebarExpanded ? 'md:ml-20 lg:ml-64' : 'md:ml-20'} pb-20 md:pb-0 min-h-screen transition-all duration-300`}>

        <div className="md:hidden flex justify-between items-center p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              <Users size={18} />
            </div>
            <span className="font-extrabold text-primary tracking-tight">FreeBara</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/messages" className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-xl">
              <MessageCircle size={22} />
              {unreadMessagesCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </Link>
            <Link to="/notifications" className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-xl">
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0 rounded-full border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200"
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={22} className="text-slate-500" />
                )}
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
              
              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full mt-2 right-0 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50"
                    >
                      <Link 
                        to="/profile" 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700"
                      >
                        <User size={18} /> Mon Profil
                      </Link>
                      <div className="border-t border-slate-100 my-1"></div>
                      <button 
                        onClick={(e) => { e.preventDefault(); setShowSettings(!showSettings); }}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <Settings size={18} /> Paramètres
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                      </button>
                      {showSettings && (
                        <div className="pl-4 pr-2 py-2 space-y-1 bg-slate-50/50 rounded-xl mt-1">
                          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 hover:bg-red-50 rounded-lg text-sm font-medium text-red-600 transition-colors">
                            <LogOut size={16} /> Déconnexion
                          </button>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              setShowDeleteConfirm(true);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-red-50 rounded-lg text-sm font-medium text-red-600 transition-colors"
                          >
                            <Trash2 size={16} /> Supprimer le compte
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 pb-safe z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-center h-16 px-4">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center justify-center transition-all duration-500 ease-out ${
                  isActive 
                    ? 'text-primary bg-primary/10 px-4 py-2.5 rounded-2xl' 
                    : 'text-slate-400 p-2 hover:bg-slate-50 rounded-xl'
                }`}
              >
                <motion.div
                  animate={{ 
                    scale: isActive ? 1.2 : 1,
                    y: isActive ? -2 : 0
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                >
                  <Icon 
                    size={22} 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className="transition-colors duration-300"
                  />
                </motion.div>
                
                {isActive && (
                  <motion.span
                    initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                    animate={{ width: 'auto', opacity: 1, marginLeft: 8 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="text-xs font-bold whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}

                {isActive && (
                  <motion.div 
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-primary/5 rounded-2xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
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
                  id="layout-delete-confirm-input"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    const input = document.getElementById('layout-delete-confirm-input') as HTMLInputElement;
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
    </div>
  );
}