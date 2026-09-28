import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NullableNumericMoneyInput, NumericMoneyInput } from "@/components/money-input";
import { Textarea } from "@/components/ui/textarea";
import { useListEventExtras, useListSelectedExtras } from "@workspace/api-client-react";
import type { SelectedExtraModule } from "@workspace/api-client-react";
import {
  appendEventExtraDraft,
  calculateExtraLine,
  calculateExtrasTotal,
  removeEventExtraDraft,
  type EventExtraDraft,
} from "@/lib/event-extras";

export {
  calculateExtrasTotal,
  toEventExtraDrafts,
  toSelectedExtraInputs,
  type EventExtraDraft,
} from "@/lib/event-extras";

export function EventExtrasSelector({
  module,
  extras,
  onChange,
  supplierCostsEnabled = false,
}: {
  module: SelectedExtraModule;
  extras: EventExtraDraft[];
  onChange: (extras: EventExtraDraft[]) => void;
  supplierCostsEnabled?: boolean;
}) {
  const catalogQuery = useListEventExtras();
  const options = (catalogQuery.data ?? [])
    .filter((extra) => extra.isActive && (extra.appliesTo === "all" || extra.appliesTo === module))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "pt"));

  const addExtra = (extra: (typeof options)[number]) => {
    if (extras.some((selected) => selected.extraId === extra.id)) return;

    onChange(appendEventExtraDraft(extras, {
      localId: `${extra.id}-${Date.now()}`,
      extraId: extra.id,
      extraName: extra.name,
      category: extra.category,
      unitPrice: extra.basePrice,
      unitCost: supplierCostsEnabled ? extra.baseCost ?? null : null,
      quantity: 1,
      totalPrice: extra.basePrice,
      totalCost: supplierCostsEnabled && extra.baseCost !== null && extra.baseCost !== undefined ? extra.baseCost : null,
      notes: null,
      sortOrder: extras.length + 1,
      custom: false,
    }));
  };

  const addCustomExtra = () => {
    onChange([
      ...extras,
      {
        localId: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        extraId: null,
        extraName: "",
        category: null,
        unitPrice: 0,
        unitCost: null,
        quantity: 1,
        totalPrice: 0,
        totalCost: null,
        notes: null,
        sortOrder: extras.length + 1,
        custom: true,
      },
    ]);
  };

  const updateExtra = (localId: string, patch: Partial<EventExtraDraft>) => {
    onChange(
      extras.map((extra) => {
        if (extra.localId !== localId) return extra;
        const next = { ...extra, ...patch };
        const line = calculateExtraLine(next);
        return { ...next, ...line, margin: undefined } as EventExtraDraft;
      }),
    );
  };

  const removeExtra = (localId: string) => {
    onChange(removeEventExtraDraft(extras, localId));
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-3 md:p-4">
      <div>
        <h3 className="font-semibold text-foreground">Extras</h3>
        <p className="text-xs text-muted-foreground">Adicione extras do catálogo ou um extra específico desta reserva.</p>
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

      <Button type="button" variant="outline" size="sm" className="rounded-full border-dashed" onClick={addCustomExtra}>
        <Plus className="h-4 w-4" />
        Extra personalizado
      </Button>

      {extras.length > 0 && (
        <div className="space-y-3">
          {extras.map((extra) => (
            <div key={extra.localId} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">{extra.custom ? "Extra personalizado" : "Extra do catálogo · valores desta Festa"}</p>
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

              {supplierCostsEnabled ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`extra-name-${extra.localId}`}>Nome</Label>
                    <Input
                      id={`extra-name-${extra.localId}`}
                      value={extra.extraName}
                      onChange={(event) => updateExtra(extra.localId, { extraName: event.target.value })}
                      placeholder="Ex.: Mascote"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`extra-category-${extra.localId}`}>Categoria</Label>
                    <Input
                      id={`extra-category-${extra.localId}`}
                      value={extra.category ?? ""}
                      onChange={(event) => updateExtra(extra.localId, { category: event.target.value || null })}
                      placeholder="Ex.: Animação"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <p className="break-words font-semibold">{extra.extraName}</p>
                  {extra.category && <p className="text-xs text-muted-foreground">{extra.category}</p>}
                </div>
              )}

              <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${supplierCostsEnabled ? "lg:grid-cols-4" : ""}`}>
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
                  <Label>Cliente paga</Label>
                  <NumericMoneyInput
                    value={extra.unitPrice}
                    onValueChange={(value) => updateExtra(extra.localId, { unitPrice: value })}
                    aria-label={`Preço de ${extra.extraName || "extra"}`}
                  />
                </div>
                {supplierCostsEnabled ? (
                  <>
                    <div className="space-y-2">
                      <Label>Eu pago ao fornecedor</Label>
                      <NullableNumericMoneyInput
                        value={extra.unitCost ?? null}
                        onValueChange={(value) => updateExtra(extra.localId, { unitCost: value })}
                        placeholder="Por apurar"
                        aria-label={`Custo de ${extra.extraName || "extra"}`}
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Margem</p>
                      <p className="mt-1 text-lg font-bold">
                        {calculateExtraLine(extra).margin === null ? "Por apurar" : `${calculateExtraLine(extra).margin?.toFixed(2)} €`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cliente: {extra.totalPrice.toFixed(2)} € · Fornecedor: {extra.totalCost === null || extra.totalCost === undefined ? "—" : `${extra.totalCost.toFixed(2)} €`}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="mt-1 text-lg font-bold">{extra.totalPrice.toFixed(2)} €</p>
                  </div>
                )}
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
              {extra.extraId === null ? " · Extra personalizado" : extra.category ? ` · ${extra.category}` : ""}
            </p>
            <p className="mt-1 text-muted-foreground">
              Fornecedor: {extra.totalCost === null || extra.totalCost === undefined ? "por apurar" : `${extra.totalCost.toFixed(2)} €`}
              {" · "}
              Margem: {extra.totalCost === null || extra.totalCost === undefined ? "por apurar" : `${(extra.totalPrice - extra.totalCost).toFixed(2)} €`}
            </p>
            {extra.notes && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{extra.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
