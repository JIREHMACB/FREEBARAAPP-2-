import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, UserPlus, CheckCircle, AtSign, ShieldCheck, ShoppingCart, Store, MessageSquare, UserX, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingNotifId, setProcessingNotifId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const data = await api.notifications.getAll();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptConnection = async (notif: any) => {
    try {
      await api.users.follow(notif.relatedId);
      alert('Connexion acceptée !');
      handleMarkAsRead(notif.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.read) handleMarkAsRead(notif.id);

    switch (notif.type) {
      case 'connection_request':
        navigate(`/profile/${notif.relatedId}`);
        break;
      case 'shop_order':
        navigate(`/business?tab=commandes`);
        break;
      case 'company_manager':
      case 'manager_resigned':
      case 'manager_revoked':
        navigate(`/business`);
        break;
      case 'message':
      case 'message_mention':
        navigate(`/messages/${notif.relatedId}`);
        break;
      case 'cell_sponsor':
        navigate(`/groups`); // Groups page handles cells
        break;
      case 'post_mention':
      case 'comment_mention':
        navigate(`/`); // Navigate to home where the post is likely visible
        break;
      case 'mention':
        navigate(`/`); // Home feed fallback
        break;
      default:
        // Default behavior: just mark as read (already done)
        break;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
          <Bell size={24} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 text-slate-500">
          <Bell size={48} className="mx-auto text-slate-300 mb-4" />
          <p>Vous n'avez aucune notification.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {notifications.map((notif, idx) => (
            <div 
              key={notif.id} 
              className={`p-4 flex gap-4 border-b border-slate-100 last:border-0 transition-all cursor-pointer hover:bg-slate-50 ${
                notif.read ? 'bg-white' : 'bg-blue-50/50'
              }`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                notif.type === 'shop_order' ? 'bg-orange-100 text-orange-600' :
                notif.type === 'company_manager' ? 'bg-primary/10 text-primary' :
                notif.type === 'manager_resigned' || notif.type === 'manager_revoked' ? 'bg-red-100 text-red-600' :
                notif.type === 'message' ? 'bg-blue-100 text-blue-600' :
                'bg-slate-100 text-slate-500'
              }`}>
                {notif.type === 'connection_request' ? <UserPlus size={20} /> :
                 (notif.type === 'mention' || notif.type === 'post_mention' || notif.type === 'comment_mention' || notif.type === 'message_mention') ? <AtSign size={20} /> :
                 notif.type === 'cell_sponsor' ? <ShieldCheck size={20} /> :
                 notif.type === 'shop_order' ? <ShoppingCart size={20} /> :
                 notif.type === 'company_manager' ? <Store size={20} /> :
                 notif.type === 'manager_resigned' || notif.type === 'manager_revoked' ? <UserX size={20} /> :
                 notif.type === 'message' ? <MessageSquare size={20} /> :
                 <Bell size={20} />}
              </div>
              <div className="flex-1">
                <p className={`text-sm ${notif.read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                  {notif.content}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                  </span>
                </div>
                
                {notif.type === 'company_manager' && !notif.read && (
                  <div className="mt-3 flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleNotificationClick(notif); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      <Store size={16} />
                      Accéder
                    </button>
                    <button 
                      disabled={processingNotifId === notif.id}
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        if (confirm('Voulez-vous refuser ce rôle de gestionnaire ?')) {
                          setProcessingNotifId(notif.id);
                          const promise = api.companies.resignManager(notif.relatedId);
                          
                          toast.promise(promise, {
                            loading: 'Refus en cours...',
                            success: 'Rôle refusé avec succès',
                            error: 'Erreur lors du refus du rôle',
                          });

                          try {
                            await promise;
                            handleMarkAsRead(notif.id);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setProcessingNotifId(null);
                          }
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      {processingNotifId === notif.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <UserX size={16} />
                      )}
                      Refuser
                    </button>
                  </div>
                )}

                {notif.type === 'connection_request' && !notif.read && (
                  <div className="mt-3 flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAcceptConnection(notif); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      <CheckCircle size={16} />
                      Accepter
                    </button>
                  </div>
                )}
              </div>
              {!notif.read && (
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
