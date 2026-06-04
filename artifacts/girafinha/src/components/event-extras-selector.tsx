import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useListEventExtras, useListSelectedExtras } from "@workspace/api-client-react";
import type { SelectedExtraInput, SelectedExtraModule } from "@workspace/api-client-react";

export type EventExtraDraft = SelectedExtraInput & {
  localId: string;
};

export function EventExtrasSelector({
  module,
  extras,
  onChange,
}: {
  module: SelectedExtraModule;
  extras: EventExtraDraft[];
  onChange: (extras: EventExtraDraft[]) => void;
}) {
  const catalogQuery = useListEventExtras();
  const options = (catalogQuery.data ?? [])
    .filter((extra) => extra.isActive && (extra.appliesTo === "all" || extra.appliesTo === module))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "pt"));

  const addExtra = (extra: (typeof options)[number]) => {
    if (extras.some((selected) => selected.extraId === extra.id)) return;

    onChange([
      ...extras,
      {
        localId: `${extra.id}-${Date.now()}`,
        extraId: extra.id,
        extraName: extra.name,
        category: extra.category,
        unitPrice: extra.basePrice,
        quantity: 1,
        totalPrice: extra.basePrice,
        notes: null,
        sortOrder: extras.length + 1,
      },
    ]);
  };

  const updateExtra = (localId: string, patch: Partial<EventExtraDraft>) => {
    onChange(
      extras.map((extra) => {
        if (extra.localId !== localId) return extra;
        const next = { ...extra, ...patch };
        return { ...next, totalPrice: next.quantity * next.unitPrice };
      }),
    );
  };

  const removeExtra = (localId: string) => {
    onChange(extras.filter((extra) => extra.localId !== localId).map((extra, index) => ({ ...extra, sortOrder: index + 1 })));
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-3 md:p-4">
      <div>
        <h3 className="font-semibold text-foreground">Extras</h3>
        <p className="text-xs text-muted-foreground">Adicione extras ativos e ajuste quantidade, preço ou notas para este evento.</p>
      </div>

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {options.map((extra) => (
            <Button
              key={extra.id}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={extras.some((selected) => selected.extraId === extra.id)}
              onClick={() => addExtra(extra)}
            >
              <Plus className="h-4 w-4" />
              {extra.name}
              <span className="text-xs text-muted-foreground">{extra.basePrice.toFixed(2)} €</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Sem extras ativos configurados.
        </div>
      )}

      {extras.length > 0 && (
        <div className="space-y-3">
          {extras.map((extra) => (
            <div key={extra.localId} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{extra.extraName}</p>
                  {extra.category && <p className="text-xs text-muted-foreground">{extra.category}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExtra(extra.localId)}
                  aria-label={`Remover ${extra.extraName}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={extra.quantity}
                    onChange={(event) => updateExtra(extra.localId, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço unitário</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extra.unitPrice}
                    onChange={(event) => updateExtra(extra.localId, { unitPrice: Math.max(0, Number(event.target.value) || 0) })}
                  />
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="mt-1 text-lg font-bold">{extra.totalPrice.toFixed(2)} €</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={extra.notes ?? ""}
                  onChange={(event) => updateExtra(extra.localId, { notes: event.target.value || null })}
                  placeholder="Detalhes específicos deste extra..."
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Subtotal dos extras</p>
        <p className="text-xl font-bold">{calculateExtrasTotal(extras).toFixed(2)} €</p>
      </div>
    </section>
  );
}

export function EventExtrasDetails({ module, entityId }: { module: SelectedExtraModule; entityId: string }) {
  const { data: extras, isLoading } = useListSelectedExtras({ module, entityId });

  if (isLoading || !extras?.length) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">Extras</p>
        <span className="font-bold">{calculateExtrasTotal(extras).toFixed(2)} €</span>
      </div>
      <div className="space-y-2">
        {extras.map((extra) => (
          <div key={extra.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{extra.extraName}</span>
              <span className="font-bold">{extra.totalPrice.toFixed(2)} €</span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {extra.quantity} × {extra.unitPrice.toFixed(2)} €
              {extra.category ? ` · ${extra.category}` : ""}
            </p>
            {extra.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{extra.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function toEventExtraDrafts(extras?: SelectedExtraInput[]): EventExtraDraft[] {
  return (extras ?? []).map((extra, index) => ({
    ...extra,
    localId: extra.extraId ? `${extra.extraId}-${index}` : `snapshot-${index}`,
  }));
}

export function toSelectedExtraInputs(extras: EventExtraDraft[]): SelectedExtraInput[] {
  return extras.map(({ localId: _localId, ...extra }, index) => ({
    ...extra,
    quantity: Math.max(1, Number(extra.quantity) || 1),
    unitPrice: Math.max(0, Number(extra.unitPrice) || 0),
    totalPrice: Math.max(0, (Number(extra.quantity) || 1) * (Number(extra.unitPrice) || 0)),
    sortOrder: index + 1,
  }));
}

export function calculateExtrasTotal(extras: SelectedExtraInput[]) {
  return extras.reduce((sum, extra) => sum + Number(extra.totalPrice ?? 0), 0);
}
