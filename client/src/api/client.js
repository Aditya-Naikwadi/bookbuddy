import axios from "axios";

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
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  if (match) return decodeURIComponent(match[2]);
  return null;
}

const rawBaseUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "/api/v1";

const getBaseUrl = (raw) => {
  if (!raw) return "/api/v1";
  if (raw.startsWith("/")) return raw;
  const trimmed = raw.replace(/\/$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
};

const apiClient = axios.create({
  baseURL: getBaseUrl(rawBaseUrl),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export const fetchCsrfToken = async () => {
  try {
    const { data } = await apiClient.get("/auth/csrf-token");
    if (data?.csrfToken) {
      setCsrfToken(data.csrfToken);
      return data.csrfToken;
    }
  } catch {
    const cookieCsrf = getCookie("_csrf");
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
    const stateChangingMethods = ["post", "put", "delete", "patch"];
    if (stateChangingMethods.includes(config.method?.toLowerCase())) {
      const csrf = inMemoryCsrfToken || getCookie("_csrf");
      if (csrf) {
        config.headers["x-csrf-token"] = csrf;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue = [];

const authChannel =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel("bookbuddy_auth_channel")
    : null;

export const broadcastLogout = () => {
  if (authChannel) {
    authChannel.postMessage({ type: "LOGOUT" });
  }
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("bookbuddy_logout", Date.now().toString());
  }
};

export const broadcastTokenRefreshed = (token) => {
  if (authChannel) {
    authChannel.postMessage({ type: "TOKEN_REFRESHED", token });
  }
};

let onUnauthorizedCallback = null;
export const setOnUnauthorizedCallback = (cb) => {
  onUnauthorizedCallback = cb;
};

if (authChannel) {
  authChannel.onmessage = (event) => {
    if (event.data?.type === "TOKEN_REFRESHED" && event.data?.token) {
      setInMemoryToken(event.data.token);
    } else if (event.data?.type === "LOGOUT") {
      setInMemoryToken(null);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "bookbuddy_logout") {
      setInMemoryToken(null);
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
  });
}

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

// Response Interceptor for 401 token refresh, transient 502/503/504 GET retries & 403 CSRF auto-recovery
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isGetMethod = originalRequest.method?.toLowerCase() === "get";
    const status = error.response?.status;

    // Retry transient 502/503/504 errors on idempotent GET requests (up to 2 retries)
    if (isGetMethod && [502, 503, 504].includes(status)) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      if (originalRequest._retryCount <= 2) {
        const delayMs = Math.pow(2, originalRequest._retryCount) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return apiClient(originalRequest);
      }
    }

    // Auto-recovery for 403 CSRF token errors on state-changing requests
    if (
      status === 403 &&
      !originalRequest._csrfRetried &&
      error.response?.data?.message?.toLowerCase().includes("csrf")
    ) {
      originalRequest._csrfRetried = true;
      const newCsrf = await fetchCsrfToken();
      if (newCsrf) {
        originalRequest.headers["x-csrf-token"] = newCsrf;
        return apiClient(originalRequest);
      }
    }

    // Skip 401 refresh logic for auth routes
    if (
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/registration") ||
      originalRequest.url?.includes("/auth/csrf-token")
    ) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
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
        const { data } = await apiClient.post("/auth/refresh");
        const newToken = data.accessToken;
        setInMemoryToken(newToken);
        broadcastTokenRefreshed(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        setInMemoryToken(null);
        broadcastLogout();

        if (onUnauthorizedCallback) {
          onUnauthorizedCallback();
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
