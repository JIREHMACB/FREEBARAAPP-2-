import React from 'react';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

// ✅ CORRECTION : BASE_URL pour le socket, API_URL avec /api pour les requêtes
const BASE_URL = "https://www.freebara.com";
const API_URL = `${BASE_URL}/api`;
export const socket = io(BASE_URL, {
  path: "/socket.io",
  transports: ['websocket'],
  autoConnect: false,
});

export const connectSocket = () => {
  const token = localStorage.getItem('token');
  if (token) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
  }
};

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('Connexion serveur coupée, reconnexion bloquée.');
  }
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err.message);
  if (err.message.includes('Authentication error') || err.message === 'xhr poll error') {
    console.warn('Erreur de connexion socket, déconnexion.');
    socket.disconnect();
    // ✅ Ne pas supprimer le token ici - laisser l'API gérer ça
  } else {
    setTimeout(() => socket.connect(), 15000);
  }
});

export const disconnectSocket = () => {
  socket.disconnect();
};

let isRedirecting = false;

const handleApiError = (error: any, endpoint?: string, options?: RequestInit) => {
  let message = 'Une erreur inattendue est survenue';
  let description = 'Veuillez réessayer plus tard.';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    message = 'Problème de connexion';
    description = 'Le serveur est peut-être temporairement indisponible ou votre connexion est instable.';
  } else if (message.includes('Session expirée')) {
    localStorage.removeItem('token');
    if (isRedirecting) return new Promise(() => {});
    isRedirecting = true;
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    setTimeout(() => { isRedirecting = false; }, 5000);
    return new Promise(() => {});
  } else if (message.includes('Format de réponse invalide')) {
    description = 'Le serveur a renvoyé une réponse illisible.';
  }

  console.error('API Error Details:', { message, description, originalError: error, endpoint, options });

  if (!message.includes('Session expirée')) {
    toast.error(
      (t) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-sm">{message}</span>
            <span className="text-[10px] opacity-80">{description}</span>
          </div>
          <button
            onClick={() => { toast.dismiss(t.id); window.location.reload(); }}
            className="mt-2 px-3 py-1 bg-white text-slate-900 text-xs font-bold rounded-md hover:bg-slate-200 transition-colors"
          >
            Réessayer
          </button>
        </div>
      ),
      {
        id: message,
        duration: 8000,
        position: 'top-center',
        style: {
          borderRadius: '16px',
          background: '#1e293b',
          color: '#fff',
          padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      }
    );
  }

  throw error;
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 && retries > 0) {
      console.warn(`Rate limit hit for ${url}. Retrying after ${backoff}ms.`);
      await delay(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2 + Math.random() * 1000);
    }
    return response;
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Retrying fetch: ${url}. Retries left: ${retries}`);
    await delay(backoff);
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}

export const api = {
  async request(endpoint: string, options: RequestInit = {}) {
    try {
      const token = localStorage.getItem('token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fullUrl = `${API_URL}${endpoint}`;
      console.log('API Request:', fullUrl);
      const response = await fetchWithRetry(fullUrl, { ...options, headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API request failed:', { endpoint, status: response.status, errorText });
        let error;
        try {
          error = JSON.parse(errorText);
        } catch (e) {
          const snippet = errorText && errorText.length < 100 ? `: ${errorText}` : '';
          error = { error: `Erreur ${response.status}${snippet}` };
        }

        if (response.status === 401) {
          localStorage.removeItem('token');
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        }

        if (response.status === 403) {
          throw new Error(`Accès refusé sur ${endpoint}: ${error.error || 'Permissions insuffisantes.'}`);
        }

        if (response.status === 404) {
          throw new Error(`Ressource introuvable: ${fullUrl}`);
        }

        if (response.status >= 500) {
          throw new Error(`Erreur serveur (${response.status}). Veuillez réessayer.`);
        }

        const message = error.error || error.message || `Une erreur est survenue (Status: ${response.status})`;
        const details = error.details || (error.error && error.message ? error.message : '');
        throw new Error(details ? `${message} : ${details}` : message);
      }

      const text = await response.text();
      if (!text) return {};

      if (text.trim().startsWith('<')) {
        console.error('API Error: Server returned HTML. Endpoint:', endpoint);
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Erreur de format de réponse (JSON attendu)');
      }
    } catch (error) {
      return handleApiError(error, endpoint, options);
    }
  },

  auth: {
    requestOtp: (email: string, isRegister: boolean) =>
      api.request('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, isRegister }) }),
    verifyOtp: (email: string, code: string, isRegister: boolean, country?: string, referralCode?: string) =>
      api.request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, code, isRegister, country, referralCode }) }),
  },

  users: {
    me: () => api.request('/users/me'),
    getById: (id: number) => api.request(`/users/${id}`),
    updateProfile: (data: any) => api.request('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
    getAll: (filters: any = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'Tous' && value !== 'Toutes') params.append(key, value as string);
      });
      const queryString = params.toString();
      return api.request(`/users${queryString ? `?${queryString}` : ''}`);
    },
    connect: (id: number) => api.request(`/users/${id}/connect`, { method: 'POST' }),
    follow: (id: number) => api.request(`/users/${id}/follow`, { method: 'POST' }),
    getEvents: (id?: number) => api.request(id ? `/users/${id}/events` : '/users/me/events'),
    getServices: () => api.request('/users/me/services'),
    getFollowing: () => api.request('/users/me/following'),
    getNetworkRequests: () => api.request('/users/me/network-requests'),
    getConnections: () => api.request('/users/me/connections'),
    getCertifications: () => api.request('/users/me/certifications'),
    addCertification: (data: any) => api.request('/users/me/certifications', { method: 'POST', body: JSON.stringify(data) }),
    deleteCertification: (id: number) => api.request(`/users/me/certifications/${id}`, { method: 'DELETE' }),
    getFavoriteCompanies: () => api.request('/users/me/favorite-companies'),
    getFavoriteProducts: () => api.request('/users/me/favorite-products'),
    updateBudgetProposal: (proposalId: number, data: any) => api.request(`/users/me/budget-proposals/${proposalId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getTransactions: () => api.request('/users/me/transactions'),
    addTransaction: (data: any) => api.request('/users/me/transactions', { method: 'POST', body: JSON.stringify(data) }),
    deleteAccount: () => api.request('/users/me', { method: 'DELETE' }),
    search: (query: string) => api.request(`/users/search?q=${encodeURIComponent(query)}`),
  },

  notifications: {
    getAll: () => api.request('/notifications'),
    markAsRead: (id: number) => api.request(`/notifications/${id}/read`, { method: 'PUT' }),
  },

  events: {
    getAll: () => api.request('/events'),
    getById: (id: number) => api.request(`/events/${id}`),
    create: (data: any) => api.request('/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => api.request(`/events/${id}`, { method: 'DELETE' }),
    participate: (id: number) => api.request(`/events/${id}/participate`, { method: 'POST' }),
    unparticipate: (id: number) => api.request(`/events/${id}/participate`, { method: 'DELETE' }),
    favorite: (id: number) => api.request(`/events/${id}/favorite`, { method: 'POST' }),
    share: (id: number) => api.request(`/events/${id}/share`, { method: 'POST' }),
    getComments: (id: number) => api.request(`/events/${id}/comments`),
    addComment: (id: number, content: string) => api.request(`/events/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    invite: (id: number, userIds: number[]) => api.request(`/events/${id}/invite`, { method: 'POST', body: JSON.stringify({ userIds }) }),
    getParticipants: (id: number) => api.request(`/events/${id}/participants`),
  },

  posts: {
    getAll: (page = 1, limit = 10, category = 'Tous', country = 'Tous', authorId?: number, feedType?: string, search?: string) => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (category && category !== 'Tous') params.append('category', category);
      if (country && country !== 'Tous') params.append('country', country);
      if (authorId) params.append('authorId', authorId.toString());
      if (feedType) params.append('feedType', feedType);
      if (search) params.append('search', search);
      return api.request(`/posts?${params.toString()}`);
    },
    create: (data: any) => api.request('/posts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, content: string) => api.request(`/posts/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
    delete: (id: number) => api.request(`/posts/${id}`, { method: 'DELETE' }),
    toggleLike: (id: number, type: string = 'like') => api.request(`/posts/${id}/like`, { method: 'POST', body: JSON.stringify({ type }) }),
    getComments: (id: number) => api.request(`/posts/${id}/comments`),
    getReactions: (id: number) => api.request(`/posts/${id}/reactions`),
    addComment: (id: number, content: string) => api.request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
    updateComment: (postId: number, commentId: number, content: string) => api.request(`/posts/${postId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
    deleteComment: (postId: number, commentId: number) => api.request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' }),
    incrementView: (id: number) => api.request(`/posts/${id}/view`, { method: 'POST' }),
    boost: (id: number, amount: number) => api.request(`/posts/${id}/boost`, { method: 'POST', body: JSON.stringify({ amount }) }),
  },

  countries: {
    getAll: () => api.request('/countries'),
  },

  stories: {
    getAll: () => api.request('/stories'),
    getArchives: () => api.request('/stories/archives'),
    create: (data: any) => api.request('/stories', { method: 'POST', body: JSON.stringify(data) }),
  },

  services: {
    getAll: () => api.request('/services'),
    create: (data: any) => api.request('/services', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => api.request(`/services/${id}`, { method: 'DELETE' }),
    apply: (id: number, message: string, contactDetails: string) => api.request(`/services/${id}/apply`, { method: 'POST', body: JSON.stringify({ message, contactDetails }) }),
    getApplications: (id: number) => api.request(`/services/${id}/applications`),
    updateApplicationStatus: (serviceId: number, applicationId: number, status: string) => api.request(`/services/${serviceId}/applications/${applicationId}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },

  companies: {
    getAll: () => api.request('/companies'),
    getNew: () => api.request('/companies/new'),
    getTrending: () => api.request('/companies/trending'),
    getRecentProducts: () => api.request('/products/recent'),
    getPromotions: () => api.request('/products/promotions'),
    create: (data: any) => api.request('/companies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => api.request(`/companies/${id}`, { method: 'DELETE' }),
    favorite: (id: number) => api.request(`/companies/${id}/favorite`, { method: 'POST' }),
    unfavorite: (id: number) => api.request(`/companies/${id}/favorite`, { method: 'DELETE' }),
    getCatalog: (id: number) => api.request(`/companies/${id}/catalog`),
    addProduct: (id: number, data: any) => api.request(`/companies/${id}/catalog`, { method: 'POST', body: JSON.stringify(data) }),
    updateProduct: (companyId: number, productId: number, data: any) => api.request(`/companies/${companyId}/catalog/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteProduct: (companyId: number, productId: number) => api.request(`/companies/${companyId}/catalog/${productId}`, { method: 'DELETE' }),
    getStock: (companyId: number) => api.request(`/companies/${companyId}/stock`),
    getStockMovements: (companyId: number, productId: number) => api.request(`/companies/${companyId}/stock-movements/${productId}`),
    updateStock: (companyId: number, productId: number, data: { quantity: number, minQuantity?: number, reason?: string, costPrice?: number }) => api.request(`/companies/${companyId}/stock/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getOrders: (id: number) => api.request(`/companies/${id}/orders`),
    createOrder: (id: number, data: any) => api.request(`/companies/${id}/orders`, { method: 'POST', body: JSON.stringify(data) }),
    updateOrderStatus: (orderId: number, status: string) => api.request(`/orders/${orderId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    getInsights: (id: number) => api.request(`/companies/${id}/insights`),
    submitFundingRequest: (id: number, data: { fundingType: string, amount: number, reason: string, institutionId?: number, strategicData?: any }) => api.request(`/companies/${id}/funding-request`, { method: 'POST', body: JSON.stringify(data) }),
    getMyFundingRequests: () => api.request('/funding-requests/my'),
    updateFundingRequestStatus: (requestId: number, status: string) => api.request(`/funding-requests/${requestId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    updateManager: (id: number, managerId: number | null) => api.request(`/companies/${id}/manager`, { method: 'PUT', body: JSON.stringify({ managerId }) }),
    resignManager: (id: number) => api.request(`/companies/${id}/resign-manager`, { method: 'POST' }),
    favoriteProduct: (id: number) => api.request(`/products/${id}/favorite`, { method: 'POST' }),
    unfavoriteProduct: (id: number) => api.request(`/products/${id}/favorite`, { method: 'DELETE' }),
    shareProduct: (id: number) => api.request(`/products/${id}/share`, { method: 'POST' }),
  },

  ads: {
    create: (data: any) => api.request('/ads', { method: 'POST', body: JSON.stringify(data) }),
    getByCompany: (companyId: number) => api.request(`/ads/${companyId}`),
  },

  institutions: {
    getAll: () => api.request('/credit-institutions'),
    getMy: () => api.request('/credit-institutions/my'),
    create: (data: any) => api.request('/credit-institutions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/credit-institutions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getRequests: (id: number) => api.request(`/credit-institutions/${id}/requests`),
  },

  messages: {
    getConversations: (limit?: number, offset?: number) =>
      api.request(limit !== undefined ? `/conversations?limit=${limit}&offset=${offset || 0}` : '/conversations'),
    getConversation: (userId: number) => api.request(`/messages/${userId}`),
    send: (userId: number, content: string, fileData?: any) =>
      api.request(`/messages/${userId}`, { method: 'POST', body: JSON.stringify({ content, ...fileData }) }),
    markAsRead: (userId: number) => api.request(`/messages/${userId}/read`, { method: 'PUT' }),
    clearHistory: (userId: number) => api.request(`/messages/${userId}/history`, { method: 'DELETE' }),
    deleteConversation: (userId: number) => api.request(`/messages/${userId}`, { method: 'DELETE' }),
    createRoom: (data: { name?: string, type: 'direct' | 'group', memberIds: number[], avatarUrl?: string }) =>
      api.request('/chat-rooms', { method: 'POST', body: JSON.stringify(data) }),
    getRoomMessages: (roomId: number) => api.request(`/chat-rooms/${roomId}/messages`),
    sendRoomMessage: (roomId: number, content: string, fileData?: any) =>
      api.request(`/chat-rooms/${roomId}/messages`, { method: 'POST', body: JSON.stringify({ content, ...fileData }) }),
    addRoomMembers: (roomId: number, userIds: number[]) =>
      api.request(`/chat-rooms/${roomId}/members`, { method: 'POST', body: JSON.stringify({ userIds }) }),
    getRoomMembers: (roomId: number) => api.request(`/chat-rooms/${roomId}/members`),
    updateRoom: (roomId: number, data: { name?: string, avatarUrl?: string }) =>
      api.request(`/chat-rooms/${roomId}`, { method: 'PUT', body: JSON.stringify(data) }),
    pinMessage: (id: number) => api.request(`/messages/${id}/pin`, { method: 'PUT' }),
    unpinMessage: (id: number) => api.request(`/messages/${id}/unpin`, { method: 'PUT' }),
    addReaction: (id: number, emoji: string) => api.request(`/messages/${id}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),
    updateMessage: (id: number, content: string) => api.request(`/messages/item/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
    deleteMessage: (id: number) => api.request(`/messages/item/${id}`, { method: 'DELETE' }),
  },

  cells: {
    getMe: () => api.request('/cells/me'),
    getAll: () => api.request('/cells/all'),
    create: (data: any) => api.request('/cells', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/cells/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addMember: (id: number, userId: number) => api.request(`/cells/${id}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
    getMembers: (id: number) => api.request(`/cells/${id}/members`),
    delete: (id: number) => api.request(`/cells/${id}`, { method: 'DELETE' }),
  },

  courses: {
    getAll: () => api.request('/courses/all'),
  },

  pannels: {
    getAll: () => api.request('/pannels'),
    getMy: () => api.request('/pannels/my'),
    getById: (id: number) => api.request(`/pannels/${id}`),
    create: (data: any) => api.request('/pannels', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/pannels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => api.request(`/pannels/${id}`, { method: 'DELETE' }),
    join: (id: number) => api.request(`/pannels/${id}/join`, { method: 'POST' }),
    addMemberByAdmin: (id: number, userId: number) => api.request(`/pannels/${id}/add-member`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removeMember: (id: number, userId: number) => api.request(`/pannels/${id}/members/${userId}`, { method: 'DELETE' }),
    getCourses: (id: number) => api.request(`/pannels/${id}/courses`),
    addCourse: (id: number, data: any) => api.request(`/pannels/${id}/courses`, { method: 'POST', body: JSON.stringify(data) }),
    deleteCourse: (pannelId: number, courseId: number) => api.request(`/pannels/${pannelId}/courses/${courseId}`, { method: 'DELETE' }),
    learnCourse: (pannelId: number, courseId: number, data: any = { status: 'completed' }) =>
      api.request(`/pannels/${pannelId}/courses/${courseId}/learn`, { method: 'POST', body: JSON.stringify(data) }),
    toggleFavorite: (pannelId: number, courseId: number) =>
      api.request(`/pannels/${pannelId}/courses/${courseId}/favorite`, { method: 'POST' }),
    getCourseProgress: (pannelId: number, courseId: number) =>
      api.request(`/pannels/${pannelId}/courses/${courseId}/progress`),
    getCourseComments: (pannelId: number, courseId: number) =>
      api.request(`/pannels/${pannelId}/courses/${courseId}/comments`),
    addCourseComment: (pannelId: number, courseId: number, data: any) =>
      api.request(`/pannels/${pannelId}/courses/${courseId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
    getEvaluations: (id: number) => api.request(`/pannels/${id}/evaluations`),
    addEvaluation: (id: number, data: any) => api.request(`/pannels/${id}/evaluations`, { method: 'POST', body: JSON.stringify(data) }),
    getBadges: (id: number) => api.request(`/pannels/${id}/badges`),
    addBadge: (id: number, badgeType: string) => api.request(`/pannels/${id}/badges`, { method: 'POST', body: JSON.stringify({ badgeType }) }),
    getMembers: (id: number) => api.request(`/pannels/${id}/members`),
    updateMemberRole: (id: number, userId: number, role: string) =>
      api.request(`/pannels/${id}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    getStats: (id: number) => api.request(`/pannels/${id}/stats`),
    getForum: (id: number) => api.request(`/pannels/${id}/forum`),
    addForumMessage: (id: number, content: string) =>
      api.request(`/pannels/${id}/forum`, { method: 'POST', body: JSON.stringify({ content }) }),
  },

  churches: {
    getAll: () => api.request('/churches'),
    create: (data: any) => api.request('/churches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => api.request(`/churches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => api.request(`/churches/${id}`, { method: 'DELETE' }),
    claim: (churchName: string) => api.request('/users/me/claim-church', { method: 'POST', body: JSON.stringify({ churchName }) }),
  },

  reviews: {
    get: (targetType: 'company' | 'product', targetId: number) => api.request(`/reviews/${targetType}/${targetId}`),
    add: (data: { targetType: 'company' | 'product', targetId: number, rating: number, comment: string }) =>
      api.request('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  },
};