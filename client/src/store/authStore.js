import { create } from "zustand";
import apiClient, {
  setInMemoryToken,
  fetchCsrfToken,
  setOnUnauthorizedCallback,
  broadcastLogout,
} from "../api/client";

const useAuthStore = create((set) => {
  setOnUnauthorizedCallback(() => {
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  });

  return {
    user: null,
    token: null, // Virtual accessor for backwards-compatibility getters in hooks
    isAuthenticated: false,
    isLoading: true, // true by default to avoid flashing login on load
    mfaRequired: false,

    login: async (identifier, password, totpCode = null) => {
      set({ isLoading: true, error: null, mfaRequired: false });
      try {
        await fetchCsrfToken();
        const payload = {
          password,
          ...(identifier.includes("@")
            ? { email: identifier.trim() }
            : { studentId: identifier.trim(), email: identifier.trim() }),
          ...(totpCode ? { totpCode: totpCode.trim() } : {}),
        };

        const { data } = await apiClient.post("/auth/login", payload);
        const accessToken = data.accessToken;
        setInMemoryToken(accessToken);

        set({
          user: data.user,
          token: accessToken,
          isAuthenticated: true,
          isLoading: false,
          mfaRequired: false,
        });
        return true;
      } catch (error) {
        const responseData = error.response?.data;
        const isMfaRequired = !!responseData?.mfaRequired;
        set({
          mfaRequired: isMfaRequired,
          error:
            responseData?.message ||
            "Login failed. Please verify your credentials or server connection.",
          isLoading: false,
        });
        return isMfaRequired ? { mfaRequired: true } : false;
      }
    },

    loginWithGoogle: async (idToken) => {
      set({ isLoading: true, error: null });
      try {
        await fetchCsrfToken();
        const { data } = await apiClient.post("/auth/google", { idToken });
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
          error:
            error.response?.data?.message ||
            "Google Login failed. Please try again.",
          isLoading: false,
        });
        return false;
      }
    },

    register: async (name, email, password, idNumber, role) => {
      set({ isLoading: true, error: null });
      try {
        await fetchCsrfToken();
        const { data } = await apiClient.post("/auth/register", {
          name,
          email,
          password,
          studentId: idNumber,
          role,
        });
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
          error: error.response?.data?.message || "Registration failed",
          isLoading: false,
        });
        return false;
      }
    },

    logout: async (allDevices = false) => {
      try {
        await apiClient.post("/auth/logout", { allDevices });
      } catch (err) {
        console.error("Logout failed on server", err);
      } finally {
        setInMemoryToken(null);
        broadcastLogout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    },

    checkAuth: async () => {
      try {
        await fetchCsrfToken();

        // Silent token refresh using httpOnly cookie
        const { data } = await apiClient.post("/auth/refresh");
        const newToken = data.accessToken;
        setInMemoryToken(newToken);

        const profileRes = await apiClient.get("/auth/profile");
        set({
          user: profileRes.data.data,
          token: newToken,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } catch {
        setInMemoryToken(null);
        broadcastLogout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return false;
      }
    },
  };
});

export default useAuthStore;
