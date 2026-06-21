import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/client';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          // Attempting to hit the auth API (mocked logic or real if backend is up)
          // For now, if the user types demo, we'll log them in, or if we have a real backend:
          const { data } = await apiClient.post('/auth/login', { email, password });
          set({
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          // Mocking fallback for demo if real backend auth fails (e.g. no DB connection)
          if (email === 'student@bookbuddy.com' && password === 'Demo@123') {
             set({
              user: { _id: 'STU1001', name: 'Demo Student', role: 'student' },
              token: 'demo-jwt-token-12345',
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }
          set({ 
            error: error.response?.data?.message || 'Login failed', 
            isLoading: false 
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch (e) {
          console.error('Logout failed on server');
        } finally {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
    }
  )
);

export default useAuthStore;
