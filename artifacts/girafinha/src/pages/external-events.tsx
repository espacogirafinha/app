import { MapPin } from "lucide-react";
import { BusinessAreaPage } from "./business-area-page";

export default function ExternalEventsPage() {
  return (
    <BusinessAreaPage
      type="external_service"
      title="Serviços Externos"
      subtitle="Gestão de decoração, catering, animação, insufláveis e serviços fora do espaço."
      actionLabel="Novo Serviço"
      emptyText="Ainda não há serviços externos registados."
      icon={MapPin}
      tone="sky"
      summaryCards={[
        { key: "upcoming", label: "Próximos serviços" },
        { key: "pending", label: "Por receber" },
        { key: "paid", label: "Pagos" },
        { key: "nextSevenDays", label: "Próximos 7 dias" },
      ]}
    />
  );
}
