import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Analytics } from "@vercel/analytics/react";
import { queryClient } from "./lib/reactQuery.js";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { ConfigProvider, useConfig } from "./context/ConfigContext.jsx";

function DynamicGoogleOAuthProvider({ children }) {
  const { googleClientId } = useConfig();
  // Provide clientId to GoogleOAuthProvider dynamically from backend config only when valid
  if (
    !googleClientId ||
    typeof googleClientId !== "string" ||
    !googleClientId.trim()
  ) {
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId.trim()}>
      {children}
    </GoogleOAuthProvider>
  );
}

function DeferredAnalytics() {
  const [shouldRender, setShouldRender] = useState(false);
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const handle = requestIdleCallback(() => setShouldRender(true), {
        timeout: 3000,
      });
      return () => cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(() => setShouldRender(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.MODE === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) =>
          console.log("[PWA SW] Registered successfully:", reg.scope),
        )
        .catch((err) => console.warn("[PWA SW] Registration failed:", err));
    }
  }, []);

  return shouldRender ? <Analytics /> : null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider>
      <DynamicGoogleOAuthProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <App />
            <DeferredAnalytics />
          </ThemeProvider>
        </QueryClientProvider>
      </DynamicGoogleOAuthProvider>
    </ConfigProvider>
  </StrictMode>,
);
