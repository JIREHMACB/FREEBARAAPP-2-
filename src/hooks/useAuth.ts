import { createContext, useContext } from 'react';
import type { UserContextType } from '../types/types'; // ⚠️ adapte si besoin

export const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
});

export const useAuth = () => {
  return useContext(UserContext);
};