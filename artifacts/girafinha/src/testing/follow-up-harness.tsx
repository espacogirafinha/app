import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { createRoot } from "react-dom/client";
import FollowUpPage from "@/pages/follow-up";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";

// Isolated local fixture only; the real SPA mounts AuthProvider instead.
if (import.meta.env.DEV && window.location.pathname.endsWith("/follow-up-test.html")) {
  setAuthTokenGetter(() => "playwright-isolated-test");
}

const queryClient = new QueryClient({ defaultOptions: {
  queries: { retry: false }, mutations: { retry: false },
} });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <FollowUpPage />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);
