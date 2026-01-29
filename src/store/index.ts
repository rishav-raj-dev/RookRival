import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface GameStore {
  currentGameId: string | null;
  setCurrentGameId: (gameId: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  currentGameId: null,
  setCurrentGameId: (gameId) => set({ currentGameId: gameId }),
}));
