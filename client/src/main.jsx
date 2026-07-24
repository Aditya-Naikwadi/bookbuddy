import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { queryClient } from './lib/reactQuery.js';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.tsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-google-client-id.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
