import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalEventServiceInput, ExternalEventServiceType } from "@workspace/api-client-react";

export type ExternalServiceDraft = ExternalEventServiceInput & {
  localId: string;
};

export type ExternalServiceOption = {
  type: ExternalEventServiceType;
  label: string;
  price: number;
  sortOrder: number;
};

export const FALLBACK_SERVICE_OPTIONS: ExternalServiceOption[] = [
  { type: "decoracao", label: "Decoração", price: 0, sortOrder: 0 },
  { type: "catering", label: "Catering / Brunch", price: 0, sortOrder: 1 },
  { type: "organizacao_evento", label: "Organização de evento", price: 0, sortOrder: 2 },
  { type: "animacao", label: "Animação", price: 0, sortOrder: 3 },
  { type: "insuflavel", label: "Aluguer de insuflável", price: 0, sortOrder: 4 },
  { type: "baloes", label: "Balões", price: 0, sortOrder: 5 },
  { type: "outro", label: "Outro", price: 0, sortOrder: 6 },
];

export function ExternalEventServicesSelector({
  services,
  options = FALLBACK_SERVICE_OPTIONS,
  onChange,
}: {
  services: ExternalServiceDraft[];
  options?: ExternalServiceOption[];
  onChange: (services: ExternalServiceDraft[]) => void;
}) {
  const addService = (option: ExternalServiceOption) => {
    onChange([
      ...services,
      {
        localId: `${option.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        serviceType: option.type,
        serviceLabel: option.label,
        price: option.price,
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
          {options.map((option) => (
            <Button key={`${option.type}-${option.label}`} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => addService(option)}>
              <Plus className="h-4 w-4" />
              <span>{option.label}</span>
              {option.price > 0 && <span className="text-xs text-muted-foreground">{option.price.toFixed(2)} â‚¬</span>}
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

