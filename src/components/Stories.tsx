import React, { useState, useEffect } from 'react';
import { Plus, X, Clock, PlayCircle, Eye, Image as ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Stories({ currentUser }: { currentUser: any }) {
  const [stories, setStories] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [viewingStory, setViewingStory] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewers, setViewers] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'to_watch' | 'archives'>('to_watch');

  useEffect(() => {
    fetchStories();
  }, []);

  useEffect(() => {
    if (viewingStory && activeTab === 'archives' && archives.length === 0) {
      fetchArchives();
    }
  }, [viewingStory, activeTab]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;

    if (viewingStory) {
      setProgress(0);
      
      // Progress bar animation
      progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + (100 / 50), 100)); // 5 seconds = 50 intervals of 100ms
      }, 100);

      // Auto-advance after 5 seconds
      timer = setTimeout(() => {
        handleNextStory();
      }, 5000);
    }

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [viewingStory]);

  const currentList = activeTab === 'archives' ? archives : stories;

  const handleNextStory = () => {
    if (!viewingStory) return;
    const currentIndex = currentList.findIndex(s => s.id === viewingStory.id);
    if (currentIndex < currentList.length - 1) {
      handleViewStory(currentList[currentIndex + 1]);
    } else {
      setViewingStory(null);
    }
  };

  const handlePrevStory = () => {
    if (!viewingStory) return;
    const currentIndex = currentList.findIndex(s => s.id === viewingStory.id);
    if (currentIndex > 0) {
      handleViewStory(currentList[currentIndex - 1]);
    }
  };

  const fetchStories = async () => {
    setError(null);
    try {
      const data = await api.stories.getAll();
      setStories(data);
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue lors du chargement des stories.');
    }
  };

  const fetchArchives = async () => {
    try {
      const data = await api.stories.getArchives();
      setArchives(data);
    } catch (err) {
      console.error(err);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setPendingFile(null);
    setPreviewUrl(null);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        await api.stories.create({ mediaUrl: base64, mediaType: type });
        fetchStories();
        if (activeTab === 'archives') fetchArchives();
      } catch (err) {
        console.error(err);
        setUploadError('Le téléchargement a échoué. Veuillez réessayer.');
        setPendingFile(file);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleViewStory = async (story: any) => {
    setViewingStory(story);
    try {
      const [viewersData, reactionsData] = await Promise.all([
        api.request(`/stories/${story.id}/viewers`),
        api.request(`/stories/${story.id}/reactions`)
      ]);
      setViewers(viewersData);
      setReactions(reactionsData);
      await api.request(`/stories/${story.id}/view`, { method: 'POST' });
      fetchStories();
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!viewingStory) return;
    try {
      await api.request(`/stories/${viewingStory.id}/react`, { 
        method: 'POST', 
        body: JSON.stringify({ emoji }) 
      });
      const reactionsData = await api.request(`/stories/${viewingStory.id}/reactions`);
      setReactions(reactionsData);
      fetchStories();
    } catch (err) {
      console.error('Error reacting:', err);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 mb-4 px-4 md:px-0">Stories</h2>
      
      {/* Preview/Crop Modal */}
      {previewUrl && pendingFile && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold">Prévisualisation</h3>
            {pendingFile.type.startsWith('video/') ? (
              <video src={previewUrl} className="w-full rounded-xl" controls />
            ) : (
              <img src={previewUrl} className="w-full rounded-xl" alt="Preview" />
            )}
            <div className="flex gap-2">
              <button onClick={() => { setPreviewUrl(null); setPendingFile(null); }} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold">Annuler</button>
              <button onClick={() => { uploadFile(pendingFile); setPreviewUrl(null); }} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold">Publier</button>
            </div>
            <p className="text-xs text-slate-500 text-center">Note: Le recadrage vidéo n'est pas disponible pour le moment.</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="px-4 py-4 bg-red-50 rounded-2xl flex items-center justify-between">
          <span className="text-red-600 text-sm">{error}</span>
          <button onClick={fetchStories} className="text-sm font-medium text-red-700 hover:underline">Réessayer</button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-0 -mx-4 md:mx-0">
          {/* Create Story Button */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 w-28">
            <label className="w-28 h-40 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors relative overflow-hidden">
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              ) : uploadError ? (
                <div className="text-center p-2">
                  <p className="text-xs text-red-500 mb-2">{uploadError}</p>
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => pendingFile && uploadFile(pendingFile)} className="text-[10px] bg-primary text-white px-2 py-1 rounded">Réessayer</button>
                    <button onClick={() => setUploadError(null)} className="text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded">Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Me" className="w-full h-full object-cover opacity-50" />
                  ) : (
                    <Plus className="text-slate-400" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Plus className="text-white drop-shadow-md" size={32} />
                  </div>
                </>
              )}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleCreateStory} disabled={isUploading} />
            </label>
            <span className="text-xs font-medium text-slate-600">Ajouter</span>
          </div>

          {/* Stories List */}
          {stories.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-4 md:px-0 -mx-4 md:mx-0">
              {stories.map(story => (
                <div key={story.id} className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer w-28 group" onClick={() => { setActiveTab('to_watch'); handleViewStory(story); }}>
                  <div className={`w-28 h-40 rounded-2xl overflow-hidden bg-slate-200 relative border-2 ${story.isViewed ? 'border-slate-300' : 'border-transparent bg-gradient-to-tr from-pink-500 to-yellow-500 p-[2px]'} group-hover:scale-105 transition-transform duration-200`}>
                    <div className="w-full h-full rounded-xl overflow-hidden">
                      {story.mediaType === 'video' ? (
                        <video src={story.mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={story.mediaUrl} alt="Story" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full overflow-hidden border-2 border-white">
                      {story.authorAvatar ? (
                        <img src={story.authorAvatar} alt={story.authorName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 font-bold text-xs">
                          {story.authorName?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="absolute bottom-2 left-2 text-white text-xs font-medium truncate w-20">
                      {story.authorName?.split(' ')[0]}
                    </span>
                    <span className="absolute top-2 right-2 text-white text-[10px] font-medium bg-black/40 px-1.5 py-0.5 rounded-full">
                      {story.viewsCount || 0} vues
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Story Viewer Modal with Sidebar */}
      {viewingStory && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col md:flex-row">
          
          {/* Left Side: Story Player */}
          <div className="flex-1 relative flex flex-col">
            {/* Progress Bar */}
            <div className="absolute top-2 left-4 right-4 z-50 flex gap-1">
              {currentList.map((s, idx) => {
                const currentIndex = currentList.findIndex(st => st.id === viewingStory.id);
                let w = '0%';
                if (idx < currentIndex) w = '100%';
                if (idx === currentIndex) w = `${progress}%`;
                
                return (
                  <div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-100 ease-linear" style={{ width: w }} />
                  </div>
                );
              })}
            </div>

            <div className="absolute top-6 left-4 z-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 border border-white/20">
                {viewingStory.authorAvatar ? (
                  <img src={viewingStory.authorAvatar} alt={viewingStory.authorName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                    {viewingStory.authorName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium drop-shadow-md">{viewingStory.authorName}</span>
                    {viewingStory.isSponsored && (
                        <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-md font-bold">Sponsorisé</span>
                    )}
                </div>
                <span className="text-white/70 text-xs drop-shadow-md">
                  {formatDistanceToNow(new Date(viewingStory.createdAt), { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>

            <div className="absolute top-6 right-4 z-50 flex items-center gap-2 md:hidden">
              <button onClick={() => setViewingStory(null)} className="p-2 text-white/70 hover:text-white bg-black/20 rounded-full">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 relative">
              {/* Navigation Areas */}
              <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrevStory(); }} />
              <div className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNextStory(); }} />

              {viewingStory.mediaType === 'video' ? (
                <video src={viewingStory.mediaUrl} className="max-w-full max-h-full object-contain rounded-xl" autoPlay controls />
              ) : (
                <img src={viewingStory.mediaUrl} alt="Story" className="max-w-full max-h-full object-contain rounded-xl" />
              )}
            </div>

            <div className="p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4">
              <div className="flex gap-4 z-20">
                {['❤️', '🔥', '👏', '😂'].map(emoji => {
                  const count = reactions.filter(r => r.emoji === emoji).length;
                  return (
                    <div key={emoji} className="flex flex-col items-center gap-1">
                      <button onClick={() => handleReact(emoji)} className="text-2xl hover:scale-125 transition-transform">
                        {emoji}
                      </button>
                      <span className="text-white text-[10px]">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 text-white/80 text-xs z-20">
                <span className="flex items-center gap-1"><Eye size={14} /> {viewers.length} vues</span>
                {reactions.length > 0 && <span>• {reactions.length} réactions</span>}
              </div>
            </div>
          </div>

          {/* Right Side: Sidebar (Desktop only) */}
          <div className="hidden md:flex w-80 bg-white flex-col border-l border-slate-200 shadow-2xl z-50">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Stories</h3>
              <button onClick={() => setViewingStory(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <label className="w-full py-3 bg-primary/10 text-primary rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-primary/20 transition-colors">
                <Plus size={20} />
                Ajouter une story
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleCreateStory} disabled={isUploading} />
              </label>
            </div>

            <div className="flex border-b border-slate-100">
              <button 
                onClick={() => setActiveTab('to_watch')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'to_watch' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                À voir
              </button>
              <button 
                onClick={() => { setActiveTab('archives'); fetchArchives(); }}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'archives' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Clock size={16} />
                Archives
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {currentList.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">Aucune story trouvée.</p>
                </div>
              ) : (
                currentList.map(story => (
                  <div 
                    key={story.id} 
                    onClick={() => handleViewStory(story)}
                    className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${viewingStory.id === story.id ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-50 border border-transparent'}`}
                  >
                    <div className={`w-14 h-14 rounded-full p-0.5 ${story.isViewed && activeTab !== 'archives' ? 'bg-slate-200' : 'bg-gradient-to-tr from-pink-500 to-yellow-500'}`}>
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-white">
                        {story.authorAvatar ? (
                          <img src={story.authorAvatar} alt={story.authorName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs bg-slate-100">
                            {story.authorName?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm truncate ${viewingStory.id === story.id ? 'font-bold text-primary' : 'font-medium text-slate-900'}`}>
                        {story.authorName}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        {formatDistanceToNow(new Date(story.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
