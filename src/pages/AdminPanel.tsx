import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Users, FileText, Building2, BarChart3, Search, Ban, CheckCircle, ShieldAlert, Trash2, Eye, EyeOff, Bell, Shield, ChevronLeft } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface AdminUser {
  id: number; email: string; name: string; profession: string;
  country: string; badge: string; role: string; status: string;
  bannedReason: string; createdAt: string; avatarUrl: string;
}
interface AdminPost {
  id: number; content: string; authorName: string; authorEmail: string;
  authorAvatar: string; createdAt: string; bannedUsers: number;
  totalPosts: number; reportedPosts: number; totalCompanies: number;
  newUsersToday: number; newUsersWeek: number; reportCount: number;
status: string;
}
interface Stats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalPosts: number;
  reportedPosts: number;
  totalCompanies: number;
  newUsersToday: number;
  newUsersWeek: number;
}

// ── API admin ────────────────────────────────────────────────
const adminApi = {
  getStats: () => api.request('/admin/stats'),
  getUsers: (params?: any) => {
    const q = new URLSearchParams(params).toString();
    return api.request(`/admin/users?${q}`);
  },
  getPosts: (params?: any) => {
    const q = new URLSearchParams(params).toString();
    return api.request(`/admin/posts?${q}`);
  },
  banUser: (id: number, reason: string) => api.request(`/admin/users/${id}/ban`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  suspendUser: (id: number, reason: string) => api.request(`/admin/users/${id}/suspend`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  activateUser: (id: number) => api.request(`/admin/users/${id}/activate`, { method: 'PUT' }),
  deleteUser: (id: number) => api.request(`/admin/users/${id}`, { method: 'DELETE' }),
  setRole: (id: number, role: string) => api.request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  deletePost: (id: number) => api.request(`/admin/posts/${id}`, { method: 'DELETE' }),
  hidePost: (id: number) => api.request(`/admin/posts/${id}/hide`, { method: 'PUT' }),
  restorePost: (id: number) => api.request(`/admin/posts/${id}/restore`, { method: 'PUT' }),
  notifyAll: (message: string) => api.request('/admin/notify-all', { method: 'POST', body: JSON.stringify({ message }) }),
};

// ── Composant principal ───────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState<'stats' | 'users' | 'posts' | 'notify'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState('');
  const [actionModal, setActionModal] = useState<{ user: AdminUser, type: 'ban' | 'suspend' } | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, search, filterStatus]);
  useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, filterStatus]);

  const loadStats = async () => {
    try { setStats(await adminApi.getStats()); } catch {}
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers({ search, status: filterStatus });
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  };

  const loadPosts = async () => {
    setLoading(true);
    try { setPosts(await adminApi.getPosts({ status: filterStatus })); } catch {}
    setLoading(false);
  };

  const handleBanSuspend = async () => {
    if (!actionModal) return;
    try {
      if (actionModal.type === 'ban') await adminApi.banUser(actionModal.user.id, actionReason);
      else await adminApi.suspendUser(actionModal.user.id, actionReason);
      toast.success(`Utilisateur ${actionModal.type === 'ban' ? 'banni' : 'suspendu'}`);
      setActionModal(null); setActionReason('');
      loadUsers();
    } catch { toast.error('Erreur'); }
  };

  const handleActivate = async (id: number) => {
    await adminApi.activateUser(id);
    toast.success('Compte réactivé'); loadUsers();
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Supprimer définitivement cet utilisateur ?')) return;
    await adminApi.deleteUser(id);
    toast.success('Utilisateur supprimé'); loadUsers();
  };

  const handleSetRole = async (id: number, role: string) => {
    await adminApi.setRole(id, role);
    toast.success(`Rôle mis à jour : ${role}`); loadUsers();
  };

  const handleNotifyAll = async () => {
    if (!notifyMsg.trim()) return toast.error('Message vide');
    const data = await adminApi.notifyAll(notifyMsg);
    toast.success(`Notification envoyée à ${data.sent} utilisateurs`);
    setNotifyMsg('');
  };

  const statusBadge = (status: string) => {
    const map: any = {
      active: 'bg-emerald-100 text-emerald-700',
      suspended: 'bg-orange-100 text-orange-700',
      banned: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status || 'active'}</span>;
  };

  const roleBadge = (role: string) => {
    const map: any = {
      admin: 'bg-purple-100 text-purple-700',
      moderator: 'bg-blue-100 text-blue-700',
      user: 'bg-slate-100 text-slate-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[role] || 'bg-slate-100 text-slate-600'}`}>{role || 'user'}</span>;
  };

  const TABS = [
    { id: 'stats', label: 'Dashboard', icon: BarChart3 },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'posts', label: 'Publications', icon: FileText },
    { id: 'notify', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-xl"><Shield className="text-purple-600" size={22} /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Panel Administrateur</h1>
          <p className="text-xs text-slate-500">Gérez FreeBara en toute sécurité</p>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Sidebar tabs */}
        <div className="w-52 bg-white border-r border-slate-200 min-h-screen p-4 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${tab === t.id ? 'bg-purple-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
              <t.icon size={18} />{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-6">

          {/* ── STATS ── */}
          {tab === 'stats' && stats && (
            <div>
              <h2 className="text-lg font-black text-slate-900 mb-4">Vue d'ensemble</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Utilisateurs total', value: stats.totalUsers, color: 'bg-blue-500' },
                  { label: 'Actifs', value: stats.activeUsers, color: 'bg-emerald-500' },
                  { label: 'Bannis', value: stats.bannedUsers, color: 'bg-red-500' },
                  { label: 'Publications', value: stats.totalPosts, color: 'bg-purple-500' },
                  { label: 'Signalées', value: stats.reportedPosts, color: 'bg-orange-500' },
                  { label: 'Entreprises', value: stats.totalCompanies, color: 'bg-indigo-500' },
                  { label: 'Nouveaux aujourd\'hui', value: stats.newUsersToday, color: 'bg-teal-500' },
                  { label: 'Nouveaux cette semaine', value: stats.newUsersWeek, color: 'bg-pink-500' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${s.color} mb-3`} />
                    <div className="text-2xl font-black text-slate-900">{s.value}</div>
                    <div className="text-xs text-slate-500 font-medium mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un utilisateur..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
                  <option value="">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="suspended">Suspendus</option>
                  <option value="banned">Bannis</option>
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Utilisateur', 'Pays', 'Rôle', 'Statut', 'Inscrit le', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">Chargement...</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                              {u.avatarUrl && <img src={u.avatarUrl} className="w-full h-full object-cover" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.name || '—'}</div>
                              <div className="text-xs text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{u.country || '—'}</td>
                        <td className="px-4 py-3">
                          <select value={u.role || 'user'} onChange={e => handleSetRole(u.id, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1">
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">{statusBadge(u.status)}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString('fr')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {(u.status === 'banned' || u.status === 'suspended') ? (
                              <button onClick={() => handleActivate(u.id)} title="Réactiver"
                                className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200">
                                <CheckCircle size={14} />
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setActionModal({ user: u, type: 'suspend' })} title="Suspendre"
                                  className="p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200">
                                  <ShieldAlert size={14} />
                                </button>
                                <button onClick={() => setActionModal({ user: u, type: 'ban' })} title="Bannir"
                                  className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                  <Ban size={14} />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleDeleteUser(u.id)} title="Supprimer"
                              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-100 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── POSTS ── */}
          {tab === 'posts' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
                  <option value="">Toutes</option>
                  <option value="reported">Signalées</option>
                  <option value="hidden">Masquées</option>
                </select>
              </div>

              <div className="space-y-3">
                {loading ? <div className="text-center py-8 text-slate-400">Chargement...</div>
                : posts.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-slate-900 text-sm">{p.authorName}</span>
                          <span className="text-xs text-slate-400">{p.authorEmail}</span>
                          {p.reportCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                              ⚠ {p.reportCount} signalement{p.reportCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {p.status === 'hidden' && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full text-xs">Masquée</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-3">{p.content}</p>
                        <span className="text-xs text-slate-400 mt-1 block">{new Date(p.createdAt).toLocaleDateString('fr')}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {p.status !== 'hidden' ? (
                          <button onClick={async () => { await adminApi.hidePost(p.id); toast.success('Publication masquée'); loadPosts(); }}
                            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-orange-100 hover:text-orange-600" title="Masquer">
                            <EyeOff size={16} />
                          </button>
                        ) : (
                          <button onClick={async () => { await adminApi.restorePost(p.id); toast.success('Publication restaurée'); loadPosts(); }}
                            className="p-2 bg-emerald-100 text-emerald-600 rounded-xl" title="Restaurer">
                            <Eye size={16} />
                          </button>
                        )}
                        <button onClick={async () => { if (!confirm('Supprimer ?')) return; await adminApi.deletePost(p.id); toast.success('Supprimée'); loadPosts(); }}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200" title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NOTIFY ── */}
          {tab === 'notify' && (
            <div className="max-w-lg">
              <h2 className="text-lg font-black text-slate-900 mb-2">Envoyer une notification globale</h2>
              <p className="text-sm text-slate-500 mb-4">Tous les utilisateurs recevront cette notification dans leur app.</p>
              <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)}
                placeholder="Votre message pour tous les utilisateurs..."
                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm resize-none focus:border-purple-400 outline-none"
                rows={5} />
              <button onClick={handleNotifyAll}
                className="mt-3 px-6 py-3 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-colors flex items-center gap-2">
                <Bell size={18} /> Envoyer à tous
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal ban/suspend */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md">
            <h3 className="font-black text-lg mb-1">
              {actionModal.type === 'ban' ? '🚫 Bannir' : '⚠️ Suspendre'} {actionModal.user.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4">Cette action sera visible par l'utilisateur.</p>
            <textarea value={actionReason} onChange={e => setActionReason(e.target.value)}
              placeholder="Raison (optionnel)..." rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setActionModal(null); setActionReason(''); }}
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl">
                Annuler
              </button>
              <button onClick={handleBanSuspend}
                className={`flex-1 py-3 text-white font-bold rounded-2xl ${actionModal.type === 'ban' ? 'bg-red-600' : 'bg-orange-500'}`}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
