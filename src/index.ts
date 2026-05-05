import type { User } from 'firebase/auth';

// ── Auth / User ────────────────────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  role?: string;
  createdAt?: string;
}

export interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

// ── Events ────────────────────────────────────────────────────────────────
export interface Event {
  id: string;
  uid: string;
  title: string;
  description: string;
  date: string;
  location?: string;
  coverUrl?: string;
  createdAt: string;
}

// ── Services ──────────────────────────────────────────────────────────────
export interface Service {
  id: string;
  uid: string;
  title: string;
  description: string;
  price?: number;
  category?: string;
  fileUrl?: string;
  coverUrl?: string;
  createdAt: string;
}

// ── Communities / Pannels ─────────────────────────────────────────────────
export interface Pannel {
  id: string;
  uid: string;
  name: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  members?: string[];
  createdAt: string;
}

// ── Messaging ─────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  name?: string;
  type: 'direct' | 'group';
  members: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isPinned?: boolean;
  reactions?: Record<string, string>; // userId -> emoji
  createdAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

// ── Documents (CV / Portfolio / Startup) ──────────────────────────────────
export type DocumentType = 'cv' | 'portfolio' | 'startup';

export interface UserDocument {
  uid: string;
  data: string; // JSON stringifié
  updatedAt: Date;
}
