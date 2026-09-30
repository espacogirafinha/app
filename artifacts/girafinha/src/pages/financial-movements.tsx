import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Search, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filterFinancialMovements,
  filterUndatedFinancialMovements,
  summarizeFinancialMovements,
  type FinancialMovementFilters,
  type MovementMethodFilter,
  type MovementOriginFilter,
  type MovementPeriodMode,
} from "@/lib/financial-movements";
import {
  useListFinancialMovements,
  type FinancialMovement,
} from "@workspace/api-client-react";

const ALL = "all";
const PORTUGAL_TIME_ZONE = "Europe/Lisbon";

const PAYMENT_TYPE_LABELS: Record<FinancialMovement["paymentType"], string> = {
  reservation_deposit: "Sinal",
  payment: "Pagamento",
  legacy_payment: "Pagamento anterior / histórico",
};

const PAYMENT_METHOD_LABELS: Record<NonNullable<FinancialMovement["paymentMethod"]>, string> = {
  cash: "Dinheiro",
  bank_transfer: "Transferência",
  mbway: "MB Way",
};

const ORIGIN_LABELS: Record<FinancialMovement["module"], string> = {
  venue_events: "Festa no Espaço",
  external_events: "Serviço Externo",
};

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: PORTUGAL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value)).replace(",", " ·");
}

function formatEventDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function eventHref(movement: FinancialMovement) {
  return movement.module === "venue_events"
    ? `/venue-events?open=${movement.entityId}`
    : `/external-events?open=${movement.entityId}`;
}

function methodLabel(method: FinancialMovement["paymentMethod"]) {
  return method ? PAYMENT_METHOD_LABELS[method] : "Não registado";
}

function movementSubtitle(movement: FinancialMovement) {
  if (movement.module === "venue_events" && movement.birthdayChildName) {
    return `${movement.birthdayChildName} · Festa ${formatEventDate(movement.eventDate)}`;
  }
  return `${ORIGIN_LABELS[movement.module]} · ${formatEventDate(movement.eventDate)}`;
}

export default function FinancialMovementsPage() {
  const query = useListFinancialMovements();
  const [search, setSearch] = useState("");
  const [periodMode, setPeriodMode] = useState<MovementPeriodMode>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [method, setMethod] = useState<MovementMethodFilter>(ALL);
  const [origin, setOrigin] = useState<MovementOriginFilter>(ALL);

  const filters: FinancialMovementFilters = {
    search,
    periodMode,
    customStart,
    customEnd,
    method,
    origin,
  };

  const movements = useMemo(
    () => filterFinancialMovements(query.data?.movements ?? [], filters),
    [query.data?.movements, search, periodMode, customStart, customEnd, method, origin],
  );
  const undatedPayments = useMemo(
    () => filterUndatedFinancialMovements(query.data?.undatedPayments ?? [], filters),
    [query.data?.undatedPayments, search, method, origin],
  );
  const summary = useMemo(() => summarizeFinancialMovements(movements), [movements]);

  return (
    <div className="animate-in space-y-4 fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <WalletCards className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
            Movimentos financeiros
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          Extrato interno de pagamentos registados, ordenado pela data em que o pagamento entrou.
        </p>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2 md:p-4 xl:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label>Pesquisa</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar por cliente ou criança…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Período pela data do pagamento</Label>
            <Select value={periodMode} onValueChange={(value) => setPeriodMode(value as MovementPeriodMode)}>
              <SelectTrigger aria-label="Período pela data do pagamento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">Este mês</SelectItem>
                <SelectItem value="previous_month">Mês anterior</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
                <SelectItem value="custom">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Método</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as MovementMethodFilter)}>
              <SelectTrigger aria-label="Método"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="bank_transfer">Transferência</SelectItem>
                <SelectItem value="mbway">MB Way</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={origin} onValueChange={(value) => setOrigin(value as MovementOriginFilter)}>
              <SelectTrigger aria-label="Origem"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="venue_events">Festas no Espaço</SelectItem>
                <SelectItem value="external_events">Serviços Externos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodMode === "custom" ? (
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-4">
              <div className="space-y-2">
                <Label>De</Label>
                <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Até</Label>
                <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-2.5 md:gap-4">
        <SummaryCard label="Recebido no período" value={euro(summary.received)} />
        <SummaryCard label="Movimentos" value={String(summary.count)} />
      </section>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardHeader className="p-4 pb-2 md:p-5 md:pb-3">
          <CardTitle className="text-base">Movimentos com data de pagamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">A carregar movimentos…</p>
          ) : query.isError ? (
            <p className="p-6 text-sm text-destructive">Não foi possível carregar os movimentos financeiros.</p>
          ) : movements.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum movimento encontrado para estes filtros.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data pagamento</TableHead>
                      <TableHead>Cliente / Festa</TableHead>
                      <TableHead>Data evento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {movement.paidAt ? formatPaymentDate(movement.paidAt) : "—"}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold">{movement.customerName}</p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{movement.birthdayChildName || ORIGIN_LABELS[movement.module]}</span>
                            <Link href={eventHref(movement)} className="inline-flex items-center gap-0.5 text-primary hover:underline">
                              Abrir <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
                          {movement.notes ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{movement.notes}</p> : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatEventDate(movement.eventDate)}</TableCell>
                        <TableCell>{PAYMENT_TYPE_LABELS[movement.paymentType]}</TableCell>
                        <TableCell>{methodLabel(movement.paymentMethod)}</TableCell>
                        <TableCell className="text-right text-base font-bold">{euro(movement.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border/60 md:hidden">
                {movements.map((movement) => (
                  <Link
                    key={movement.id}
                    href={eventHref(movement)}
                    className="block space-y-1.5 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {movement.paidAt ? formatPaymentDate(movement.paidAt) : "—"}
                        </p>
                        <p className="mt-1 break-words font-bold">{movement.customerName}</p>
                      </div>
                      <p className="shrink-0 text-lg font-bold text-primary">{euro(movement.amount)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{movementSubtitle(movement)}</p>
                    <p className="text-sm">
                      {PAYMENT_TYPE_LABELS[movement.paymentType]} · {methodLabel(movement.paymentMethod)}
                    </p>
                    {movement.notes ? <p className="text-xs text-muted-foreground">{movement.notes}</p> : null}
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(query.data?.undatedPayments.length ?? 0) > 0 ? (
        <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
          <CardHeader className="p-4 pb-2 md:p-5 md:pb-3">
            <CardTitle className="text-base">Pagamentos antigos sem data</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estes pagamentos já estão registados como recebidos, mas o sistema antigo não guardava a data em que foram pagos. Por isso, não é possível colocá-los na ordem cronológica dos movimentos.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-2 md:p-5 md:pt-2">
            {undatedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento antigo corresponde aos filtros atuais.</p>
            ) : (
              undatedPayments.map((movement) => (
                <div key={movement.id} className="rounded-xl border border-amber-200/70 bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={eventHref(movement)} className="font-semibold hover:text-primary hover:underline">
                        {movement.customerName}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{movementSubtitle(movement)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Data não registada · {methodLabel(movement.paymentMethod)}
                      </p>
                      {movement.notes ? <p className="mt-1 text-xs text-muted-foreground">{movement.notes}</p> : null}
                    </div>
                    <p className="shrink-0 text-lg font-bold">{euro(movement.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-3 md:p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold md:text-2xl">{value}</p>
      </CardContent>
    </Card>
  );
}
