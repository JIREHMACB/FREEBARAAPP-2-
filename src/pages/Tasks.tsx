import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Target, Activity, TrendingUp, CheckCircle2, Clock, List as ListIcon, Calendar, AlertCircle, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

const DependencyList = ({ taskId }: { taskId: number }) => {
    const [dependencies, setDependencies] = useState<any[]>([]);
    const [newDep, setNewDep] = useState('');

    useEffect(() => {
        fetchDependencies();
    }, [taskId]);

    const fetchDependencies = async () => {
        const data = await api.request(`/tasks/${taskId}/dependencies`);
        setDependencies(data || []);
    };

    const handleAddDependency = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDep.trim()) return;
        await api.request(`/tasks/${taskId}/dependencies`, {
            method: 'POST',
            body: JSON.stringify({ dependsOnTaskId: parseInt(newDep) }),
        });
        setNewDep('');
        fetchDependencies();
    };

    return (
        <div className="mt-4 pl-8 border-l-2 border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Dépendances</h4>
            <div className="space-y-2 mb-3">
                {dependencies.map(d => (
                    <div key={d.dependsOnTaskId} className="text-sm text-slate-600">
                        Dépend de l'action #{d.dependsOnTaskId}
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddDependency} className="flex gap-2">
                <input type="number" value={newDep} onChange={e => setNewDep(e.target.value)} placeholder="ID de l'action requise..." className="flex-grow p-2 border border-slate-200 rounded-lg text-sm" />
                <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Ajouter</button>
            </form>
        </div>
    );
};

const SubTaskList = ({ taskId }: { taskId: number }) => {
    const [subtasks, setSubtasks] = useState<any[]>([]);
    const [newSubtask, setNewSubtask] = useState('');

    useEffect(() => {
        fetchSubtasks();
    }, [taskId]);

    const fetchSubtasks = async () => {
        const data = await api.request(`/tasks/${taskId}/subtasks`);
        setSubtasks(data || []);
    };

    const handleAddSubtask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubtask.trim()) return;
        await api.request(`/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify({ title: newSubtask }),
        });
        setNewSubtask('');
        fetchSubtasks();
    };

    const toggleSubtask = async (subtask: any) => {
        await api.request(`/subtasks/${subtask.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: subtask.status === 'done' ? 'todo' : 'done' }),
        });
        fetchSubtasks();
    };

    return (
        <div className="mt-4 pl-8 border-l-2 border-slate-100">
            <div className="space-y-2 mb-3">
                {subtasks.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={s.status === 'done'} onChange={() => toggleSubtask(s)} className="rounded accent-primary" />
                        <span className={s.status === 'done' ? 'line-through text-slate-400' : ''}>{s.title}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddSubtask} className="flex gap-2">
                <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Ajouter une sous-tâche..." className="flex-grow p-2 border border-slate-200 rounded-lg text-sm" />
                <button type="submit" className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Ajouter</button>
            </form>
        </div>
    );
};

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'done': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'in_progress': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    default: return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
};

