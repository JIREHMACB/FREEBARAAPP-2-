import { createContext, useContext } from 'react';
import type { UserContextType } from '../types';

export const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
});

export const useUser = () => useContext(UserContext);
