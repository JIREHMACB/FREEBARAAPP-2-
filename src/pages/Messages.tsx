import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, socket } from '../lib/api';
import { Send, ArrowLeft, Search, Check, CheckCheck, Plus, X as XIcon, Paperclip, Smile, Settings, UserPlus, LogOut, Edit3, Trash2, Info, Users, Pin, PinOff, Download, ExternalLink, ChevronRight, Maximize2, Play, Volume2, FileText, DownloadCloud, Reply, AtSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRoom, setIsRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'group'>('direct');
  const [previewMedia, setPreviewMedia] = useState<any>(null);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationsListRef = useRef<HTMLDivElement>(null);
  const [reactingToMessageId, setReactingToMessageId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const REACTION_EMOJIS = [
    { emoji: '❤️', label: 'heart' },
    { emoji: '🔥', label: 'fire' },
    { emoji: '👍', label: 'thumbsup' },
    { emoji: '👎', label: 'thumbsdown' },
    { emoji: '💔', label: 'brokenheart' }
  ];

  const loadMoreConversations = async (currentOffset: number) => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const newConvs = await api.messages.getConversations(10, currentOffset);
      if (newConvs.length < 10) {
        setHasMore(false);
      }
      setConversations(prev => {
        const existingIds = new Set(prev.map(c => c.type === 'direct' ? String(c.id) : `room_${c.id}`));
        const filteredNew = newConvs.filter(c => !existingIds.has(c.type === 'direct' ? String(c.id) : `room_${c.id}`));
        return [...prev, ...filteredNew];
      });
      setOffset(currentOffset + 10);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [me, convs, users] = await Promise.all([
          api.users.me(),
          api.messages.getConversations(10, 0),
          api.users.getAll({})
        ]);
        setCurrentUser(me);
        setConversations(convs);
        setOffset(10);
        if (convs.length < 10) setHasMore(false);
        setAllUsers(users.filter((u: any) => u.id !== me.id));
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  const handleScroll = () => {
    if (conversationsListRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = conversationsListRef.current;
      if (scrollHeight - scrollTop <= clientHeight + 50) {
        loadMoreConversations(offset);
      }
    }
  };

  useEffect(() => {
    if (id) {
      const isRoomId = id.startsWith('room_');
      setIsRoom(isRoomId);
      const actualId = isRoomId ? Number(id.replace('room_', '')) : Number(id);

      const fetchData = async () => {
        try {
          if (isRoomId) {
            const [msgs, members] = await Promise.all([
              api.messages.getRoomMessages(actualId),
              api.messages.getRoomMembers(actualId)
            ]);
            setMessages(msgs);
            setPinnedMessages(msgs.filter((m: any) => m.isPinned).slice(-3));
            setRoomMembers(members);
            const room = conversations.find(c => c.id === actualId && c.type !== 'direct');
            setActiveRoom(room || { id: actualId, name: 'Groupe', type: 'group' });
            setRoomName(room?.name || '');
            setActiveUser(null);
          } else {
            const msgs = await api.messages.getConversation(actualId);
            setMessages(msgs);
            setPinnedMessages(msgs.filter((m: any) => m.isPinned).slice(-3));
            await api.messages.markAsRead(actualId);
            const user = conversations.find(c => c.id === actualId && c.type === 'direct');
            setActiveUser(user || { id: actualId, name: 'Utilisateur' });
            setActiveRoom(null);
          }
          
          const updatedConvs = await api.messages.getConversations();
          setConversations(updatedConvs);
        } catch (err) {
          console.error(err);
        }
      };
      fetchData();
    } else {
      setActiveUser(null);
      setActiveRoom(null);
      setMessages([]);
      setIsRoom(false);
    }
  }, [id, conversations.length]); // Only refetch if ID changes or list length changes

  useEffect(() => {
    const handleNewMessage = (msg: any) => {
      const isRoomId = id?.startsWith('room_');
      const actualId = isRoomId ? Number(id?.replace('room_', '')) : Number(id);

      if (isRoomId) {
        if (msg.roomId === actualId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      } else {
        if (actualId === msg.senderId || actualId === msg.receiverId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (actualId === msg.senderId) {
            api.messages.markAsRead(actualId);
          }
        }
      }
      api.messages.getConversations().then(setConversations);
    };

      socket.on('message', handleNewMessage);
      socket.on('typing', (data: { userId: number }) => {
        setTypingUsers(prev => [...new Set([...prev, data.userId])]);
      });
      socket.on('stop_typing', (data: { userId: number }) => {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      });
      socket.on('message_read', (data: { messageIds: number[], readerId: number }) => {
        setMessages(prev => prev.map(m => 
          data.messageIds.includes(m.id) ? { ...m, read: true } : m
        ));
      });
      socket.on('message_pinned', (data: any) => {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isPinned: 1 } : m));
        // Refresh pinned messages
        if (id) {
          const isRoomId = id.startsWith('room_');
          const actualId = isRoomId ? Number(id.replace('room_', '')) : Number(id);
          if (isRoomId) {
             if (data.roomId === actualId) {
                api.messages.getRoomMessages(actualId).then(msgs => setPinnedMessages(msgs.filter((m: any) => m.isPinned).slice(-3)));
             }
          } else {
             if (data.receiverId === currentUser?.id || data.senderId === currentUser?.id) {
                api.messages.getConversation(actualId).then(msgs => setPinnedMessages(msgs.filter((m: any) => m.isPinned).slice(-3)));
             }
          }
        }
      });
      socket.on('message_unpinned', (data: any) => {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isPinned: 0 } : m));
        setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
      });
      socket.on('message_updated', (data: { messageId: number, content: string }) => {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, content: data.content } : m));
        setPinnedMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, content: data.content } : m));
      });
      socket.on('message_deleted', (data: { messageId: number }) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
        setPinnedMessages(prev => prev.filter(m => m.id !== data.messageId));
      });
      socket.on('message_reaction_updated', (data: any) => {
        setMessages(prev => prev.map(m => {
          if (m.id === data.messageId) {
            const reactions = m.reactions || [];
            const existingIdx = reactions.findIndex((r: any) => r.userId === data.userId);
            
            let newReactions = [...reactions];
            if (data.type === 'remove') {
              newReactions = newReactions.filter((r: any) => r.userId !== data.userId);
            } else {
              if (existingIdx > -1) {
                newReactions[existingIdx] = { userId: data.userId, emoji: data.emoji };
              } else {
                newReactions.push({ userId: data.userId, emoji: data.emoji });
              }
            }
            return { ...m, reactions: newReactions };
          }
          return m;
        }));
      });
      return () => {
        socket.off('message', handleNewMessage);
        socket.off('typing');
        socket.off('stop_typing');
        socket.off('message_read');
        socket.off('message_pinned');
        socket.off('message_unpinned');
        socket.off('message_updated');
        socket.off('message_deleted');
        socket.off('message_reaction_updated');
      };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Vous devez être connecté avec un compte pour envoyer un message.');
      return;
    }
    if (!newMessage.trim() && !selectedFile) return;

    try {
      let fileData = null;
      if (selectedFile) {
        fileData = {
          fileUrl: filePreview,
          fileName: selectedFile.name,
          fileType: selectedFile.type
        };
      }

      const actualId = isRoom ? Number(id?.replace('room_', '')) : Number(id);
      let sentMsg;
      const payload = { 
        content: newMessage, 
        ...fileData,
        replyToId: replyTo?.id 
      };

      if (isRoom) {
        sentMsg = await api.messages.sendRoomMessage(actualId, payload.content, { 
          fileUrl: payload.fileUrl, 
          fileType: payload.fileType, 
          fileName: payload.fileName,
          replyToId: payload.replyToId
        });
      } else {
        sentMsg = await api.messages.send(actualId, payload.content, { 
          fileUrl: payload.fileUrl, 
          fileType: payload.fileType, 
          fileName: payload.fileName,
          replyToId: payload.replyToId
        });
      }
      
      setMessages([...messages, sentMsg]);
      setNewMessage('');
      setReplyTo(null);
      setSelectedFile(null);
      setFilePreview(null);
      setShowEmojiPicker(false);
      
      const updatedConvs = await api.messages.getConversations();
      setConversations(updatedConvs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMembers = async (userIds: number[]) => {
    if (!isRoom) {
      // Create a new room from 1-on-1
      try {
        const room = await api.messages.createRoom({
          name: `Groupe avec ${activeUser.name}`,
          type: 'group',
          memberIds: [activeUser.id, ...userIds]
        });
        navigate(`/messages/room_${room.id}`);
        setShowAddMemberModal(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const actualId = Number(id?.replace('room_', ''));
        await api.messages.addRoomMembers(actualId, userIds);
        const members = await api.messages.getRoomMembers(actualId);
        setRoomMembers(members);
        setShowAddMemberModal(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleGroupAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isRoom) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const avatarUrl = reader.result as string;
          const actualId = Number(id?.replace('room_', ''));
          await api.messages.updateRoom(actualId, { avatarUrl });
          // Update local state
          setActiveRoom((prev: any) => ({ ...prev, avatarUrl }));
          setConversations((prev: any[]) => prev.map(c => 
            (c.type === 'group' && c.id === actualId) ? { ...c, avatarUrl } : c
          ));
          toast.success('Photo de groupe mise à jour');
        } catch (err) {
          toast.error('Erreur lors de la mise à jour de la photo');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateRoom = async () => {
    if (!roomName.trim()) {
      toast.error('Le nom du groupe ne peut pas être vide');
      return;
    }
    setIsSavingRoom(true);
    try {
      const actualId = Number(id?.replace('room_', ''));
      await api.messages.updateRoom(actualId, { name: roomName });
      const updatedConvs = await api.messages.getConversations();
      setConversations(updatedConvs);
      setActiveRoom((prev: any) => ({ ...prev, name: roomName }));
      toast.success('Paramètres du groupe mis à jour');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePinMessage = async (messageId: number) => {
    try {
      await api.messages.pinMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: 1 } : m));
      const msg = messages.find(m => m.id === messageId);
      if (msg) {
        setPinnedMessages(prev => [...prev.filter(m => m.id !== messageId), { ...msg, isPinned: 1 }].slice(-3));
      }
      socket.emit('pin_message', { 
        messageId, 
        roomId: isRoom ? Number(id?.replace('room_', '')) : undefined,
        receiverId: !isRoom ? Number(id) : undefined 
      });
      toast.success('Message épinglé');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'épinglage');
    }
  };

  const handleUnpinMessage = async (messageId: number) => {
    try {
      await api.messages.unpinMessage(messageId);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: 0 } : m));
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
      socket.emit('unpin_message', { messageId });
      toast.success('Message désépinglé');
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const handleReact = async (messageId: number, emoji: string) => {
    try {
      const response = await api.messages.addReaction(messageId, emoji);
      const type = response.action === 'removed' ? 'remove' : 'add';
      
      socket.emit('message_reaction', {
        messageId,
        userId: currentUser.id,
        emoji,
        type,
        roomId: isRoom ? Number(id?.replace('room_', '')) : undefined,
        receiverId: !isRoom ? Number(id) : undefined
      });
      
      setReactingToMessageId(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la réaction');
    }
  };

  const handleEditMessage = async (messageId: number) => {
    if (!editContent.trim()) return;
    try {
      await api.messages.updateMessage(messageId, editContent);
      socket.emit('message_edit', {
        messageId,
        content: editContent,
        roomId: isRoom ? Number(id?.replace('room_', '')) : undefined,
        receiverId: !isRoom ? Number(id) : undefined
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: editContent } : m));
      setEditingMessageId(null);
      setEditContent('');
      toast.success('Message mis à jour');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce message ?')) return;
    try {
      await api.messages.deleteMessage(messageId);
      socket.emit('message_delete', {
        messageId,
        roomId: isRoom ? Number(id?.replace('room_', '')) : undefined,
        receiverId: !isRoom ? Number(id) : undefined
      });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message supprimé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleMentionSelect = (user: any) => {
    const lastAtPos = newMessage.lastIndexOf('@');
    const beforeAt = newMessage.substring(0, lastAtPos);
    // Find the end of the current mention search (until next space)
    const restOfMessage = newMessage.substring(lastAtPos);
    const spaceIdx = restOfMessage.indexOf(' ');
    const afterMention = spaceIdx !== -1 ? restOfMessage.substring(spaceIdx) : ' ';
    
    setNewMessage(`${beforeAt}@[${user.name}](${user.id})${afterMention}`);
    setShowMentions(false);
  };

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (val: string) => {
    setNewMessage(val);
    const actualId = isRoom ? Number(id?.replace('room_', '')) : Number(id);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    socket.emit('typing', { userId: currentUser.id, roomId: isRoom ? actualId : undefined, receiverId: !isRoom ? actualId : undefined });
    
    typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', { userId: currentUser.id, roomId: isRoom ? actualId : undefined, receiverId: !isRoom ? actualId : undefined });
    }, 2000);

    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const query = val.substring(lastAtPos + 1).split(' ')[0];
      setMentionSearch(query);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const renderContentWithMentions = (content: string, isMe: boolean) => {
    if (!content) return null;
    const parts = content.split(/(@\[[^\]]+\]\(\d+\))/g);
    return parts.map((part, i) => {
      const match = part.match(/@\[([^\]]+)\]\((\d+)\)/);
      if (match) {
        const userName = match[1];
        const userId = match[2];
        return (
          <span 
            key={i} 
            className={`font-black cursor-pointer hover:underline ${isMe ? 'text-white underline' : 'text-primary'}`}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${userId}`);
            }}
          >
            @{userName}
          </span>
        );
      }
      return part;
    });
  };

  const downloadFile = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex h-[calc(100vh-8rem)]">
      {/* Conversations List (Hidden on mobile if a chat is active) */}
      <div className={`w-full md:w-80 border-r border-slate-100 flex flex-col ${id ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Messages</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-primary text-white rounded-full hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all hover:scale-110"
              title="Nouveau message"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <div className="flex p-1 bg-slate-200/50 rounded-2xl mb-4">
            <button 
              onClick={() => setActiveTab('direct')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'direct' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Info size={14} className={activeTab === 'direct' ? 'text-primary' : 'text-slate-400'} />
              DIRECTS
            </button>
            <button 
              onClick={() => setActiveTab('group')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'group' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Users size={14} className={activeTab === 'group' ? 'text-blue-600' : 'text-slate-400'} />
              GROUPES
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-white" ref={conversationsListRef} onScroll={handleScroll}>
          {conversations.filter(c => c.type === activeTab).length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'direct' ? <Info className="text-slate-300" /> : <Users className="text-slate-400" />}
              </div>
              <p className="text-sm text-slate-500 font-medium">Aucune conversation {activeTab === 'direct' ? 'privée' : 'de groupe'}.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {conversations
                .filter(c => c.type === activeTab)
                .map(conv => {
                const convId = conv.type === 'direct' ? String(conv.id) : `room_${conv.id}`;
                const isActive = id === convId;
                return (
                  <button
                    key={convId}
                    onClick={() => navigate(`/messages/${convId}`)}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-all text-left group ${isActive ? 'bg-primary/5' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-14 h-14 rounded-[20px] overflow-hidden shadow-sm border-2 ${isActive ? 'border-primary' : 'border-white'}`}>
                        {conv.avatarUrl ? (
                          <img src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center text-white text-xl font-black ${conv.type === 'direct' ? 'bg-gradient-to-br from-slate-400 to-slate-500' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                            {conv.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      {conv.type === 'direct' && (
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white ${
                          conv.status === 'online' ? 'bg-green-500' : 
                          conv.status === 'idle' ? 'bg-yellow-500' : 'bg-slate-300'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className={`font-black truncate ${isActive ? 'text-primary' : 'text-slate-900'}`}>
                          {conv.name}
                        </h4>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {format(new Date(conv.lastMessageAt), 'HH:mm')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate flex-1 ${conv.unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                          {conv.lastMessage || 'Envoyez un message...'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-primary text-white text-[10px] font-black rounded-lg px-1.5 py-0.5 shadow-md shadow-primary/20">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className={`text-slate-300 transition-transform group-hover:translate-x-1 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Active Chat Area */}
      <div className={`flex-1 flex flex-col ${!id ? 'hidden md:flex' : 'flex'}`}>
        {!id ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Send size={32} className="text-slate-300 ml-1" />
            </div>
            <p className="font-medium text-slate-500">Sélectionnez une conversation</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/messages')}
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden relative">
                  {(isRoom ? activeRoom?.avatarUrl : activeUser?.avatarUrl) ? (
                    <img src={isRoom ? activeRoom.avatarUrl : activeUser.avatarUrl} alt={isRoom ? activeRoom.name : activeUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-white font-bold ${isRoom ? 'bg-primary' : 'bg-slate-400'}`}>
                      {(isRoom ? activeRoom?.name : activeUser?.name)?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {!isRoom && (
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      activeUser?.status === 'online' ? 'bg-green-500' : 
                      activeUser?.status === 'idle' ? 'bg-yellow-500' : 'bg-slate-300'
                    }`} />
                  )}
                </div>
                <div className="cursor-pointer" onClick={() => setShowSettings(true)}>
                  <h3 className="font-bold text-slate-900 leading-tight flex items-center gap-1">
                    {isRoom ? activeRoom?.name : activeUser?.name}
                    {isRoom && <Users size={14} className="text-slate-400" />}
                  </h3>
                  <span className="text-[10px] font-medium text-slate-400">
                    {isRoom ? `${roomMembers.length} membres` : (activeUser?.status === 'online' ? 'En ligne' : 'Hors ligne')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowAddMemberModal(true)}
                  className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-colors"
                  title="Ajouter des membres"
                >
                  <UserPlus size={20} />
                </button>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-full transition-colors"
                  title="Paramètres"
                >
                  <Settings size={20} />
                </button>
              </div>
            </div>

            {/* Pinned Messages - WeChat Style */}
            {pinnedMessages.length > 0 && (
              <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 p-2 space-y-1">
                {pinnedMessages.map(msg => (
                  <div key={`pinned-${msg.id}`} className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-lg group">
                    <Pin size={10} className="text-primary flex-shrink-0" />
                    <p className="text-[10px] font-bold text-slate-600 truncate flex-1">
                      <span className="text-primary">{msg.senderName}:</span> {msg.content || 'Fichier joint'}
                    </p>
                    <button 
                      onClick={() => handleUnpinMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                    >
                      <PinOff size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 relative" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
                <div className="absolute inset-0 bg-[#E5DDD5] opacity-80" />
                <div className="relative z-10 space-y-4">
                  {messages
                    .filter(msg => msg.content?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((msg, idx) => {
                    const isMe = msg.senderId === currentUser?.id;
                    return (
                    <motion.div 
                      key={msg.id || idx} 
                      id={`msg-${msg.id}`} 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/msg mb-3`}
                    >
                        {!isMe && isRoom && (
                          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0 mr-2 mt-auto">
                            {msg.senderAvatar ? (
                              <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold bg-white">
                                {msg.senderName?.[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%] min-w-0`}>
                          <div 
                            className={`relative rounded-3xl px-5 py-3 text-[14px] shadow-sm hover:shadow-md transition-all break-words whitespace-pre-wrap w-full max-w-full ${
                              isMe 
                                ? 'bg-primary text-white rounded-br-none' 
                                : 'bg-white text-slate-800 rounded-lg rounded-bl-none border border-slate-100'
                            }`}
                          >
                            {!isMe && isRoom && (
                              <p className="text-[10px] font-black text-primary mb-1 uppercase tracking-widest">{msg.senderName}</p>
                            )}
                            
                            {msg.isPinned && (
                              <div className="flex items-center gap-1 mb-2 pb-1 border-b border-white/20">
                                <Pin size={10} className={isMe ? 'text-white' : 'text-primary'} />
                                <span className={`text-[9px] font-black uppercase tracking-tighter ${isMe ? 'text-white/80' : 'text-slate-400'}`}>Message épinglé</span>
                              </div>
                            )}

                            {msg.replyToId && (
                              <div 
                                className={`mb-2 p-2 rounded-xl border-l-4 text-xs cursor-pointer hover:bg-black/5 transition-colors min-w-0 overflow-hidden ${
                                  isMe ? 'bg-white/10 border-white/40' : 'bg-slate-50 border-primary/40'
                                }`}
                                onClick={() => {
                                  // Scroll to original message
                                  const el = document.getElementById(`msg-${msg.replyToId}`);
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  el?.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                  setTimeout(() => el?.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                                }}
                              >
                                <p className={`font-black uppercase tracking-widest text-[9px] mb-0.5 truncate ${isMe ? 'text-white/90' : 'text-primary'}`}>
                                  {msg.replySenderName || 'Utilisateur'}
                                </p>
                                <p className={`break-words ${isMe ? 'text-white/70' : 'text-slate-500'}`}>
                                  {msg.replyContent || 'Message supprimé ou introuvable'}
                                </p>
                              </div>
                            )}

                            {msg.fileUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden border border-slate-200/50 bg-slate-100/10 max-w-full">
                                {msg.fileType?.startsWith('image/') ? (
                                  <div className="relative group/media">
                                    <img 
                                      src={msg.fileUrl} 
                                      alt="Attached" 
                                      className="max-w-full h-auto cursor-pointer hover:scale-[1.02] transition-transform duration-500" 
                                      onClick={() => setPreviewMedia({ type: 'image', url: msg.fileUrl, name: msg.fileName })} 
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/media:opacity-100 pointer-events-none">
                                       <Maximize2 size={24} className="text-white drop-shadow-lg" />
                                    </div>
                                  </div>
                                ) : msg.fileType?.startsWith('video/') ? (
                                  <div 
                                    className="relative cursor-pointer aspect-video bg-black flex items-center justify-center group/video"
                                    onClick={() => setPreviewMedia({ type: 'video', url: msg.fileUrl, name: msg.fileName })}
                                  >
                                    <video src={msg.fileUrl} className="w-full h-full object-contain" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover/video:bg-black/60 transition-colors">
                                      <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center group-hover/video:scale-110 transition-transform">
                                        <Play size={20} className="text-white fill-white ml-1" />
                                      </div>
                                    </div>
                                  </div>
                                ) : msg.fileType?.startsWith('audio/') ? (
                                  <div 
                                    className="flex items-center gap-4 p-4 bg-slate-900 text-white rounded-xl cursor-pointer hover:bg-slate-800 transition-colors"
                                    onClick={() => setPreviewMedia({ type: 'audio', url: msg.fileUrl, name: msg.fileName })}
                                  >
                                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center animate-pulse">
                                      <Volume2 size={20} />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-bold truncate">{msg.fileName || 'Audio'}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                         {[...Array(12)].map((_, i) => (
                                           <div key={i} className="w-1 h-2 bg-white/30 rounded-full" />
                                         ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group/file">
                                    <div className={`p-3 rounded-2xl ${isMe ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                                      <FileText size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`truncate font-black text-sm ${isMe ? 'text-white' : 'text-slate-900'}`}>{msg.fileName || 'Fichier'}</p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <button 
                                          onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isMe ? 'text-white/70 hover:text-white' : 'text-primary hover:text-primary-hover'}`}
                                        >
                                          <Download size={10} /> TELECHARGER
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                {editingMessageId === msg.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      className={`w-full p-2 text-sm rounded-lg border outline-none ${
                                        isMe ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-50 border-slate-200'
                                      }`}
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button 
                                        onClick={() => {
                                          setEditingMessageId(null);
                                          setEditContent('');
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-red-500/20 text-red-100"
                                      >
                                        Annuler
                                      </button>
                                      <button 
                                        onClick={() => handleEditMessage(msg.id)}
                                        className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-green-500/20 text-green-100"
                                      >
                                        Enregistrer
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  msg.content && <p className="whitespace-pre-wrap leading-relaxed">{renderContentWithMentions(msg.content, isMe)}</p>
                                )}
                              </div>
                              
                              <div className="opacity-0 group-hover/msg:opacity-100 flex flex-col gap-1 transition-opacity translate-x-2">
                                <button 
                                  onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)}
                                  className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-110 ${
                                    isMe 
                                      ? 'bg-white/20 border-white/20 text-white hover:bg-white/30' 
                                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary'
                                  }`}
                                  title="Réagir"
                                >
                                  <Smile size={14} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setReplyTo(msg);
                                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-110 ${
                                    isMe 
                                      ? 'bg-white/20 border-white/20 text-white hover:bg-white/30' 
                                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary'
                                  }`}
                                  title="Répondre"
                                >
                                  <Reply size={14} />
                                </button>
                                {isMe && (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setEditingMessageId(msg.id);
                                        setEditContent(msg.content);
                                      }}
                                      className="p-1.5 rounded-lg border border-white/20 bg-white/20 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-white/30"
                                      title="Modifier"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      className="p-1.5 rounded-lg border border-white/20 bg-white/20 text-white backdrop-blur-sm transition-all hover:scale-110 hover:bg-red-500/40"
                                      title="Supprimer"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={() => msg.isPinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)}
                                  className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-110 ${
                                    isMe 
                                      ? 'bg-white/20 border-white/20 text-white hover:bg-white/30' 
                                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary'
                                  }`}
                                  title={msg.isPinned ? "Désépingler" : "Épingler"}
                                >
                                  {msg.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                </button>
                                {msg.fileUrl && (
                                   <button 
                                    onClick={() => downloadFile(msg.fileUrl, msg.fileName)}
                                    className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-110 ${
                                      isMe 
                                        ? 'bg-white/20 border-white/20 text-white hover:bg-white/30' 
                                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-primary'
                                    }`}
                                    title="Télécharger"
                                  >
                                    <DownloadCloud size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Reaction Picker Popover */}
                            <AnimatePresence>
                              {reactingToMessageId === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  className={`absolute bottom-full mb-2 ${isMe ? 'right-0' : 'left-0'} z-50 bg-white border border-slate-100 rounded-full shadow-xl px-2 py-1 flex items-center gap-1`}
                                >
                                  {REACTION_EMOJIS.map((re) => (
                                    <motion.button
                                      key={re.label}
                                      whileHover={{ scale: 1.4, rotate: [0, -10, 10, 0] }}
                                      whileTap={{ scale: 0.8 }}
                                      onClick={() => handleReact(msg.id, re.emoji)}
                                      className="text-2xl p-1.5 hover:bg-slate-50 rounded-full transition-colors"
                                    >
                                      {re.emoji}
                                    </motion.button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Reactions Display */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {Object.entries(
                                  msg.reactions.reduce((acc: any, r: any) => {
                                    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                    return acc;
                                  }, {})
                                ).map(([emoji, count]: [string, any]) => {
                                  const hasMyReaction = msg.reactions.some((r: any) => r.userId === currentUser?.id && r.emoji === emoji);
                                  return (
                                    <motion.button
                                      key={emoji}
                                      initial={{ scale: 0, bounce: 0.5 }}
                                      animate={{ scale: 1 }}
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleReact(msg.id, emoji)}
                                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black transition-all shadow-sm ${
                                        hasMyReaction 
                                          ? 'bg-primary/20 border border-primary/30 text-primary scale-110' 
                                          : 'bg-white/80 backdrop-blur-sm border border-slate-100 text-slate-500 hover:bg-white'
                                      }`}
                                    >
                                      <motion.span
                                        animate={hasMyReaction ? { scale: [1, 1.2, 1] } : {}}
                                        transition={{ repeat: hasMyReaction ? Infinity : 0, duration: 2 }}
                                      >
                                        {emoji}
                                      </motion.span>
                                      {count > 1 && <span>{count}</span>}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            )}

                            <div className={`flex items-center justify-end gap-1 mt-1.5 ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                              <span className="text-[10px] font-black tracking-widest uppercase">
                                {format(new Date(msg.createdAt), 'HH:mm')}
                              </span>
                              {isMe && (
                                msg.read ? (
                                  <CheckCheck size={14} className="text-white" />
                                ) : (
                                  <Check size={14} className="text-white/60" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Settings Panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    className="absolute inset-y-0 right-0 w-full md:w-80 bg-white border-l border-slate-100 z-40 shadow-xl flex flex-col"
                  >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg text-slate-900">Paramètres du chat</h3>
                      <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                        <XIcon size={20} />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                      {/* Room Info */}
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center relative group">
                          {(isRoom ? activeRoom?.avatarUrl : activeUser?.avatarUrl) ? (
                            <img src={isRoom ? activeRoom.avatarUrl : activeUser.avatarUrl} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center text-white text-3xl font-bold rounded-full ${isRoom ? 'bg-primary' : 'bg-slate-400'}`}>
                              {(isRoom ? activeRoom?.name : activeUser?.name)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          {isRoom && (
                            <button 
                              onClick={() => groupAvatarInputRef.current?.click()}
                              className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity flex items-center justify-center"
                            >
                              <Edit3 size={24} />
                            </button>
                          )}
                        </div>
                        {isRoom && (
                          <input 
                            type="file"
                            ref={groupAvatarInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleGroupAvatarChange}
                          />
                        )}
                        {isRoom ? (
                          <div className="w-full space-y-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Nom du groupe</label>
                              <input 
                                type="text" 
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                className="w-full text-center font-bold text-xl text-slate-900 bg-slate-50 border border-slate-100 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl outline-none px-4 py-2 transition-all"
                                placeholder="Nom du groupe"
                              />
                            </div>
                            
                            {activeRoom?.name !== roomName && (
                              <motion.button
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={handleUpdateRoom}
                                disabled={isSavingRoom}
                                className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isSavingRoom ? (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <Check size={18} />
                                )}
                                Enregistrer le nom
                              </motion.button>
                            )}
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-bold text-xl text-slate-900">{activeUser?.name}</h4>
                            <p className="text-sm text-slate-500">{activeUser?.profession}</p>
                          </div>
                        )}
                      </div>

                      {/* Members Section */}
                      {isRoom && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-slate-900 text-sm">Membres ({roomMembers.length})</h4>
                            <button 
                              onClick={() => setShowAddMemberModal(true)}
                              className="text-primary hover:underline text-xs font-bold"
                            >
                              Ajouter
                            </button>
                          </div>
                          <div className="space-y-3">
                            {roomMembers.map(member => (
                              <div key={member.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                                  {member.avatarUrl ? (
                                    <img src={member.avatarUrl} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold bg-white">
                                      {member.name?.[0]?.toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{member.name}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{member.profession}</p>
                                </div>
                                {member.id === currentUser?.id && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Moi</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="space-y-2 pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => {
                            if (isSearching) setSearchQuery('');
                            setIsSearching(!isSearching);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-sm font-medium ${isSearching ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          <Search size={18} />
                          Rechercher dans le chat
                        </button>
                        {isSearching && (
                          <div className="px-3 pb-3 -mt-2">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Rechercher des messages..."
                              className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                              autoFocus
                            />
                            <p className="text-[10px] text-slate-400 mt-1 pl-1">Filtrer par mot-clé</p>
                          </div>
                        )}
                        <button 
                          onClick={async () => {
                            if (!confirm('Voulez-vous vraiment effacer l\'historique ?')) return;
                            try {
                              const actualId = isRoom ? Number(id?.replace('room_', '')) : Number(id);
                              await api.messages.clearHistory(actualId);
                              setMessages([]);
                              const updatedConvs = await api.messages.getConversations();
                              setConversations(updatedConvs);
                              toast.success('Historique effacé');
                            } catch (err) {
                              console.error('Error clearing history:', err);
                              toast.error('Erreur lors de la suppression de l\'historique');
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-sm font-medium">
                          <Trash2 size={18} />
                          Effacer l'historique
                        </button>
                        <button 
                          onClick={async () => {
                            if (!confirm('Voulez-vous vraiment supprimer cette conversation ?')) return;
                            try {
                              const actualId = isRoom ? Number(id?.replace('room_', '')) : Number(id);
                              await api.messages.deleteConversation(actualId);
                              navigate('/messages');
                              toast.success('Conversation supprimée');
                            } catch (err) {
                              console.error('Error deleting conversation:', err);
                              toast.error('Erreur lors de la suppression de la conversation');
                            }
                          }}
                          className="w-full flex items-center gap-3 p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-bold">
                          <LogOut size={18} />
                          {isRoom ? 'Quitter le groupe' : 'Supprimer la conversation'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 relative">
              {/* Mention Suggestions */}
              <AnimatePresence>
                {showMentions && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden z-[60]"
                  >
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                       <AtSign size={14} className="text-primary" />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mentionner un utilisateur</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {allUsers
                        .filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleMentionSelect(user)}
                            className="w-full p-2 flex items-center gap-3 hover:bg-slate-50 rounded-2xl transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-[12px] bg-slate-200 overflow-hidden flex-shrink-0">
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[10px] font-black bg-white">
                                  {user.name?.[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-slate-900 text-xs truncate">{user.name}</h4>
                            </div>
                          </button>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {replyTo && (
                <div className="absolute bottom-full left-0 right-0 p-3 bg-slate-50/90 backdrop-blur-sm border-t border-slate-200 flex items-center gap-4 animate-in slide-in-from-bottom-2">
                  <div className="w-1 bg-primary self-stretch rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">Réponse à {replyTo.senderName}</p>
                    <p className="text-xs text-slate-500 truncate">{replyTo.content || 'Fichier joint'}</p>
                  </div>
                  <button 
                    onClick={() => setReplyTo(null)}
                    className="p-2 hover:bg-slate-200 rounded-full text-slate-400"
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              )}
              {filePreview && (
                <div className="absolute bottom-full left-0 right-0 p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-4 animate-in slide-in-from-bottom-2">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                    {selectedFile?.type.startsWith('image/') ? (
                      <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : selectedFile?.type.startsWith('video/') ? (
                      <video src={filePreview} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary">
                        <Paperclip size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{selectedFile?.name}</p>
                    <p className="text-xs text-slate-500">{(selectedFile?.size || 0) / 1024 > 1024 ? `${((selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB` : `${((selectedFile?.size || 0) / 1024).toFixed(1)} KB`}</p>
                  </div>
                  <button 
                    onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                    className="p-2 hover:bg-slate-200 rounded-full text-slate-500"
                  >
                    <XIcon size={20} />
                  </button>
                </div>
              )}
              {showEmojiPicker && (
                <div className="absolute bottom-20 left-4 z-50">
                  <EmojiPicker onEmojiClick={(emoji) => setNewMessage(prev => prev + emoji.emoji)} />
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-slate-400 hover:text-primary transition-colors"
                >
                  <Smile size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-primary transition-colors"
                >
                  <Paperclip size={20} />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="video/mp4,image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                />
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                <button 
                  type="submit"
                  disabled={(!newMessage.trim() && !selectedFile)}
                  className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex flex-col items-center justify-center p-4 md:p-10 backdrop-blur-xl"
          >
            <div className="absolute top-6 right-6 flex items-center gap-4">
              <button 
                onClick={() => downloadFile(previewMedia.url, previewMedia.name)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
              >
                <DownloadCloud size={20} /> Télécharger
              </button>
              <button 
                onClick={() => setPreviewMedia(null)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all"
              >
                <XIcon size={24} />
              </button>
            </div>

            <div className="w-full h-full flex items-center justify-center mt-10">
              {previewMedia.type === 'image' && (
                <motion.img 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={previewMedia.url} 
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                />
              )}
              {previewMedia.type === 'video' && (
                <motion.video 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  src={previewMedia.url} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-full rounded-2xl shadow-2xl" 
                />
              )}
              {previewMedia.type === 'audio' && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white/5 p-12 rounded-[48px] border border-white/10 flex flex-col items-center gap-8 text-center max-w-md w-full"
                >
                  <div className="w-32 h-32 rounded-full border-4 border-primary bg-primary/10 flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(var(--primary),0.3)]">
                    <Volume2 size={48} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white mb-2">{previewMedia.name || 'Audio File'}</h4>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Lecture en cours</p>
                  </div>
                  <audio src={previewMedia.url} controls autoPlay className="w-full" />
                </motion.div>
              )}
            </div>
            
            <p className="mt-8 text-white/50 text-xs font-black uppercase tracking-[0.2em]">{previewMedia.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xl text-slate-900">Nouveau message</h3>
              <button onClick={() => setShowNewChatModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <XIcon size={24} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un contact..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allUsers
                .filter(u => u.name.toLowerCase().includes(searchUser.toLowerCase()))
                .map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      navigate(`/messages/${user.id}`);
                      setShowNewChatModal(false);
                    }}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-2xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">{user.name}</h4>
                      <p className="text-xs text-slate-500">{user.profession}</p>
                    </div>
                    <Plus size={18} className="text-primary" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-xl text-slate-900">Ajouter des membres</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <XIcon size={24} />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un membre..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allUsers
                .filter(u => u.name.toLowerCase().includes(searchUser.toLowerCase()))
                .filter(u => !roomMembers.some(m => m.id === u.id))
                .map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleAddMembers([user.id])}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-2xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-white">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">{user.name}</h4>
                      <p className="text-xs text-slate-500">{user.profession}</p>
                    </div>
                    <Plus size={18} className="text-primary" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
