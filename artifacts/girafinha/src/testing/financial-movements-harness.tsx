import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";
import FinancialMovementsPage from "@/pages/financial-movements";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter>
        <FinancialMovementsPage />
      </WouterRouter>
    </TooltipProvider>
  </QueryClientProvider>,
);
