import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with cross-origin requests
});

// Request interceptor to add token from Zustand persistent storage
apiClient.interceptors.request.use((config) => {
  let token = null;
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      token = parsed.state?.token;
    } catch (e) {
      console.error('Failed to parse auth-storage from localStorage', e);
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle global errors like 401 and refresh access token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops or attempts to refresh on auth endpoints
    if (
      !originalRequest ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post('/auth/refresh');
        const newToken = data.accessToken;

        // Update localStorage
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage);
            parsed.state.token = newToken;
            parsed.state.isAuthenticated = true;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          } catch (e) {
            console.error('Failed to update auth-storage localStorage', e);
          }
        }

        // Dynamically update Zustand store at runtime to avoid circular dependency
        const authStoreModule = await import('../store/authStore');
        authStoreModule.default.setState({ token: newToken, isAuthenticated: true });

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Revoke state and clean up on refresh failure
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage);
            parsed.state.token = null;
            parsed.state.user = null;
            parsed.state.isAuthenticated = false;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          } catch (e) {
            console.error('Failed to clean auth-storage localStorage', e);
          }
        }

        const authStoreModule = await import('../store/authStore');
        authStoreModule.default.setState({ token: null, user: null, isAuthenticated: false });

        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
