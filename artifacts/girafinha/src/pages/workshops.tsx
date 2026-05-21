import { GraduationCap } from "lucide-react";
import { BusinessAreaPage } from "./business-area-page";

export default function WorkshopsPage() {
  return (
    <BusinessAreaPage
      type="workshop"
      title="Workshops/Formações"
      subtitle="Gestão de workshops, formações, inscrições e participantes."
      actionLabel="Novo Workshop"
      emptyText="Ainda não há workshops ou formações registados."
      icon={GraduationCap}
      tone="violet"
      summaryCards={[
        { key: "upcoming", label: "Workshops agendados" },
        { key: "participants", label: "Participantes/inscrições" },
        { key: "pending", label: "Por receber" },
        { key: "occupancy", label: "Vagas/ocupação" },
      ]}
    />
  );
}
