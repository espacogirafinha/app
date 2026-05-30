import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalEventServiceInput, ExternalEventServiceType } from "@workspace/api-client-react";

export type ExternalServiceDraft = ExternalEventServiceInput & {
  localId: string;
};

const SERVICE_OPTIONS: Array<{ type: ExternalEventServiceType; label: string }> = [
  { type: "decoracao", label: "Decoração" },
  { type: "catering", label: "Catering / Brunch" },
  { type: "organizacao_evento", label: "Organização de evento" },
  { type: "animacao", label: "Animação" },
  { type: "insuflavel", label: "Aluguer de insuflável" },
  { type: "baloes", label: "Balões" },
  { type: "outro", label: "Outro" },
];

export function ExternalEventServicesSelector({
  services,
  onChange,
}: {
  services: ExternalServiceDraft[];
  onChange: (services: ExternalServiceDraft[]) => void;
}) {
  const addService = (type: ExternalEventServiceType, label: string) => {
    onChange([
      ...services,
      {
        localId: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        serviceType: type,
        serviceLabel: label,
        price: 0,
        status: "planned",
        notes: null,
        sortOrder: services.length + 1,
      },
    ]);
  };

  const updateService = (localId: string, patch: Partial<ExternalServiceDraft>) => {
    onChange(services.map((service) => (service.localId === localId ? { ...service, ...patch } : service)));
  };

  const removeService = (localId: string) => {
    onChange(services.filter((service) => service.localId !== localId).map((service, index) => ({ ...service, sortOrder: index + 1 })));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Serviços incluídos</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map((option) => (
            <Button key={option.type} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => addService(option.type, option.label)}>
              <Plus className="h-4 w-4" />
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Selecione pelo menos um serviço para guardar o evento externo.
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.localId} className="rounded-xl border border-border bg-background p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_130px_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Input
                    value={service.serviceLabel}
                    onChange={(event) => updateService(service.localId, { serviceLabel: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={service.price ?? 0}
                    onChange={(event) => updateService(service.localId, { price: Number(event.target.value) || 0 })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeService(service.localId)}
                  aria-label="Remover serviço"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                <Label>Notas específicas</Label>
                <Textarea
                  value={service.notes ?? ""}
                  onChange={(event) => updateService(service.localId, { notes: event.target.value || null })}
                  placeholder="Detalhes específicos deste serviço..."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

