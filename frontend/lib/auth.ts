'use client';
import { create } from 'zustand';
import { User } from '@/types';
import { api } from './api';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { username: string; email: string; password: string; display_name: string }) => Promise<User>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,

  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.login(email, password);
      set({ user: res.user, loading: false });
      return res.user;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  register: async (data) => {
    set({ loading: true });
    try {
      const res = await api.register(data);
      set({ user: res.user, loading: false });
      return res.user;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    api.logout();
    set({ user: null });
    window.location.href = '/login';
  },

  initialize: async () => {
    if (typeof window === 'undefined') {
      set({ initialized: true });
      return;
    }
    const token = localStorage.getItem('jc_token');
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await api.getMe();
      set({ user, initialized: true });
    } catch {
      localStorage.removeItem('jc_token');
      localStorage.removeItem('jc_refresh');
      set({ user: null, initialized: true });
    }
  },
}));
