import { create } from "zustand";
import apiClient, {
  getInMemoryToken,
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
    isImpersonated: !!localStorage.getItem("originalSuperAdminToken"),
    originalSuperAdminToken:
      localStorage.getItem("originalSuperAdminToken") || null,

    startImpersonating: async (targetToken, targetUser) => {
      const currentToken = localStorage.getItem("token") || getInMemoryToken();
      if (currentToken) {
        localStorage.setItem("originalSuperAdminToken", currentToken);
      }
      localStorage.setItem("token", targetToken);
      setInMemoryToken(targetToken);
      set({
        token: targetToken,
        user: targetUser,
        isImpersonated: true,
        originalSuperAdminToken: currentToken,
      });
    },

    stopImpersonating: async () => {
      const origToken =
        localStorage.getItem("originalSuperAdminToken") ||
        useAuthStore.getState().originalSuperAdminToken;

      if (!origToken) return false;

      localStorage.setItem("token", origToken);
      localStorage.removeItem("originalSuperAdminToken");
      setInMemoryToken(origToken);

      try {
        const profileRes = await apiClient.get("/auth/profile");
        set({
          user: profileRes.data.data,
          token: origToken,
          isImpersonated: false,
          originalSuperAdminToken: null,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      } catch (err) {
        console.error("Failed to restore super admin profile:", err);
        setInMemoryToken(origToken);
        set({
          token: origToken,
          isImpersonated: false,
          originalSuperAdminToken: null,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }
    },

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
        localStorage.setItem("token", accessToken);

        set({
          user: data.user,
          token: accessToken,
          isAuthenticated: true,
          isLoading: false,
          mfaRequired: false,
          isImpersonated: false,
          originalSuperAdminToken: null,
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
        localStorage.setItem("token", accessToken);

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
        localStorage.setItem("token", accessToken);

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
        localStorage.removeItem("token");
        localStorage.removeItem("originalSuperAdminToken");
        broadcastLogout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          isImpersonated: false,
          originalSuperAdminToken: null,
        });
      }
    },

    checkAuth: async () => {
      try {
        await fetchCsrfToken();

        const storedToken = localStorage.getItem("token");
        if (storedToken) {
          setInMemoryToken(storedToken);
        }

        // Silent token refresh using httpOnly cookie if no storedToken
        if (!storedToken) {
          const { data } = await apiClient.post("/auth/refresh");
          const newToken = data.accessToken;
          setInMemoryToken(newToken);
          localStorage.setItem("token", newToken);
        }

        const profileRes = await apiClient.get("/auth/profile");
        const hasOriginalToken = !!localStorage.getItem(
          "originalSuperAdminToken",
        );

        set({
          user: profileRes.data.data,
          token: getInMemoryToken(),
          isAuthenticated: true,
          isLoading: false,
          isImpersonated: hasOriginalToken,
          originalSuperAdminToken:
            localStorage.getItem("originalSuperAdminToken") || null,
        });
        return true;
      } catch {
        // If stored token or refresh failed but originalSuperAdminToken exists, attempt to restore super admin
        const origToken = localStorage.getItem("originalSuperAdminToken");
        if (origToken) {
          setInMemoryToken(origToken);
          localStorage.setItem("token", origToken);
          localStorage.removeItem("originalSuperAdminToken");
          try {
            const profileRes = await apiClient.get("/auth/profile");
            set({
              user: profileRes.data.data,
              token: origToken,
              isAuthenticated: true,
              isLoading: false,
              isImpersonated: false,
              originalSuperAdminToken: null,
            });
            return true;
          } catch {
            // Fall through to logout
          }
        }

        setInMemoryToken(null);
        localStorage.removeItem("token");
        localStorage.removeItem("originalSuperAdminToken");
        broadcastLogout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          isImpersonated: false,
          originalSuperAdminToken: null,
        });
        return false;
      }
    },
  };
});

export default useAuthStore;
