import { useMemo, useState } from "react";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListEventPaymentsQueryKey,
  getListExternalEventsQueryKey,
  getListVenueEventsQueryKey,
  useCreateEventPayment,
  useDeleteEventPayment,
  useListEventPayments,
  useUpdateEventPayment,
} from "@workspace/api-client-react";
import type {
  EventPayment,
  EventPaymentMethod,
  EventPaymentModule,
  EventPaymentType,
} from "@workspace/api-client-react";
import {
  EVENT_PAYMENT_METHOD_OPTIONS,
  collectionDefaultAmount,
  formatEuro,
  paymentMethodLabel,
  paymentSummaryLabel,
  paymentTypeLabel,
  initialPaymentPaidAt,
  isHistoricalEventDate,
  toDateTimeLocalInput,
  toIsoDateTime,
} from "@/lib/event-payment-ui";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { parseMoneyInput } from "@/lib/money";

type EditorState = {
  mode: "create" | "edit";
  paymentId?: string;
  paymentType: EventPaymentType;
  amount: string;
  paymentMethod: EventPaymentMethod | "";
  paidAt: string;
  notes: string;
  isLegacy: boolean;
};

export function EventPaymentsPanel({
  module,
  entityId,
  eventDate,
}: {
  module: EventPaymentModule;
  entityId: string;
  eventDate: string;
}) {
  const params = useMemo(() => ({ module, entityId }), [entityId, module]);
  const paymentsQuery = useListEventPayments(params);
  const createPayment = useCreateEventPayment();
  const updatePayment = useUpdateEventPayment();
  const deletePayment = useDeleteEventPayment();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventPayment | null>(null);

  const result = paymentsQuery.data;
  const summary = result?.summary;
  const payments = result?.items ?? [];
  const isMutating =
    createPayment.isPending || updatePayment.isPending || deletePayment.isPending;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getListEventPaymentsQueryKey(params) });
    if (module === "venue_events") {
      await queryClient.invalidateQueries({ queryKey: getListVenueEventsQueryKey() });
    } else {
      await queryClient.invalidateQueries({ queryKey: getListExternalEventsQueryKey() });
    }
  };

  const openCreate = () => {
    if (!summary || summary.remainingBalance <= 0) return;
    setEditor({
      mode: "create",
      paymentType: "payment",
      amount: collectionDefaultAmount(summary.remainingBalance).toFixed(2),
      paymentMethod: "",
      paidAt: initialPaymentPaidAt(eventDate),
      notes: "",
      isLegacy: false,
    });
  };

  const openEdit = (payment: EventPayment) => {
    setEditor({
      mode: "edit",
      paymentId: payment.id,
      paymentType: payment.paymentType,
      amount: payment.amount.toFixed(2),
      paymentMethod: payment.paymentMethod ?? "",
      paidAt: payment.paidAt ? toDateTimeLocalInput(payment.paidAt) : "",
      notes: payment.notes ?? "",
      isLegacy: payment.paymentType === "legacy_payment",
    });
  };

  const isHistoricalEvent = isHistoricalEventDate(eventDate);

  const saveEditor = async () => {
    if (!editor) return;
    const amount = parseMoneyInput(editor.amount);
    if (amount <= 0) {
      toast({ title: "O valor tem de ser superior a zero", variant: "destructive" });
      return;
    }

    if (!editor.isLegacy && !editor.paymentMethod) {
      toast({ title: "Escolha o método do pagamento", variant: "destructive" });
      return;
    }

    if (!editor.isLegacy && !editor.paidAt) {
      toast({ title: "Indique a data em que o pagamento foi recebido.", variant: "destructive" });
      return;
    }

    try {
      if (editor.mode === "create") {
        if (!editor.paymentMethod || !editor.paidAt) return;
        await createPayment.mutateAsync({
          data: {
            module,
            entityId,
            paymentType: editor.paymentType === "reservation_deposit" ? "reservation_deposit" : "payment",
            amount,
            paymentMethod: editor.paymentMethod,
            paidAt: new Date(editor.paidAt).toISOString(),
            notes: editor.notes.trim() || null,
          },
        });
      } else if (editor.paymentId) {
        await updatePayment.mutateAsync({
          id: editor.paymentId,
          data: {
            paymentType: editor.isLegacy ? "legacy_payment" : editor.paymentType,
            amount,
            paymentMethod: editor.paymentMethod || null,
            paidAt: editor.paidAt ? toIsoDateTime(editor.paidAt) : null,
            notes: editor.notes.trim() || null,
          },
        });
      }

      await invalidate();
      setEditor(null);
      toast({ title: editor.mode === "create" ? "Pagamento registado" : "Pagamento atualizado" });
    } catch {
      toast({
        title: "Não foi possível guardar o pagamento",
        description: "Confirme o valor disponível e os dados do pagamento.",
        variant: "destructive",
      });
    }
  };

  const removePayment = async () => {
    if (!deleteTarget) return;
    try {
      await deletePayment.mutateAsync({ id: deleteTarget.id });
      await invalidate();
      setDeleteTarget(null);
      toast({ title: "Pagamento removido", description: "O total recebido foi recalculado." });
    } catch {
      toast({ title: "Não foi possível remover o pagamento", variant: "destructive" });
    }
  };

  if (paymentsQuery.isLoading) {
    return (
      <section className="mt-4 rounded-xl border border-border bg-background p-3 md:p-4">
        <p className="text-sm text-muted-foreground">A carregar pagamentos…</p>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="mt-4 rounded-xl border border-border bg-background p-3 md:p-4">
        <p className="font-semibold">Pagamentos</p>
        <p className="mt-1 text-sm text-muted-foreground">Não foi possível carregar o histórico financeiro.</p>
      </section>
    );
  }

  return (
    <>
      <section className="mt-4 rounded-xl border border-border bg-background p-3 md:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Pagamentos</p>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {paymentSummaryLabel(summary, payments)}
            </p>
          </div>

          {summary.remainingBalance > 0 ? (
            <div className="flex flex-col gap-2 min-[430px]:flex-row">
              <Button type="button" variant="outline" size="sm" className="w-full rounded-xl min-[430px]:w-auto" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Registar pagamento
              </Button>
              <Button type="button" size="sm" className="w-full rounded-xl min-[430px]:w-auto" onClick={openCreate}>
                <CreditCard className="h-4 w-4" />
                Cobrar {formatEuro(summary.remainingBalance)}
              </Button>
            </div>
          ) : (
            <Badge className="w-fit rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Pago</Badge>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/35 p-2.5">
          <MoneyStat label="Total" value={summary.totalPrice} />
          <MoneyStat label="Recebido" value={summary.received} />
          <MoneyStat label="Por receber" value={summary.remainingBalance} emphasize={summary.remainingBalance > 0} />
        </div>

        {summary.expectedDeposit === null ? (
          <p className="mt-3 text-xs text-muted-foreground">Sinal esperado não registado.</p>
        ) : summary.depositRemaining > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Sinal esperado: {formatEuro(summary.expectedDeposit)} · Ainda em falta: {formatEuro(summary.depositRemaining)}
          </p>
        ) : null}

        <div className="mt-3 divide-y divide-border/70">
          {payments.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Ainda não existem pagamentos registados.</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-medium text-foreground">{paymentTypeLabel(payment)}</p>
                    <p className="font-bold text-foreground">{formatEuro(payment.amount)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {paymentMethodLabel(payment.paymentMethod)}
                    {" · "}
                    {payment.paidAt ? formatPaymentDate(payment.paidAt) : "Data não registada"}
                  </p>
                  {payment.notes ? <p className="mt-1 break-words text-xs text-muted-foreground">{payment.notes}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(payment)} aria-label="Editar pagamento">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(payment)} aria-label="Remover pagamento">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editor?.mode === "edit" ? "Editar pagamento" : "Registar pagamento"}</DialogTitle>
            <DialogDescription>
              {editor?.isLegacy
                ? "Registo histórico: mantenha desconhecidos os dados que não estão documentados."
                : "O valor não pode ultrapassar o saldo atual."}
            </DialogDescription>
          </DialogHeader>

          {editor ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <MoneyInput
                  value={editor.amount}
                  onValueChange={(value) => setEditor((current) => current ? { ...current, amount: value } : current)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editor.paymentType}
                  disabled={editor.isLegacy}
                  onValueChange={(value) => setEditor((current) => current ? {
                    ...current,
                    paymentType: value as EventPaymentType,
                  } : current)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editor.isLegacy ? <SelectItem value="legacy_payment">Pagamento anterior</SelectItem> : null}
                    {!editor.isLegacy ? <SelectItem value="payment">Pagamento</SelectItem> : null}
                    {!editor.isLegacy ? <SelectItem value="reservation_deposit">Sinal de reserva</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Método</Label>
                <Select
                  value={editor.paymentMethod || "unknown"}
                  onValueChange={(value) => setEditor((current) => current ? {
                    ...current,
                    paymentMethod: value === "unknown" ? "" : value as EventPaymentMethod,
                  } : current)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editor.isLegacy ? <SelectItem value="unknown">Não registado</SelectItem> : null}
                    {EVENT_PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="datetime-local"
                  value={editor.paidAt}
                  onChange={(event) => setEditor((current) => current ? { ...current, paidAt: event.target.value } : current)}
                />
                {editor.mode === "create" && isHistoricalEvent ? (
                  <p className="text-xs text-amber-700">
                    Este evento já aconteceu. Confirme a data real em que o pagamento foi recebido.
                  </p>
                ) : editor.isLegacy && !editor.paidAt ? (
                  <p className="text-xs text-muted-foreground">Data não registada.</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Nota</Label>
                <Textarea
                  value={editor.notes}
                  onChange={(event) => setEditor((current) => current ? { ...current, notes: event.target.value } : current)}
                  placeholder="Opcional"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancelar</Button>
            <Button type="button" onClick={saveEditor} disabled={isMutating}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget ? `Remover este pagamento de ${formatEuro(deleteTarget.amount)}?` : "Remover pagamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento ficará removido do cálculo, mas continuará guardado no histórico técnico através de soft delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removePayment} disabled={isMutating}>Remover pagamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MoneyStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className={"mt-1 truncate text-sm font-bold sm:text-base " + (emphasize ? "text-rose-700" : "text-foreground")}>
        {formatEuro(value)}
      </p>
    </div>
  );
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
  }).format(new Date(value));
}
