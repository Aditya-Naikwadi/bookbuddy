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
          const { data } = await apiClient.post('/auth/login', { email, password });
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          // Fallback ONLY if there is no response from the server (e.g. server is down) and it matches the demo credentials
          if (!error.response && email === 'student@bookbuddy.com' && password === 'Demo@123') {
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

      register: async (name, email, password, idNumber, role) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiClient.post('/auth/register', { name, email, password, studentId: idNumber, role });
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        } catch (error) {
          set({ 
            error: error.response?.data?.message || 'Registration failed', 
            isLoading: false 
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch {
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
