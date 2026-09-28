import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { VenueEventModal } from "@/components/venue-event-modal";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { VenueEvent } from "@workspace/api-client-react";
import "@/index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const savedEvent: VenueEvent = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Teste múltiplos extras",
  phone: "000000000",
  email: null,
  nif: null,
  source: null,
  eventDate: "2026-12-15",
  startTime: "10:00",
  endTime: "13:00",
  status: "confirmed",
  paymentStatus: "unpaid",
  packName: "Pack Simples",
  birthdayChildName: null,
  birthdayChildAge: null,
  childrenCount: 10,
  childrenAges: null,
  partyTheme: null,
  decorationNotes: null,
  cateringNotes: null,
  allergies: null,
  imageAuthorization: null,
  termsAccepted: false,
  totalPrice: 465,
  amountPaid: 0,
  remainingBalance: 465,
  expectedReservationDepositAmount: 93,
  reservationDepositPolicy: "auto_20",
  notes: null,
  createdAt: "2026-09-28T10:00:00.000Z",
  updatedAt: "2026-09-28T10:00:00.000Z",
};

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <main className="p-8">
          <div className="flex gap-3">
            <VenueEventModal trigger={<Button>Nova Festa Teste</Button>} />
            <VenueEventModal event={savedEvent} trigger={<Button>Reabrir Festa Teste</Button>} />
          </div>
        </main>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
