
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configure a highly optimized QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data remains fresh for 5 minutes (prevents redundant fetches)
      cacheTime: 1000 * 60 * 30, // Keep data in memory for 30 minutes
      refetchOnWindowFocus: false, // Don't refetch just because user switched tabs
      retry: 1, // Only retry once on failure
    },
  },
});

export const QueryProvider = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
