import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/client';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true, // true by default to avoid flashing login on load
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiClient.post('/auth/login', { email, password });
          const token = data.accessToken || data.token;
          set({
            user: data.user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          localStorage.setItem('bookbuddy_had_account', 'true');
          return true;
        } catch (error) {
          // Fallback ONLY if there is no response from the server (e.g. server is down) and it matches the demo credentials
          if (import.meta.env.DEV && !error.response && email === 'student@bookbuddy.com' && password === 'Demo@123') {
             set({
              user: { _id: 'STU1001', name: 'Demo Student', role: 'student' },
              token: 'demo-jwt-token-12345',
              isAuthenticated: true,
              isLoading: false,
            });
            localStorage.setItem('bookbuddy_had_account', 'true');
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
          const token = data.accessToken || data.token;
          set({
            user: data.user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          localStorage.setItem('bookbuddy_had_account', 'true');
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
        } catch (err) {
          console.error('Logout failed on server', err);
        } finally {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },

      checkAuth: async () => {
        const state = get();
        
        // If there's no access token, attempt a silent token refresh using the httpOnly cookie
        if (!state.token) {
          try {
            const { data } = await apiClient.post('/auth/refresh');
            const newToken = data.accessToken;
            set({ token: newToken, isAuthenticated: true });
            
            const profileRes = await apiClient.get('/auth/profile');
            set({
              user: profileRes.data.data,
              isLoading: false,
            });
            localStorage.setItem('bookbuddy_had_account', 'true');
            return true;
          } catch {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            return false;
          }
        }

        // If there is an access token, verify it by loading the profile
        try {
          const { data } = await apiClient.get('/auth/profile');
          set({
            user: data.data,
            isAuthenticated: true,
            isLoading: false,
          });
          localStorage.setItem('bookbuddy_had_account', 'true');
          return true;
        } catch {
          // If profile check fails, attempt refresh
          try {
            const { data } = await apiClient.post('/auth/refresh');
            const newToken = data.accessToken;
            set({ token: newToken, isAuthenticated: true });
            
            const profileRes = await apiClient.get('/auth/profile');
            set({
              user: profileRes.data.data,
              isLoading: false,
            });
            localStorage.setItem('bookbuddy_had_account', 'true');
            return true;
          } catch {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            return false;
          }
        }
      },
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