const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('Général');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.request('/users');
      setUsers(data || []);
    } catch (e: any) {
      console.error('Erreur lors du chargement des utilisateurs:', e);
      toast.error(e.message);
    }
  };


  const fetchTasks = async () => {
    try {
        const data = await api.request('/tasks');
        setTasks(data || []);
    } catch (e: any) {
        console.error('Erreur lors du chargement des tâches:', e);
        toast.error(e.message);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTaskId ? `/tasks/${editingTaskId}` : '/tasks';
      const method = editingTaskId ? 'PUT' : 'POST';
      
      await api.request(url, {
        method,
        body: JSON.stringify({ 
          title, 
          description, 
          dueDate, 
          reminderTime, 
          status: 'todo', 
          priority,
          category: showNewCategory ? customCategory : category,
          assignedUserId: assignedUserId ? parseInt(assignedUserId) : null
        }),
      });
      setTitle('');
      setDescription('');
      setDueDate('');
      setReminderTime('');
      setPriority('medium');
      setCategory('Général');
      setCustomCategory('');
      setAssignedUserId('');
      setEditingTaskId(null);
      setShowNewCategory(false);
      setIsAdding(false);
      fetchTasks();
      toast.success(editingTaskId ? 'Action mise à jour' : 'Action créée avec succès');
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const toggleStatus = async (task: any) => {
    let newStatus = 'todo';
    if (task.status === 'todo') newStatus = 'in_progress';
    else if (task.status === 'in_progress') newStatus = 'done';
    else newStatus = 'todo';

    try {
        await api.request(`/tasks/${task.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...task, status: newStatus }),
        });
        fetchTasks();
        toast.success('Action mise à jour');
    } catch (e: any) {
        toast.error(e.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  const deleteTask = async (id: number) => {
    try {
        await api.request(`/tasks/${id}`, { method: 'DELETE' });
        fetchTasks();
        toast.success('Action supprimée');
    } catch (e) {
        toast.error('Erreur lors de la suppression');
    }
  };

  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const kpi = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-950 tracking-tight">Gestion de Projet</h1>
          <p className="text-slate-500 mt-1">Organisez vos objectifs et activités clés de la semaine.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200">
            <button onClick={() => setView('list')} className={`p-2 rounded-xl transition flex items-center gap-2 ${view === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                <ListIcon size={18} /> Liste
            </button>
            <button onClick={() => setView('calendar')} className={`p-2 rounded-xl transition flex items-center gap-2 ${view === 'calendar' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                <Calendar size={18} /> Calendrier
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <button onClick={() => { setEditingTaskId(null); setTitle(''); setDescription(''); setDueDate(''); setReminderTime(''); setPriority('medium'); setCategory('Général'); setAssignedUserId(''); setIsAdding(!isAdding); }} className="flex items-center gap-2 bg-slate-900 text-white py-2.5 px-5 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg shrink-0">
            <Plus size={18} /> Nouvelle Action
            </button>
        </div>
      </header>

      {isAdding && (
        <form onSubmit={handleAddTask} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 mb-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <input 
              type="text" 
              placeholder="Titre de l'action..." 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full p-4 border border-slate-200 rounded-2xl"
              required
          />
          <input 
              type="date" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)} 
              className="w-full p-4 border border-slate-200 rounded-2xl"
          />
          <input 
              type="time" 
              value={reminderTime} 
              onChange={(e) => setReminderTime(e.target.value)} 
              className="w-full p-4 border border-slate-200 rounded-2xl"
          />
          <select value={category} onChange={(e) => { 
                if (e.target.value === 'new') setShowNewCategory(true);
                else { setCategory(e.target.value); setShowNewCategory(false); }
              }} className="w-full p-4 border border-slate-200 rounded-2xl">
              <option value="Général">Général</option>
              <option value="Professionnel">Professionnel</option>
              <option value="Personnel">Personnel</option>
              <option value="Projet X">Projet X</option>
              <option value="new">+ Nouvelle catégorie</option>
          </select>
          {showNewCategory && (
            <input 
                type="text" 
                placeholder="Nom de la nouvelle catégorie..." 
                value={customCategory} 
                onChange={(e) => setCustomCategory(e.target.value)} 
                className="w-full p-4 border border-slate-200 rounded-2xl"
            />
          )}
          <textarea 
              placeholder="Description détaillée (optionnel)..." 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full p-4 border border-slate-200 rounded-2xl md:col-span-2"
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full p-4 border border-slate-200 rounded-2xl">
              <option value="low">Priorité Basse</option>
              <option value="medium">Priorité Moyenne</option>
              <option value="high">Priorité Haute</option>
          </select>
          <select 
            value={assignedUserId}
            onChange={(e) => setAssignedUserId(e.target.value)} 
            className="w-full p-4 border border-slate-200 rounded-2xl">
            <option value="">Assigner à un membre (optionnel)</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
          </select>
          <button type="submit" className="md:col-span-2 flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary/90 transition">
              <Plus size={20} /> {editingTaskId ? 'Mettre à jour' : 'Créer l\'action'}
          </button>
        </form>
      )}

      {/* KPI Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><CheckCircle2 size={24}/></div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Réalisé</p>
                <p className="text-2xl font-black text-slate-900">{doneTasks}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600"><Activity size={24}/></div>
            <div>
                <p className="text-sm text-slate-500 font-medium">En cours</p>
                <p className="text-2xl font-black text-slate-900">{inProgressTasks}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${kpi > 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}><TrendingUp size={24}/></div>
            <div>
                <p className="text-sm text-slate-500 font-medium tracking-wide">Taux de Complétion</p>
                <p className="text-2xl font-black text-slate-900">{kpi}%</p>
            </div>
        </div>
      </section>

      {/* Task Content */}
      <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950 mb-8 flex items-center gap-2"><Target className="text-primary"/> {view === 'list' ? 'Activités de la semaine' : 'Calendrier'}</h2>
        
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
            {(['all', 'todo', 'in_progress', 'done'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-4 border-b-2 font-bold capitalize ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
              >
                {tab === 'all' ? 'Toutes' : tab === 'todo' ? 'À faire' : tab === 'in_progress' ? 'En cours' : 'Terminé'}
              </button>
            ))}
        </div>
        
        {view === 'list' ? (
            <div className="space-y-4">
                {tasks.filter(t => activeTab === 'all' || t.status === activeTab).length === 0 && <p className="text-slate-400 text-center py-10">Aucune activité pour le moment.</p>}
                {tasks.filter(t => activeTab === 'all' || t.status === activeTab).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(task => (
                    <div key={task.id} className="group p-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-100 transition-all shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <button 
                                onClick={() => toggleStatus(task)}
                                className={`font-bold text-xs uppercase px-3 py-1 rounded-full border ${getStatusClasses(task.status)}`}
                                >
                                    {task.status === 'done' ? 'Terminé' : task.status === 'in_progress' ? 'En cours' : 'À faire'}
                                </button>
                                <div>
                                    <h3 className={`font-bold text-lg text-slate-950 ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>{task.title}</h3>
                                    <p className="text-slate-500">{task.description}</p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className={`text-sm flex items-center gap-1.5 ${
                                            new Date(task.dueDate) < new Date() ? 'text-red-600 font-bold' : 
                                            new Date(task.dueDate) < new Date(new Date().getTime() + 48 * 60 * 60 * 1000) ? 'text-amber-600 font-bold' : 'text-slate-400'
                                        }`}>
                                            <CalendarIcon size={14}/>
                                            {task.dueDate} {task.reminderTime}
                                            {new Date(task.dueDate) < new Date() && " (En retard)"}
                                        </span>
                                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">{task.category}</span>
                                        {task.priority && (
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1 ${getPriorityClasses(task.priority)}`}>
                                                <AlertCircle size={12}/> {task.priority.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                onClick={() => { setEditingTaskId(task.id); setTitle(task.title); setDescription(task.description); 
                                    setDueDate(task.dueDate); setReminderTime(task.reminderTime); setPriority(task.priority); 
                                    setCategory(task.category); setAssignedUserId(task.assignedUserId || ''); setIsAdding(true); }}
                                className="text-slate-300 hover:text-blue-500 group-hover:opacity-100 opacity-0 transition">
                                    <Pencil size={20} />
                                </button>
                                <button 
                                onClick={() => deleteTask(task.id)}
                                className="text-slate-300 hover:text-red-500 group-hover:opacity-100 opacity-0 transition">
                                    <Trash2 size={20} />
                                </button>
                                {task.id === 2 && task.status !== 'done' && (
                                    <button 
                                        onClick={async () => {
                                            await api.request(`/tasks/${task.id}`, {
                                                method: 'PUT',
                                                body: JSON.stringify({ ...task, status: 'done' }),
                                            });
                                            fetchTasks();
                                            toast.success('Action #2 marquée comme terminée');
                                        }}
                                        className="text-emerald-500 hover:text-emerald-700 font-bold text-xs"
                                    >
                                        Terminer
                                    </button>
                                )}
                            </div>
                        </div>
                        <SubTaskList taskId={task.id} />
                        <DependencyList taskId={task.id} />
                    </div>
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-7 gap-2">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <div key={day} className="text-center font-bold text-slate-500 p-2">{day}</div>)}
                {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="min-h-[120px] bg-slate-50 rounded-2xl p-3 border border-slate-100 hover:bg-white transiton">
                        <span className="text-sm font-bold text-slate-900">{i + 1 > 31 ? i - 30 : i + 1}</span>
                        <div className="mt-2 space-y-1.5">
                            {tasks.filter(t => new Date(t.dueDate).getDate() === i + 1).map(t => (
                                <div key={t.id} className="text-xs font-medium bg-white text-slate-800 p-2 rounded-lg border border-slate-200 truncate shadow-sm">
                                    {t.title}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </section>
    </div>
  );
}
