import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Heart, MessageCircle, Share2, MoreHorizontal, Rocket, Globe, 
  TrendingUp, Eye, PlayCircle, Lightbulb, Send, Trash2, Edit3,
  ChevronLeft, ChevronRight, ChevronDown,
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  MessageSquare,
  Copy,
  MoreVertical,
  Check
} from 'lucide-react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { api } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import MentionPicker from './MentionPicker';

interface PostCardProps {
  key?: any;
  post: any;
  currentUser: any;
  onDelete?: (postId: number) => void;
  onEdit?: (post: any) => void;
  onBoost?: (post: any) => void;
  onShowReactions?: (postId: number) => void;
  openLightbox?: (media: any[], index: number) => void;
}

export default function PostCard({ 
  post: initialPost, 
  currentUser, 
  onDelete, 
  onEdit, 
  onBoost, 
  onShowReactions,
  openLightbox 
}: PostCardProps) {
  const [post, setPost] = useState(initialPost);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [viewed, setViewed] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState(post.content);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  
  // Mentions states
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionType, setMentionType] = useState<'comment' | 'edit-comment' | 'edit-post' | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const editCommentInputRef = useRef<HTMLTextAreaElement>(null);
  const editPostInputRef = useRef<HTMLTextAreaElement>(null);
  
  const navigate = useNavigate();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  
  const handleEdit = () => {
    setIsEditingPost(true);
    if(onEdit) onEdit(post);
  };
  
  const handleDelete = () => {
    if(onDelete) onDelete(post.id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(post.content + ' ' + window.location.origin + '/post/' + post.id)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin + '/post/' + post.id)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.content)}&url=${encodeURIComponent(window.location.origin + '/post/' + post.id)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin + '/post/' + post.id)}`,
  };

  const handleShareTo = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank');
    setShowShareMenu(false);
  };

  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  useEffect(() => {
    if (isInView && !viewed) {
      api.posts.incrementView(post.id);
      setViewed(true);
    }
  }, [isInView, viewed, post.id]);

  let media: any[] = [];
  try {
    media = post.mediaUrls ? JSON.parse(post.mediaUrls) : (post.imageUrl ? [{url: post.imageUrl, type: 'image'}] : []);
  } catch (e) {
    console.error('Failed to parse mediaUrls:', e);
    media = post.imageUrl ? [{url: post.imageUrl, type: 'image'}] : [];
  }
  const engagementRate = post.views > 0 
    ? (((post.likesCount + post.commentsCount) / post.views) * 100).toFixed(1) 
    : '0.0';

  const handleLike = async (type: string = 'like') => {
    try {
      const isRemoving = post.myReactionType === type;
      
      let newLikesCount = post.likesCount;
      let newReactionLikeCount = post.reactionLikeCount || 0;
      let newReactionApplauseCount = post.reactionApplauseCount || 0;
      let newReactionInspirationCount = post.reactionInspirationCount || 0;

      // Remove old reaction
      if (post.myReactionType) {
        newLikesCount--;
        if (post.myReactionType === 'like') newReactionLikeCount--;
        if (post.myReactionType === 'applause') newReactionApplauseCount--;
        if (post.myReactionType === 'inspiration') newReactionInspirationCount--;
      }

      // Add new reaction if not removing
      if (!isRemoving) {
        newLikesCount++;
        if (type === 'like') newReactionLikeCount++;
        if (type === 'applause') newReactionApplauseCount++;
        if (type === 'inspiration') newReactionInspirationCount++;
      }

      const updatedPost = {
        ...post,
        myReactionType: isRemoving ? null : type,
        likesCount: newLikesCount,
        reactionLikeCount: newReactionLikeCount,
        reactionApplauseCount: newReactionApplauseCount,
        reactionInspirationCount: newReactionInspirationCount
      };

      setPost(updatedPost);
      await api.posts.toggleLike(post.id, type);
    } catch (err) {
      console.error(err);
      setPost(post); // Revert on error
    }
  };

  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
    } else {
      setShowComments(true);
      if (comments.length === 0) {
        setLoadingComments(true);
        try {
          const data = await api.posts.getComments(post.id);
          setComments(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingComments(false);
        }
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.posts.addComment(post.id, newComment);
      setNewComment('');
      setShowMentionPicker(false);
      const data = await api.posts.getComments(post.id);
      setComments(data);
      setPost((prev: any) => ({ ...prev, commentsCount: prev.commentsCount + 1 }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = (userId: number) => {
    if (!currentUser) {
      toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
      return;
    }
    navigate(`/messages/${userId}`);
  };

  const mentionSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMentionSearch = async (query: string, type: 'comment' | 'edit-comment' | 'edit-post') => {
    if (mentionSearchTimeout.current) {
      clearTimeout(mentionSearchTimeout.current);
    }

    if (!query || query.length < 1) {
      setMentionResults([]);
      setShowMentionPicker(false);
      return;
    }

    mentionSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.users.search(query);
        setMentionResults(results);
        setMentionType(type);
        setShowMentionPicker(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  const insertMention = (user: any) => {
    const mentionString = `@[${user.name}](${user.id}) `;
    if (mentionType === 'comment') {
      const parts = newComment.split('@');
      parts.pop();
      setNewComment(parts.join('@') + mentionString);
    } else if (mentionType === 'edit-comment') {
      const parts = editCommentContent.split('@');
      parts.pop();
      setEditCommentContent(parts.join('@') + mentionString);
    } else if (mentionType === 'edit-post') {
      const parts = editPostContent.split('@');
      parts.pop();
      setEditPostContent(parts.join('@') + mentionString);
    }
    setShowMentionPicker(false);
    setMentionResults([]);
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(@\[[^\]]+\]\(\d+\))/g);
    return (parts || []).map((part, i) => {
      const match = part.match(/@\[([^\]]+)\]\((\d+)\)/);
      if (match) {
        const name = match[1];
        const userId = match[2];
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${userId}`);
            }}
            className="text-primary font-bold hover:underline"
          >
            @{name}
          </button>
        );
      }
      return part;
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: 'JCE CONNECT Post',
      text: post.content,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${post.content || ''}\n\n${window.location.href}`);
        toast.success('Lien copié dans le presse-papier !');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error sharing:', err);
        // Fallback to clipboard on any error except intentional cancel
        await navigator.clipboard.writeText(`${post.content || ''}\n\n${window.location.href}`);
        toast.success('Lien copié !');
      }
    }
  };

  return (
    <div ref={ref} className={`bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-slate-200 transition-all duration-300 ${post.isBoosted ? 'ring-2 ring-primary/10' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                {post.authorName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">{post.authorName || 'Utilisateur Anonyme'}</h3>
              {post.authorCountry && (
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Globe size={10} />
                  {post.authorCountry}
                </span>
              )}
              {post.isSponsored && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-bold">
                  Sponsorisé
                </span>
              )}
              {post.isBoosted && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex items-center gap-1 font-bold">
                  <Rocket size={10} />
                  BOOSTÉ
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: fr })}</span>
              {post.category && post.category !== 'Tous' && (
                <>
                  <span>•</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full font-medium text-slate-600">{post.category}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {post.authorId === currentUser?.id && (
            <div className="relative group">
              <button className="p-2 text-slate-400 hover:text-slate-600">
                <MoreHorizontal size={20} />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white shadow-lg rounded-xl border border-slate-100 py-1 w-32 hidden group-hover:block z-10">
                {!post.isBoosted && onBoost && (
                  <button onClick={() => onBoost(post)} className="w-full text-left px-4 py-2 text-sm text-primary font-bold hover:bg-primary/5 flex items-center gap-2">
                    <Rocket size={14} />
                    Booster
                  </button>
                )}
                {onEdit && (
                  <button onClick={handleEdit} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Modifier</button>
                )}
                {onDelete && (
                  <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Supprimer</button>
                )}
              </div>
            </div>
          )}
          <div className="relative shrink-0 ml-2">
            {/* Mobile chevron button */}
            <button
              onClick={() => setIsStatsOpen(!isStatsOpen)}
              className="sm:hidden p-1 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ChevronDown size={16} className={`${isStatsOpen ? 'rotate-180' : ''} transition-transform duration-200`} />
            </button>

            {/* Stats - on desktop, always visible. On mobile, toggle visibility */}
            <div className={`
              ${isStatsOpen ? 'absolute right-0 top-full mt-2 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 z-30 flex min-w-[140px]' : 'hidden'}
              sm:flex flex-col items-end gap-1.5
            `}>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <Eye size={12} />
                <span>{post.views || 0} vues</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-primary font-bold">
                <TrendingUp size={12} />
                <span>{engagementRate}% engagement</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        {isEditingPost ? (
          <div className="space-y-2 relative">
            <textarea 
              ref={editPostInputRef}
              value={editPostContent}
              onChange={(e) => {
                setEditPostContent(e.target.value);
                const lastAt = e.target.value.lastIndexOf('@');
                if (lastAt !== -1 && lastAt >= e.target.value.length - 20) {
                  handleMentionSearch(e.target.value.substring(lastAt + 1), 'edit-post');
                } else {
                  setShowMentionPicker(false);
                }
              }}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              rows={4}
            />
            {showMentionPicker && mentionType === 'edit-post' && (
              <MentionPicker 
                results={mentionResults} 
                onSelect={insertMention} 
                className="bottom-full left-0 mb-2"
              />
            )}
            <div className="flex gap-2">
              <button 
                onClick={() => { setIsEditingPost(false); setEditPostContent(post.content); }}
                className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold"
              >
                Annuler
              </button>
              <button 
                onClick={async () => {
                  try {
                    await api.posts.update(post.id, editPostContent);
                    setPost({ ...post, content: editPostContent });
                    setIsEditingPost(false);
                    toast.success('Post mis à jour');
                  } catch (err) {
                    console.error(err);
                    toast.error('Erreur lors de la mise à jour');
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`text-slate-800 whitespace-pre-wrap text-sm leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
              {renderContent(post.content)}
            </div>
            {(post.content && (post.content.split('\n').length > 3 || post.content.length > 150)) && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-primary text-xs font-bold mt-1 hover:underline"
              >
                {isExpanded ? 'Voir moins' : 'En voir plus'}
              </button>
            )}
          </>
        )}
      </div>
      
      {media.length > 0 && (
        <div className="relative mb-4 rounded-2xl overflow-hidden bg-slate-950 group/carousel aspect-video">
          {media.length === 1 ? (
            <div 
              className="w-full h-full flex items-center justify-center cursor-pointer"
              onClick={() => openLightbox?.(media, 0)}
            >
              {media[0].type === 'image' || media[0].url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                <img 
                  src={media[0].url} 
                  alt="Media" 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer" 
                  loading="lazy"
                />
              ) : media[0].type === 'video' || media[0].url.match(/\.(mp4|webm|ogg)$/i) ? (
                <video 
                  src={media[0].url} 
                  className="w-full h-full object-contain" 
                  controls
                />
              ) : (
                <div className="text-white">Format non supporté</div>
              )}
            </div>
          ) : (
            <>
              <div className="w-full h-full relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMediaIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full flex items-center justify-center cursor-pointer"
                    onClick={() => openLightbox?.(media, currentMediaIndex)}
                  >
                    {media[currentMediaIndex].type === 'image' || media[currentMediaIndex].url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                      <img 
                        src={media[currentMediaIndex].url} 
                        alt={`Media ${currentMediaIndex + 1}`} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer" 
                        loading="lazy"
                      />
                    ) : media[currentMediaIndex].type === 'video' || media[currentMediaIndex].url.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video 
                        src={media[currentMediaIndex].url} 
                        className="w-full h-full object-contain" 
                        controls
                      />
                    ) : (
                        <div className="text-white">Format non supporté</div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Controls */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIndex(prev => (prev === 0 ? media.length - 1 : prev - 1));
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMediaIndex(prev => (prev === media.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/carousel:opacity-100"
              >
                <ChevronRight size={20} />
              </button>

              {/* Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 bg-black/20 backdrop-blur-sm rounded-full">
                {(media || []).map((_: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMediaIndex(idx);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === currentMediaIndex ? 'bg-white scale-125' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
              
              <div className="absolute top-4 right-4 px-2 py-1 bg-black/40 backdrop-blur-sm rounded-lg text-[10px] text-white font-bold">
                {currentMediaIndex + 1} / {media.length}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col pt-4 border-t border-slate-100 mt-4 space-y-3">
        {post.likesCount > 0 && (
          <button 
            onClick={() => onShowReactions?.(post.id)}
            className="flex items-center gap-2 sm:gap-3 px-1 hover:bg-slate-50 rounded-lg p-1 transition-colors text-left"
          >
            <div className="flex -space-x-1.5">
              {post.reactionLikeCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border-2 border-white">
                  <Heart size={10} className="fill-white text-white" />
                </div>
              )}
              {post.reactionApplauseCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white">
                  <span className="text-[10px] leading-none">👏</span>
                </div>
              )}
              {post.reactionInspirationCount > 0 && (
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center border-2 border-white">
                  <Lightbulb size={10} className="fill-white text-white" />
                </div>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium hover:underline">
              {[
                post.reactionLikeCount > 0 ? `${post.reactionLikeCount} J'aime` : null,
                post.reactionApplauseCount > 0 ? `${post.reactionApplauseCount} Bravo` : null,
                post.reactionInspirationCount > 0 ? `${post.reactionInspirationCount} Inspiré` : null
              ].filter(Boolean).join(' • ')}
            </span>
          </button>
        )}

        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button 
              onClick={() => handleLike('like')}
              className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-2xl transition-all duration-200 font-semibold text-xs sm:text-sm ${
                post.myReactionType === 'like' ? 'text-red-500 bg-red-50' : 'text-slate-600 hover:text-red-500 hover:bg-slate-100'
              }`}
            >
              <Heart size={18} className={post.myReactionType === 'like' ? 'fill-current' : ''} />
              <span className="hidden xs:inline">J'aime</span>
            </button>

            <div className="relative group">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-2xl transition-all duration-200 font-semibold text-xs sm:text-sm ${
                  post.myReactionType === 'applause' ? 'text-amber-500 bg-amber-50' :
                  post.myReactionType === 'inspiration' ? 'text-purple-500 bg-purple-50' :
                  'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={post.myReactionType || 'none'}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {post.myReactionType === 'applause' ? <span className="text-lg leading-none">👏</span> :
                     post.myReactionType === 'inspiration' ? <Lightbulb size={18} className="fill-current" /> :
                     <span className="text-lg leading-none">😊</span>}
                  </motion.div>
                </AnimatePresence>
                <span>{post.myReactionType === 'applause' ? "Bravo" : post.myReactionType === 'inspiration' ? "Inspiré" : "Réagir"}</span>
              </motion.button>

              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex items-center gap-2 bg-white p-2 rounded-full shadow-lg border border-slate-100 z-10 animate-in fade-in slide-in-from-bottom-2">
                <motion.button 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleLike('like'); }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-red-500"
                  title="J'aime"
                >
                  <Heart size={24} className="fill-current" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleLike('applause'); }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-2xl leading-none"
                  title="Applaudissements"
                >
                  👏
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); handleLike('inspiration'); }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-purple-500"
                  title="Inspiration"
                >
                  <Lightbulb size={24} className="fill-current" />
                </motion.button>
              </div>
            </div>
          </div>

          <button 
            onClick={toggleComments}
            className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-2xl transition-all duration-200 font-semibold text-xs sm:text-sm ${
              showComments ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-primary hover:bg-slate-100'
            }`}
          >
            <MessageCircle size={18} />
            <span>{post.commentsCount || 0}</span>
          </button>
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            className={`flex items-center gap-2 px-3 sm:px-5 py-2 rounded-2xl transition-all duration-200 font-semibold text-xs sm:text-sm ${
              showShareMenu ? 'text-primary bg-primary/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Share2 size={18} />
            <span className="hidden xs:inline">Partager</span>
          </button>

          <AnimatePresence>
            {showShareMenu && (
              <motion.div
                ref={shareMenuRef}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-[50]"
              >
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Partager sur</div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button 
                    onClick={() => handleShareTo('whatsapp')}
                    className="flex flex-col items-center gap-2 p-2 hover:bg-green-50 rounded-2xl transition-colors group"
                  >
                    <div className="w-12 h-12 bg-[#25D366]/10 text-[#25D366] rounded-xl flex items-center justify-center group-hover:bg-[#25D366] group-hover:text-white transition-all">
                      <MessageSquare size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">WhatsApp</span>
                  </button>
                  <button 
                    onClick={() => handleShareTo('facebook')}
                    className="flex flex-col items-center gap-2 p-2 hover:bg-blue-50 rounded-2xl transition-colors group"
                  >
                    <div className="w-12 h-12 bg-[#1877F2]/10 text-[#1877F2] rounded-xl flex items-center justify-center group-hover:bg-[#1877F2] group-hover:text-white transition-all">
                      <Facebook size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">Facebook</span>
                  </button>
                  <button 
                    onClick={() => handleShareTo('twitter')}
                    className="flex flex-col items-center gap-2 p-2 hover:bg-black/5 rounded-2xl transition-colors group"
                  >
                    <div className="w-12 h-12 bg-slate-900/10 text-slate-900 rounded-xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all">
                      <Twitter size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">Twitter (X)</span>
                  </button>
                  <button 
                    onClick={() => handleShareTo('linkedin')}
                    className="flex flex-col items-center gap-2 p-2 hover:bg-blue-50 rounded-2xl transition-colors group"
                  >
                    <div className="w-12 h-12 bg-[#0A66C2]/10 text-[#0A66C2] rounded-xl flex items-center justify-center group-hover:bg-[#0A66C2] group-hover:text-white transition-all">
                      <Linkedin size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600">LinkedIn</span>
                  </button>
                </div>
                
                <div className="pt-4 border-t border-slate-50 space-y-2">
                  <button 
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-600" />}
                      <span className="text-sm font-bold text-slate-700">{copied ? 'Lien copié !' : 'Copier le lien'}</span>
                    </div>
                  </button>
                  <button 
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    <MoreHorizontal size={18} className="text-slate-600" />
                    <span className="text-sm font-bold text-slate-700">Plus d'options</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="space-y-4 mb-4 max-h-60 overflow-y-auto pr-2">
            {loadingComments ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-2">Aucun commentaire pour le moment.</p>
            ) : (
              (comments || []).map((comment: any) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                    {comment.authorAvatar ? (
                      <img src={comment.authorAvatar} alt={comment.authorName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                        {comment.authorName?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-3">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-bold text-sm text-slate-900">{comment.authorName}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="space-y-2 relative">
                        <textarea 
                          ref={editCommentInputRef}
                          value={editCommentContent}
                          onChange={(e) => {
                            setEditCommentContent(e.target.value);
                            const lastAt = e.target.value.lastIndexOf('@');
                            if (lastAt !== -1 && lastAt >= e.target.value.length - 20) {
                              handleMentionSearch(e.target.value.substring(lastAt + 1), 'edit-comment');
                            } else {
                              setShowMentionPicker(false);
                            }
                          }}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm"
                        />
                        {showMentionPicker && mentionType === 'edit-comment' && (
                          <MentionPicker 
                            results={mentionResults} 
                            onSelect={insertMention} 
                            className="bottom-full left-0 mb-2"
                          />
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => setEditingCommentId(null)} className="text-xs font-bold text-slate-500">Annuler</button>
                          <button onClick={async () => {
                             try {
                               await api.posts.updateComment(post.id, comment.id, editCommentContent);
                               setComments(prev => (prev || []).map(c => c.id === comment.id ? {...c, content: editCommentContent} : c));
                               setEditingCommentId(null);
                               toast.success('Commentaire mis à jour');
                             } catch (err) {
                               console.error(err);
                               toast.error('Erreur lors de la mise à jour');
                             }
                          }} className="text-xs font-bold text-primary">Enregistrer</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-700">{renderContent(comment.content)}</div>
                    )}
                    {comment.authorId === currentUser?.id && editingCommentId !== comment.id && (
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => { setEditingCommentId(comment.id); setEditCommentContent(comment.content); }} className="text-xs text-slate-500 hover:text-primary">Modifier</button>
                        <button 
                          onClick={async () => {
                            if (!confirm('Supprimer ce commentaire ?')) return;
                            try {
                              await api.posts.deleteComment(post.id, comment.id);
                              setComments(prev => prev.filter(c => c.id !== comment.id));
                              setPost(prev => ({ ...prev, commentsCount: prev.commentsCount - 1 }));
                              toast.success('Commentaire supprimé');
                            } catch (err) {
                              console.error(err);
                              toast.error('Erreur lors de la suppression');
                            }
                          }} 
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleAddComment} className="flex gap-2 relative">
            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
              {currentUser?.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                  {currentUser?.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <input
                ref={commentInputRef}
                type="text"
                value={newComment}
                onChange={(e) => {
                  setNewComment(e.target.value);
                  const lastAt = e.target.value.lastIndexOf('@');
                  if (lastAt !== -1 && lastAt >= e.target.value.length - 20) {
                    handleMentionSearch(e.target.value.substring(lastAt + 1), 'comment');
                  } else {
                    setShowMentionPicker(false);
                  }
                }}
                placeholder="Écrire un commentaire..."
                className="w-full bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {showMentionPicker && mentionType === 'comment' && (
                <MentionPicker 
                  results={mentionResults} 
                  onSelect={insertMention} 
                  className="bottom-full left-0 mb-2"
                />
              )}
            </div>
            <button 
              type="submit"
              disabled={!newComment.trim()}
              className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
