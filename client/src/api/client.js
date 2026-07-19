import axios from 'axios';

let inMemoryAccessToken = null;
let inMemoryCsrfToken = null;

export const getInMemoryToken = () => inMemoryAccessToken;
export const setInMemoryToken = (token) => {
  inMemoryAccessToken = token;
};

export const getCsrfToken = () => inMemoryCsrfToken;
export const setCsrfToken = (csrf) => {
  inMemoryCsrfToken = csrf;
};

function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const fetchCsrfToken = async () => {
  try {
    const { data } = await apiClient.get('/auth/csrf-token');
    if (data?.csrfToken) {
      setCsrfToken(data.csrfToken);
      return data.csrfToken;
    }
  } catch {
    const cookieCsrf = getCookie('_csrf');
    if (cookieCsrf) {
      setCsrfToken(cookieCsrf);
      return cookieCsrf;
    }
  }
};

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }

    // Attach CSRF header on state-changing requests
    const stateChangingMethods = ['post', 'put', 'delete', 'patch'];
    if (stateChangingMethods.includes(config.method?.toLowerCase())) {
      const csrf = inMemoryCsrfToken || getCookie('_csrf');
      if (csrf) {
        config.headers['x-csrf-token'] = csrf;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

let onUnauthorizedCallback = null;
export const setOnUnauthorizedCallback = (cb) => {
  onUnauthorizedCallback = cb;
};

// Response Interceptor for 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      !originalRequest ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/csrf-token')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post('/auth/refresh');
        const newToken = data.accessToken;
        setInMemoryToken(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        setInMemoryToken(null);

        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
