import { create } from 'zustand';
import apiClient, { getInMemoryToken, setInMemoryToken, fetchCsrfToken, setOnUnauthorizedCallback } from '../api/client';

const useAuthStore = create((set) => {
  setOnUnauthorizedCallback(() => {
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  });

  return {
  user: null,
  token: null, // Virtual accessor for backwards-compatibility getters in hooks
  isAuthenticated: false,
  isLoading: true, // true by default to avoid flashing login on load
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await fetchCsrfToken();
      const { data } = await apiClient.post('/auth/login', { email, password });
      const accessToken = data.accessToken;
      setInMemoryToken(accessToken);

      set({
        user: data.user,
        token: accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV && password === 'Demo@123') {
        let demoUser = null;
        const normalizedEmail = (email || '').toLowerCase().trim();
        if (normalizedEmail === 'student@bookbuddy.com' || normalizedEmail === 'stu1001') {
          demoUser = { _id: 'STU1001', name: 'Demo Student', role: 'student', email: 'student@bookbuddy.com' };
        } else if (normalizedEmail === 'general@bookbuddy.com' || normalizedEmail === 'gen4001') {
          demoUser = { _id: 'GEN4001', name: 'General User', role: 'general', email: 'general@bookbuddy.com' };
        } else if (normalizedEmail === 'collegeadmin@bookbuddy.com' || normalizedEmail === 'col3001') {
          demoUser = { _id: 'COL3001', name: 'College Admin', role: 'college-admin', email: 'collegeadmin@bookbuddy.com' };
        } else if (normalizedEmail === 'admin@bookbuddy.com' || normalizedEmail === 'lib2001') {
          demoUser = { _id: 'LIB2001', name: 'Super Admin', role: 'super-admin', email: 'admin@bookbuddy.com' };
        }

        if (demoUser) {
          const demoToken = `demo-jwt-token-${demoUser.role}`;
          setInMemoryToken(demoToken);
          set({
            user: demoUser,
            token: demoToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
      }
      set({ 
        error: error.response?.data?.message || 'Login failed. Please verify server is running or credentials are correct.', 
        isLoading: false 
      });
      return false;
    }
  },

  register: async (name, email, password, idNumber, role) => {
    set({ isLoading: true, error: null });
    try {
      await fetchCsrfToken();
      const { data } = await apiClient.post('/auth/register', { name, email, password, studentId: idNumber, role });
      const accessToken = data.accessToken;
      setInMemoryToken(accessToken);

      set({
        user: data.user,
        token: accessToken,
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
    } catch (err) {
      console.error('Logout failed on server', err);
    } finally {
      setInMemoryToken(null);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  checkAuth: async () => {
    const currentToken = getInMemoryToken();
    if (import.meta.env.DEV && currentToken?.startsWith('demo-jwt-token')) {
      const currentRole = currentToken.replace('demo-jwt-token-', '');
      let demoUser = null;
      if (currentRole === 'student') demoUser = { _id: 'STU1001', name: 'Demo Student', role: 'student', email: 'student@bookbuddy.com' };
      else if (currentRole === 'general') demoUser = { _id: 'GEN4001', name: 'General User', role: 'general', email: 'general@bookbuddy.com' };
      else if (currentRole === 'college-admin') demoUser = { _id: 'COL3001', name: 'College Admin', role: 'college-admin', email: 'collegeadmin@bookbuddy.com' };
      else if (currentRole === 'super-admin') demoUser = { _id: 'LIB2001', name: 'Super Admin', role: 'super-admin', email: 'admin@bookbuddy.com' };

      set((state) => ({ user: state.user || demoUser, isLoading: false, isAuthenticated: true }));
      return true;
    }

    try {
      await fetchCsrfToken();

      // Silent token refresh using httpOnly cookie
      const { data } = await apiClient.post('/auth/refresh');
      const newToken = data.accessToken;
      setInMemoryToken(newToken);

      const profileRes = await apiClient.get('/auth/profile');
      set({
        user: profileRes.data.data,
        token: newToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      setInMemoryToken(null);
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },
};
});

export default useAuthStore;
