import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const ConfigContext = createContext({
  googleClientId: "",
  razorpayKeyId: "",
  apiUrl: "/api/v1",
  isLoading: true,
});

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    googleClientId: "",
    razorpayKeyId: "rzp_test_bookbuddy_demo",
    apiUrl: "/api/v1",
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;
    axios
      .get("/api/v1/config/public")
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.config) {
          setConfig({
            ...res.data.config,
            isLoading: false,
          });
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
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
