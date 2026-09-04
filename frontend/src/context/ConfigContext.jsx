/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../api/client";

const ConfigContext = createContext({
  googleClientId: "",
  razorpayKeyId: "",
  apiUrl: "/api/v1",
  isLoading: true,
});

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    googleClientId: "",
    razorpayKeyId: "",
    apiUrl: "/api/v1",
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get("/config/public")
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.config) {
          setConfig({
            ...res.data.config,
            isLoading: false,
          });
        }
      })
      .catch((err) => {
        console.warn(
          "Could not fetch public config from backend:",
          err.message,
        );
        if (isMounted) {
          setConfig((prev) => ({ ...prev, isLoading: false }));
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
