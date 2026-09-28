import { useState, type ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListEventPaymentsQueryKey,
  getListVenueEventsQueryKey,
  useCreateEventPayment,
} from "@workspace/api-client-react";
import type { EventPaymentMethod } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { EVENT_PAYMENT_METHOD_OPTIONS, formatEuro } from "@/lib/event-payment-ui";
import {
  buildVenueQuickPaymentData,
  canQuickMarkVenuePaid,
} from "@/lib/venue-quick-payment";

export function VenueQuickMarkPaidDialog({
  eventId,
  customerName,
  remainingBalance,
  trigger,
}: {
  eventId: string;
  customerName: string;
  remainingBalance: number;
  trigger: ReactNode;
}) {
  const createPayment = useCreateEventPayment();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<EventPaymentMethod | "">("");
  const [notes, setNotes] = useState("");

  const params = { module: "venue_events" as const, entityId: eventId };
  const canPay = canQuickMarkVenuePaid(remainingBalance);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListVenueEventsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListEventPaymentsQueryKey(params) }),
    ]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (!canPay) return;
      setPaymentMethod("");
      setNotes("");
    }
    setOpen(nextOpen);
  };

  const confirmPayment = async () => {
    if (!paymentMethod) {
      toast({ title: "Escolha o método de pagamento", variant: "destructive" });
      return;
    }

    try {
      const data = buildVenueQuickPaymentData({
        entityId: eventId,
        remainingBalance,
        paymentMethod,
        paidAt: new Date().toISOString(),
        notes,
      });

      await createPayment.mutateAsync({ data });
      await refresh();
      setOpen(false);
      toast({ title: "Festa marcada como paga" });
    } catch {
      await refresh();
      toast({
        title: "Não foi possível marcar como paga",
        description: "O saldo pode ter sido atualizado. Confirme o valor em falta e tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (!canPay) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Marcar como paga</DialogTitle>
          <DialogDescription>
            {customerName} · liquidar o saldo atual de {formatEuro(remainingBalance)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/25 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Valor</span>
              <span className="font-bold text-foreground">{formatEuro(remainingBalance)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium text-foreground">Agora</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium text-foreground">Pagamento</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as EventPaymentMethod)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher método" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={"quick-payment-note-" + eventId}>Nota <span className="font-normal text-muted-foreground">(opcional)</span></Label>
            <Input
              id={"quick-payment-note-" + eventId}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: restante pago no dia da festa"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createPayment.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmPayment} disabled={createPayment.isPending}>
            {createPayment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
