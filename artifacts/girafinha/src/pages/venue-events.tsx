import { PartyPopper } from "lucide-react";
import { BusinessAreaPage } from "./business-area-page";

export default function VenueEventsPage() {
  return (
    <BusinessAreaPage
      type="venue_party"
      title="Festas no Espaço"
      subtitle="Gestão de aniversários, packs, decoração, catering e eventos realizados no espaço."
      actionLabel="Nova Festa"
      emptyText="Ainda não há festas no espaço registadas."
      icon={PartyPopper}
      tone="pink"
      summaryCards={[
        { key: "upcoming", label: "Próximas festas" },
        { key: "pending", label: "Por receber" },
        { key: "paid", label: "Pagas" },
        { key: "nextSevenDays", label: "Próximos 7 dias" },
      ]}
    />
  );
}
