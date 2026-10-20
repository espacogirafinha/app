import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarClock, CheckCircle2, ClipboardList, ExternalLink, Gift, MessageCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { followUpApi, type FollowUpPage, type Preparation, type Reactivation } from "@/lib/follow-up-api";
import { reactivationMessage, reactivationWhatsAppUrl, type ReturnOffer } from "@/lib/venue-follow-up";
import { DEMO_FOLLOW_UP } from "@/lib/follow-up-demo";

export function useFollowUp(enabled = true) {
  return useQuery({ queryKey: ["follow-up"], enabled, queryFn: () => followUpApi<FollowUpPage>(""),
    staleTime: 60_000, refetchOnWindowFocus: false });
}
function portugueseDate(date: string) {
  return date ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Lisbon" })
    .format(new Date(date.slice(0, 10) + "T12:00:00Z")) : "—";
}
function EventLink({ id, external = false, children, demo = false }: { id: string; external?: boolean; demo?: boolean; children: React.ReactNode }) {
  if (demo) return <Button size="sm" variant="outline" disabled>{children}</Button>;
  return <Link href={`${external ? "/external-events" : "/venue-events"}?open=${encodeURIComponent(id)}`}>
    <Button size="sm" variant="outline">{children}</Button>
  </Link>;
}
function PreparationItem({ item, demo = false }: { item: Preparation; demo?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function toggle(field: "invitations" | "materials", done: boolean) {
    if (demo) return;
    setBusy(field);
    try {
      await followUpApi<void>(`/preparation/${item.id}`, {
        method: "PATCH", body: JSON.stringify({ field, done }),
      });
      await queryClient.invalidateQueries({ queryKey: ["follow-up"] });
    } catch { toast({ title: "Não foi possível guardar a tarefa.", variant: "destructive" }); }
    finally { setBusy(null); }
  }
  return <Card className="min-w-0">
    <CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold break-words">{item.birthdayChildName || item.customerName}</h3>
          <p className="text-sm text-muted-foreground">{item.customerName}</p>
          <p className="text-sm">{portugueseDate(item.eventDate)} · {item.packName}</p>
          {item.theme && <p className="text-sm text-muted-foreground">Tema: {item.theme}</p>}
        </div>
        <Badge variant="outline">{item.daysRemaining} dias</Badge>
      </div>
      <div className="space-y-3 rounded-lg bg-muted/30 p-3">
        <label className="flex min-h-9 items-center gap-3 text-sm">
          <Checkbox checked={item.invitationsDone} disabled={busy !== null || demo}
            onCheckedChange={value => void toggle("invitations", value === true)} />
          Convites tratados
        </label>
        <label className="flex min-h-9 items-center gap-3 text-sm">
          <Checkbox checked={item.materialsDone} disabled={busy !== null}
            onCheckedChange={value => void toggle("materials", value === true)} />
          Material tratado
        </label>
      </div>
      <EventLink id={item.id} demo={demo}><ExternalLink className="mr-2 h-4 w-4" />Abrir festa</EventLink>
    </CardContent>
  </Card>;
}
const OFFER_TYPES = [
  ["none", "Sem oferta"], ["fixed", "Desconto €"], ["percent", "Desconto %"],
  ["gift", "Mimo / benefício"], ["custom", "Texto personalizado"],
] as const;
function ReactivationItem({ item, demo = false }: { item: Reactivation; demo?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(item.offer.type);
  const [value, setValue] = useState(item.offer.value?.toString() ?? "");
  const [description, setDescription] = useState(item.offer.description);
  const [scope, setScope] = useState(item.offer.scope);
  const [expanded, setExpanded] = useState(false);
  const offer = { type: item.offer.type, value: item.offer.value ?? undefined, description: item.offer.description, scope: item.offer.scope } as ReturnOffer;
  const message = item.stage ? reactivationMessage(item.stage, item.source.customerName, item.source.birthdayChildName ?? "", offer) : "";
  const whatsappUrl = item.stage ? reactivationWhatsAppUrl(item.source.phone, message) : null;
  async function change(payload: Record<string, unknown>) {
    if (demo) return;
    setBusy(true);
    try {
      await followUpApi<void>(`/reactivation/${item.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await queryClient.invalidateQueries({ queryKey: ["follow-up"] });
    } catch {
      toast({ title: "Não foi possível guardar. Verifica os dados.", variant: "destructive" });
    } finally { setBusy(false); }
  }
  const label = item.converted ? "Nova reserva" : item.noInterest ? "Sem interesse" :
    item.needsReview ? "Rever correspondência" :
    item.stage === "first" ? "1.º contacto pendente" :
    item.stage === "second" ? "2.º contacto pendente" :
    item.secondContactedAt ? "2.º contacto realizado" : item.firstContactedAt ? "1.º contacto realizado" : "Por contactar";
  return <Card className="min-w-0">
    <CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{item.source.customerName} · {item.source.birthdayChildName || "Aniversário"}</h3>
          <p className="text-sm text-muted-foreground">{item.source.phone}</p>
        </div>
        <Badge variant="outline">{label}</Badge>
      </div>
      <div className="grid gap-1 text-sm">
        <p>Festa anterior: {portugueseDate(item.source.eventDate)} · {item.packName}</p>
        {item.theme && <p>Tema anterior: {item.theme}</p>}
        <p>Próxima festa estimada: {portugueseDate(item.estimate)}</p>
        <p className="text-muted-foreground">1.º contacto: {portugueseDate(item.firstDue)} · 2.º contacto: {portugueseDate(item.secondDue)}</p>
        {item.firstContactedAt && <p>1.º realizado: {new Date(item.firstContactedAt).toLocaleDateString("pt-PT")}</p>}
        {item.secondContactedAt && <p>2.º realizado: {new Date(item.secondContactedAt).toLocaleDateString("pt-PT")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <EventLink id={item.source.id} demo={demo}>Abrir festa anterior</EventLink>
        {item.conversion && <EventLink id={item.conversion.id} demo={demo} external={item.conversion.kind === "external_event"}>
          Ver nova reserva
        </EventLink>}
      </div>
      {item.needsReview && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        Existe um Serviço Externo com o mesmo telefone. Confirma manualmente se corresponde à mesma criança antes de associar.
        <div className="mt-2 flex flex-wrap gap-2">
          {item.reviewCandidates.map(candidate =>
            <Button key={candidate.id} variant="outline" size="sm" disabled={busy || demo}
              onClick={() => void change({ action: "convert", kind: candidate.kind, bookingId: candidate.id })}>
              Confirmar Serviço Externo
            </Button>)}
        </div>
      </div>}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex justify-between gap-2 items-center">
          <p className="text-sm font-medium flex items-center gap-2"><Gift className="h-4 w-4"/> Oferta de regresso</p>
          {item.offer.proposedAt && <Badge variant="outline">Proposta</Badge>}
          {item.offer.usedAt && <Badge variant="outline">Utilizada</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">Aplicar desconto ou mimo à reserva exige confirmação manual. Não altera preços.</p>
        <Button size="sm" variant="ghost" disabled={Boolean(item.offer.proposedAt) || Boolean(item.offer.usedAt)} onClick={() => setExpanded(current => !current)}>
          {expanded ? "Fechar configuração" : "Editar oferta"}
        </Button>
        {expanded && <div className="grid gap-2">
          <select aria-label="Tipo de oferta" value={type} onChange={event => setType(event.target.value as typeof type)}
            className="w-full min-h-10 rounded-md border bg-background px-2 text-sm">
            {OFFER_TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          {(type === "fixed" || type === "percent") && <Input aria-label="Valor da oferta"
            type="number" min="0" max={type === "percent" ? "100" : undefined}
            value={value} onChange={event => setValue(event.target.value)} />}
          {type !== "none" && <Input aria-label="Descrição da oferta" value={description}
            placeholder="Descrição da oferta" onChange={event => setDescription(event.target.value)} />}
          <select aria-label="Válida para" value={scope} onChange={event => setScope(event.target.value as typeof scope)}
            className="w-full min-h-10 rounded-md border bg-background px-2 text-sm">
            <option value="both">Espaço e Serviços Externos</option>
            <option value="venue_only">Apenas Festa no Espaço</option>
            <option value="external_only">Apenas Serviço Externo</option>
          </select>
          <Button disabled={busy} size="sm" onClick={() => void change({ action:"offer", type,
            value: type === "fixed" || type === "percent" ? Number(value) : null,
            description, scope })}>Guardar oferta</Button>
        </div>}
        {!expanded && <p className="text-sm">{item.offer.type === "none" ? "Sem oferta" :
          item.offer.type === "fixed" ? `${item.offer.value} € de desconto` :
          item.offer.type === "percent" ? `${item.offer.value}% de desconto` :
          item.offer.description}</p>}
      </div>
      {item.converted && item.offer.type !== "none" && item.offer.proposedAt &&
        !item.offer.usedAt && item.conversion &&
        (item.offer.scope === "both" ||
          (item.offer.scope === "venue_only" && item.conversion.kind === "venue_event") ||
          (item.offer.scope === "external_only" && item.conversion.kind === "external_event")) &&
        <Button variant="outline" size="sm" disabled={busy} onClick={() => {
          if (window.confirm("Confirmas que a oferta foi realmente aplicada? O valor da reserva não será alterado.")) {
            void change({ action: "redeem_offer" });
          }
        }}>
          <Gift className="mr-2 h-4 w-4"/> Confirmar oferta utilizada
        </Button>}
      {item.stage && whatsappUrl && <div className="flex flex-wrap gap-2">
        {demo ? <Button variant="outline" size="sm" disabled><MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp</Button> : <Button variant="outline" size="sm" asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> Abrir WhatsApp
          </a>
        </Button>}
        <Button size="sm" disabled={busy || demo} onClick={() => void change({ action: "contact", stage: item.stage })}>
          <CheckCircle2 className="mr-2 h-4 w-4"/> Marcar como contactado
        </Button>
      </div>}
      {!item.converted && !item.noInterest && <Button size="sm" variant="ghost" disabled={busy || demo}
        onClick={() => void change({ action: "no_interest" })}>Marcar sem interesse</Button>}
    </CardContent>
  </Card>;
}

function CampaignDefault({ campaign, demo = false }: { campaign: FollowUpPage["campaign"]; demo?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState(campaign.offer_type);
  const [value, setValue] = useState(campaign.offer_value === null ? "" : String(campaign.offer_value));
  const [description, setDescription] = useState(campaign.offer_description);
  const [scope, setScope] = useState(campaign.offer_scope);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (demo) return;
    setBusy(true);
    try {
      await followUpApi<void>("/campaign", {
        method: "PATCH",
        body: JSON.stringify({ type, scope, description,
          value: type === "fixed" || type === "percent" ? Number(value) : null }),
      });
      await queryClient.invalidateQueries({ queryKey: ["follow-up"] });
      setExpanded(false);
      toast({ title: "Oferta padrão guardada" });
    } catch {
      toast({ title: "Não foi possível guardar a oferta padrão.", variant: "destructive" });
    } finally { setBusy(false); }
  }
  return <Card>
    <CardContent className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div><p className="font-semibold">Oferta padrão da campanha</p>
          <p className="text-xs text-muted-foreground">Aplicada apenas a novas oportunidades. Alterável por cliente.</p></div>
        <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Fechar" : "Configurar"}
        </Button>
      </div>
      {expanded && <div className="grid gap-2">
        <select aria-label="Tipo de oferta padrão" value={type}
          onChange={event => setType(event.target.value as typeof type)}
          className="w-full min-h-10 rounded-md border bg-background px-2 text-sm">
          {OFFER_TYPES.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        {(type === "fixed" || type === "percent") && <Input aria-label="Valor da oferta padrão"
          type="number" min="0" max={type === "percent" ? "100" : undefined}
          value={value} onChange={event => setValue(event.target.value)}/>}
        {type !== "none" && <Input aria-label="Descrição da oferta padrão"
          value={description} onChange={event => setDescription(event.target.value)}/>}
        <select aria-label="Âmbito da oferta padrão" value={scope}
          onChange={event => setScope(event.target.value as typeof scope)}
          className="w-full min-h-10 rounded-md border bg-background px-2 text-sm">
          <option value="both">Festa no Espaço e Serviços Externos</option>
          <option value="venue_only">Só Festa no Espaço</option>
          <option value="external_only">Só Serviços Externos</option>
        </select>
        <Button onClick={() => void save()} disabled={busy || demo}>Guardar oferta padrão</Button>
      </div>}
    </CardContent>
  </Card>;
}

export default function FollowUpPage() {
  const demo = new URLSearchParams(window.location.search).get("demo") === "1";
  const { data: liveData, isLoading, isError, refetch } = useFollowUp(!demo);
  const data = demo ? DEMO_FOLLOW_UP : liveData;
  return <div className="space-y-7 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground">Preparação de festas e reativação de clientes</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void refetch()}>
        <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
      </Button>
    </div>
    {demo && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Demonstração com dados fictícios. Os botões de escrita estão desativados e nenhum dado real é consultado ou alterado.</div>}
    {!demo && isLoading && <p>A carregar acompanhamento…</p>}
    {!demo && isError && <Card><CardContent className="space-y-2 p-4">
      <p>Não foi possível carregar o acompanhamento. A base de dados pode ainda não ter a migration aprovada.</p>
      <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
    </CardContent></Card>}
    {data && <>
      <section className="space-y-3">
        <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5"/>
          <h2 className="text-lg font-bold">Preparação de festas ({data.preparationCount})</h2></div>
        {data.preparations.length === 0 ? <p className="text-sm text-muted-foreground">Sem festas com tarefas pendentes nos próximos 30 dias.</p> :
          <div className="grid gap-3 lg:grid-cols-2">{data.preparations.map(item => <PreparationItem key={item.id} item={item} demo={demo}/>)}</div>}
      </section>
      <section className="space-y-3">
        <CampaignDefault campaign={data.campaign} demo={demo} />
        <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5"/>
          <h2 className="text-lg font-bold">Reativação de clientes ({data.contactCount} por contactar)</h2></div>
        <p className="text-sm text-muted-foreground">Primeiro contacto 3 meses antes; segundo contacto 42 dias antes. Mensagens enviadas apenas manualmente.</p>
        {data.reactivations.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há oportunidades de reativação.</p> :
          <div className="grid gap-3 lg:grid-cols-2">{data.reactivations.map(item => <ReactivationItem key={item.id} item={item} demo={demo}/>)}</div>}
      </section>
    </>}
  </div>;
}
