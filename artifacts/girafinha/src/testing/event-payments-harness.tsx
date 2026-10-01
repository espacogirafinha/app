import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { EventPaymentsPanel } from "@/components/event-payments-panel";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { EventPaymentModule } from "@workspace/api-client-react";
import "@/index.css";

const params = new URLSearchParams(window.location.search);
const module = (params.get("module") || "venue_events") as EventPaymentModule;
const eventDate = params.get("eventDate") || "2099-01-01";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EventPaymentsPanel module={module} entityId="11111111-1111-4111-8111-111111111111" eventDate={eventDate} />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);
