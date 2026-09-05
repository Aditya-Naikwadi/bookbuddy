import axios from "axios";

let inMemoryAccessToken =
  typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
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
  // Enforce relative Vite proxy path in local dev to avoid cross-port cookie drops
  if (
    typeof window !== "undefined" &&
    (raw.includes("localhost:5000") || raw.includes("127.0.0.1:5000")) &&
    window.location.hostname === "localhost"
  ) {
    return "/api/v1";
  }
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
    const token =
      inMemoryAccessToken ||
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("token")
        : null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

let isLoggingOut = false;

export const setIsLoggingOut = (val) => {
  isLoggingOut = Boolean(val);
};

export const getIsLoggingOut = () => isLoggingOut;

let refreshSingleFlightPromise = null;

export const refreshTokenSingleFlight = async () => {
  if (isLoggingOut) {
    return Promise.reject(new Error("Logout in progress"));
  }

  if (refreshSingleFlightPromise) {
    return refreshSingleFlightPromise;
  }

  refreshSingleFlightPromise = (async () => {
    try {
      const { data } = await apiClient.post("/auth/refresh");
      const newToken = data?.accessToken;
      if (newToken) {
        setInMemoryToken(newToken);
        localStorage.setItem("token", newToken);
        broadcastTokenRefreshed(newToken);
      }
      return data;
    } catch (err) {
      const status = err?.response?.status;
      // Only clear credentials & trigger forced logout on genuine 401/403 authorization failure
      if (status === 401 || status === 403) {
        setInMemoryToken(null);
        localStorage.removeItem("token");
        if (!isLoggingOut) {
          broadcastLogout();
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
        }
      }
      throw err;
    } finally {
      refreshSingleFlightPromise = null;
    }
  })();

  return refreshSingleFlightPromise;
};

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
      if (onUnauthorizedCallback && !isLoggingOut) {
        onUnauthorizedCallback();
      }
    }
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === "bookbuddy_logout") {
      setInMemoryToken(null);
      if (onUnauthorizedCallback && !isLoggingOut) {
        onUnauthorizedCallback();
      }
    }
  });
}

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

    // Skip 401 refresh logic for auth routes or during active logout
    if (
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/logout") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/registration") ||
      originalRequest.url?.includes("/auth/csrf-token") ||
      isLoggingOut
    ) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshData = await refreshTokenSingleFlight();
        const newToken = refreshData?.accessToken;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
