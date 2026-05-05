import type { User } from 'firebase/auth';

export type UserProfile = {
  name?: string;
  email?: string;
};

export type UserContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
};