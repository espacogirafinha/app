import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";
import { NotificationCenter } from "@/components/notification-center";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/lib/supabase";
import "@/index.css";

Object.defineProperty(supabase.auth, "getSession", {
  configurable: true,
  value: async () => ({
    data: {
      session: {
        access_token: "test-token",
      },
    },
    error: null,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter>
        <div className="flex min-h-screen items-start justify-end p-6">
          <NotificationCenter />
        </div>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);
