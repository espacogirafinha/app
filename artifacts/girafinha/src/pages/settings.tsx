import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, PackagePlus, Plus, Settings, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SettingsChecklists } from "@/components/settings-checklists";
import { SettingsMessageTemplates } from "@/components/settings-message-templates";
import { useToast } from "@/hooks/use-toast";
import {
  getListEventExtrasQueryKey,
  getListExternalServicesQueryKey,
  getListVenuePacksQueryKey,
  useCreateEventExtra,
  useCreateExternalService,
  useCreateVenuePack,
  useListEventExtras,
  useListExternalServices,
  useListVenuePacks,
} from "@workspace/api-client-react";
import type {
  CreateEventExtraBody,
  CreateExternalServiceBody,
  CreateVenuePackBody,
  EventExtra,
  ExternalServiceCatalog,
  VenuePack,
} from "@workspace/api-client-react";

type CatalogKind = "venue-packs" | "external-services" | "event-extras";
type CatalogItem = VenuePack | ExternalServiceCatalog | EventExtra;
type CatalogCreatePayload = CreateVenuePackBody | CreateExternalServiceBody | CreateEventExtraBody;
type CatalogSavePayload =
  | (CreateVenuePackBody & { id?: string })
  | (CreateExternalServiceBody & { id?: string })
  | (CreateEventExtraBody & { id?: string });

type CatalogFormState = {
  code: string;
  name: string;
  description: string;
  category: string;
  basePrice: string;
  defaultStartTime: string;
  defaultEndTime: string;
  appliesTo: EventExtra["appliesTo"];
  isActive: boolean;
  sortOrder: string;
  internalNotes: string;
  operationalNotes: string;
};

const emptyForm: CatalogFormState = {
  code: "",
  name: "",
  description: "",
  category: "",
  basePrice: "0",
  defaultStartTime: "",
  defaultEndTime: "",
  appliesTo: "all",
  isActive: true,
  sortOrder: "0",
  internalNotes: "",
  operationalNotes: "",
};

const suggestedVenuePacks: CreateVenuePackBody[] = [
  { name: "Aluguer do Espaço", basePrice: 160, sortOrder: 10, defaultStartTime: "10:00", defaultEndTime: "13:00", isActive: true },
  { name: "Pack Simples", basePrice: 220, sortOrder: 20, defaultStartTime: "16:00", defaultEndTime: "19:00", isActive: true },
  { name: "Pack Simples com Decoração", basePrice: 350, sortOrder: 30, defaultStartTime: "16:00", defaultEndTime: "19:00", isActive: true },
  { name: "Pack VIP", basePrice: 0, sortOrder: 40, isActive: true },
  { name: "Pack Deluxe", basePrice: 500, sortOrder: 50, isActive: true },
  { name: "Pack Personalizado", basePrice: 0, sortOrder: 60, isActive: true },
];

const suggestedExternalServices: CreateExternalServiceBody[] = [
  { code: "decoracao", name: "Decoração", basePrice: 0, sortOrder: 10, isActive: true },
  { code: "catering", name: "Catering / Brunch", basePrice: 0, sortOrder: 20, isActive: true },
  { code: "insuflavel", name: "Aluguer de Insuflável", basePrice: 0, sortOrder: 30, isActive: true },
  { code: "animacao", name: "Animação", basePrice: 0, sortOrder: 40, isActive: true },
  { code: "baloes", name: "Balões", basePrice: 0, sortOrder: 50, isActive: true },
  { code: "organizacao_evento", name: "Organização de evento", basePrice: 0, sortOrder: 60, isActive: true },
  { code: "outro", name: "Outro", basePrice: 0, sortOrder: 70, isActive: true },
];

export default function SettingsPage() {
  const venuePacksQuery = useListVenuePacks();
  const externalServicesQuery = useListExternalServices();
  const eventExtrasQuery = useListEventExtras();
  const createVenuePack = useCreateVenuePack();
  const createExternalService = useCreateExternalService();
  const createEventExtra = useCreateEventExtra();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addSuggestedVenuePacks = async () => {
    const existingNames = new Set((venuePacksQuery.data ?? []).map((pack) => pack.name.toLowerCase()));
    const missing = suggestedVenuePacks.filter((pack) => !existingNames.has(pack.name.toLowerCase()));

    if (missing.length === 0) {
      toast({ title: "Packs sugeridos já existem" });
      return;
    }

    try {
      for (const pack of missing) {
        await createVenuePack.mutateAsync({ data: pack });
      }
      await queryClient.invalidateQueries({ queryKey: getListVenuePacksQueryKey() });
      toast({ title: "Packs sugeridos adicionados", description: `${missing.length} pack(s) ficaram disponíveis.` });
    } catch {
      toast({ title: "Não foi possível adicionar os packs sugeridos", variant: "destructive" });
    }
  };

  const addSuggestedExternalServices = async () => {
    const existingCodes = new Set((externalServicesQuery.data ?? []).map((service) => service.code));
    const missing = suggestedExternalServices.filter((service) => !existingCodes.has(service.code));

    if (missing.length === 0) {
      toast({ title: "Serviços sugeridos já existem" });
      return;
    }

    try {
      for (const service of missing) {
        await createExternalService.mutateAsync({ data: service });
      }
      await queryClient.invalidateQueries({ queryKey: getListExternalServicesQueryKey() });
      toast({ title: "Serviços sugeridos adicionados", description: `${missing.length} serviço(s) ficaram disponíveis.` });
    } catch {
      toast({ title: "Não foi possível adicionar os serviços sugeridos", variant: "destructive" });
    }
  };

  return (
    <div className="animate-in space-y-4 overflow-x-hidden fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <div className="space-y-2 md:space-y-3">
        <div className="flex items-center gap-2">
          <span className="hidden rounded-xl bg-muted p-2 text-muted-foreground sm:inline-flex">
            <Settings className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Definições</h1>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Gerir catálogos operacionais usados pela app.
        </p>
        <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Os catálogos definem opções para novas reservas. Eventos antigos mantêm os valores guardados no momento da criação.
        </div>
      </div>

      <Tabs defaultValue="venue-packs" className="space-y-4">
        <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-5 md:overflow-visible">
          <TabsTrigger value="venue-packs" className="min-h-10 flex-none whitespace-nowrap px-3 text-xs md:px-2 md:text-sm">Packs de Festas</TabsTrigger>
          <TabsTrigger value="external-services" className="min-h-10 flex-none whitespace-nowrap px-3 text-xs md:px-2 md:text-sm">Serviços Externos</TabsTrigger>
          <TabsTrigger value="event-extras" className="min-h-10 flex-none whitespace-nowrap px-3 text-xs md:px-2 md:text-sm">Extras</TabsTrigger>
          <TabsTrigger value="message-templates" className="min-h-10 flex-none whitespace-nowrap px-3 text-xs md:px-2 md:text-sm">Templates WhatsApp</TabsTrigger>
          <TabsTrigger value="checklists" className="min-h-10 flex-none whitespace-nowrap px-3 text-xs md:px-2 md:text-sm">Checklists</TabsTrigger>
        </TabsList>

        <TabsContent value="venue-packs">
          <CatalogSection
            kind="venue-packs"
            title="Packs de Festas"
            description="Packs usados nas festas e eventos realizados no Espaço Girafinha."
            createLabel="Criar pack"
            suggestedLabel="Adicionar packs sugeridos"
            items={venuePacksQuery.data ?? []}
            isLoading={venuePacksQuery.isLoading}
            isSaving={createVenuePack.isPending}
            isAddingSuggested={createVenuePack.isPending}
            onSave={(data) => createVenuePack.mutateAsync({ data: data as CreateVenuePackBody })}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: getListVenuePacksQueryKey() })}
            onAddSuggested={addSuggestedVenuePacks}
          />
        </TabsContent>

        <TabsContent value="external-services">
          <CatalogSection
            kind="external-services"
            title="Serviços Externos"
            description="Catálogo base para decoração, catering, animação, insufláveis e serviços fora do espaço."
            createLabel="Criar serviço"
            suggestedLabel="Adicionar serviços sugeridos"
            items={externalServicesQuery.data ?? []}
            isLoading={externalServicesQuery.isLoading}
            isSaving={createExternalService.isPending}
            isAddingSuggested={createExternalService.isPending}
            onSave={(data) => createExternalService.mutateAsync({ data: data as CreateExternalServiceBody })}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: getListExternalServicesQueryKey() })}
            onAddSuggested={addSuggestedExternalServices}
          />
        </TabsContent>

        <TabsContent value="event-extras">
          <CatalogSection
            kind="event-extras"
            title="Extras"
            description="Opções adicionais reutilizáveis por festas, serviços externos e workshops."
            createLabel="Criar extra"
            items={eventExtrasQuery.data ?? []}
            isLoading={eventExtrasQuery.isLoading}
            isSaving={createEventExtra.isPending}
            onSave={(data) => createEventExtra.mutateAsync({ data: data as CreateEventExtraBody })}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: getListEventExtrasQueryKey() })}
          />
        </TabsContent>

        <TabsContent value="message-templates">
          <SettingsMessageTemplates />
        </TabsContent>

        <TabsContent value="checklists">
          <SettingsChecklists />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogSection({
  kind,
  title,
  description,
  createLabel,
  suggestedLabel,
  items,
  isLoading,
  isSaving,
  isAddingSuggested,
  onSave,
  onRefresh,
  onAddSuggested,
}: {
  kind: CatalogKind;
  title: string;
  description: string;
  createLabel: string;
  suggestedLabel?: string;
  items: CatalogItem[];
  isLoading: boolean;
  isSaving: boolean;
  isAddingSuggested?: boolean;
  onSave: (data: CatalogSavePayload) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  onAddSuggested?: () => Promise<void>;
}) {
  const [modal, setModal] = useState<{ open: boolean; item?: CatalogItem }>({ open: false });
  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);
  const inactiveCount = items.length - activeCount;

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-3 p-3 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
              <Button className="min-h-9 px-3" onClick={() => setModal({ open: true })}>
                <Plus className="h-4 w-4" />
                <span className="md:hidden">Criar</span>
                <span className="hidden md:inline">{createLabel}</span>
              </Button>
              {onAddSuggested ? (
                <Button variant="ghost" size="sm" className="min-h-9 px-2 text-muted-foreground" onClick={onAddSuggested} disabled={isAddingSuggested}>
                  <Sparkles className="h-4 w-4" />
                  <span className="md:hidden">Adicionar sugeridos</span>
                  <span className="hidden md:inline">{suggestedLabel}</span>
                </Button>
              ) : null}

            </div>
          </div>
          <CatalogSummary total={items.length} active={activeCount} inactive={inactiveCount} />
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-44 animate-pulse border-border/70 bg-muted/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <PackagePlus className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Ainda não existem itens neste catálogo.</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro item para preparar a área de Definições.</p>
            </div>
            <Button className="min-h-10" onClick={() => setModal({ open: true })}>{createLabel}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((item) => (
              <CatalogCard
                key={item.id}
                kind={kind}
                item={item}
                isSaving={isSaving}
                onEdit={() => setModal({ open: true, item })}
                onToggle={async () => {
                  await onSave(toPayload(kind, toFormState(kind, item), item.id, { isActive: !item.isActive }));
                  await onRefresh();
                }}
              />
            ))}
        </div>
      )}

      <CatalogModal
        kind={kind}
        item={modal.item}
        open={modal.open}
        isSaving={isSaving}
        onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
        onSubmit={async (data) => {
          await onSave(data);
          await onRefresh();
          setModal({ open: false });
        }}
      />
    </div>
  );
}

function CatalogCard({
  kind,
  item,
  isSaving,
  onEdit,
  onToggle,
}: {
  kind: CatalogKind;
  item: CatalogItem;
  isSaving: boolean;
  onEdit: () => void;
  onToggle: () => Promise<void>;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-3 p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold leading-tight">{item.name}</h3>
              <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Ativo" : "Inativo"}</Badge>
            </div>

            {kind === "event-extras" && "appliesTo" in item ? (
              <p className="mt-1 text-xs text-muted-foreground">Aplica-se a: {appliesToLabel(item.appliesTo)}</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={onEdit}>
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>

        {"description" in item && item.description ? <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p> : null}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info label="Preço base" value={formatCurrency(item.basePrice)} strong />
          <Info label="Ordem" value={String(item.sortOrder)} className="hidden md:block" />
          {kind === "venue-packs" && "defaultStartTime" in item && (item.defaultStartTime || item.defaultEndTime) ? (
            <Info
              label="Horário"
              value={[item.defaultStartTime, item.defaultEndTime].filter(Boolean).join("–")}
              className="col-span-2 md:col-span-1"
            />
          ) : null}
          {kind === "event-extras" && "category" in item && item.category ? <Info label="Categoria" value={item.category} /> : null}
        </div>

        {notesForItem(item) ? (
          <div className="hidden rounded-md bg-muted/50 p-3 text-sm text-muted-foreground md:block">{notesForItem(item)}</div>
        ) : null}

        <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-1.5">
          <span className="text-sm font-medium">{item.isActive ? "Disponível" : "Oculto"}</span>
          <Switch checked={item.isActive} disabled={isSaving} onCheckedChange={() => void onToggle()} />
        </div>
      </CardContent>
    </Card>
  );
}

function CatalogModal({
  kind,
  item,
  open,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  kind: CatalogKind;
  item?: CatalogItem;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CatalogSavePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<CatalogFormState>(emptyForm);
  const { toast } = useToast();
  const isEditing = Boolean(item);

  useEffect(() => {
    if (open) setForm(toFormState(kind, item));
  }, [item, kind, open]);

  const patch = (value: Partial<CatalogFormState>) => setForm((current) => ({ ...current, ...value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const basePrice = toNumber(form.basePrice);
    const sortOrder = Number.parseInt(form.sortOrder || "0", 10);

    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }

    if (kind === "external-services" && !form.code.trim()) {
      toast({ title: "Código interno obrigatório", variant: "destructive" });
      return;
    }

    if (basePrice < 0 || Number.isNaN(basePrice)) {
      toast({ title: "Preço base inválido", description: "O preço base deve ser igual ou superior a 0.", variant: "destructive" });
      return;
    }

    if (Number.isNaN(sortOrder)) {
      toast({ title: "Ordem inválida", description: "A ordem deve ser numérica.", variant: "destructive" });
      return;
    }

    try {
      await onSubmit(toPayload(kind, form, item?.id));
      toast({ title: isEditing ? "Catálogo atualizado" : "Catálogo criado" });
    } catch {
      toast({ title: "Não foi possível guardar", description: "Verifique os dados e tente novamente.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar item" : modalTitle(kind)}</DialogTitle>
          <DialogDescription>Gerir valores do catálogo sem alterar eventos já criados.</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "external-services" ? (
              <Field label="Código interno">
                <Input value={form.code} onChange={(event) => patch({ code: event.target.value })} placeholder="decoracao" />
              </Field>
            ) : null}

            <Field label="Nome">
              <Input value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Nome visível" />
            </Field>

            {kind === "event-extras" ? (
              <Field label="Categoria">
                <Input value={form.category} onChange={(event) => patch({ category: event.target.value })} placeholder="Lanche, decoração..." />
              </Field>
            ) : null}

            <Field label="Preço base">
              <Input type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => patch({ basePrice: event.target.value })} />
            </Field>

            <Field label="Ordem">
              <Input type="number" step="1" value={form.sortOrder} onChange={(event) => patch({ sortOrder: event.target.value })} />
            </Field>

            {kind === "venue-packs" ? (
              <>
                <Field label="Hora início padrão">
                  <Input type="time" value={form.defaultStartTime} onChange={(event) => patch({ defaultStartTime: event.target.value })} />
                </Field>
                <Field label="Hora fim padrão">
                  <Input type="time" value={form.defaultEndTime} onChange={(event) => patch({ defaultEndTime: event.target.value })} />
                </Field>
              </>
            ) : null}

            {kind === "event-extras" ? (
              <Field label="Aplica-se a">
                <Select value={form.appliesTo} onValueChange={(value) => patch({ appliesTo: value as EventExtra["appliesTo"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="venue_events">Festas no Espaço</SelectItem>
                    <SelectItem value="external_events">Serviços Externos</SelectItem>
                    <SelectItem value="workshops">Workshops/Formações</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>

          {kind !== "event-extras" ? (
            <Field label="Descrição">
              <Textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} rows={3} />
            </Field>
          ) : null}

          <Field label={kind === "external-services" ? "Notas operacionais" : "Notas internas"}>
            <Textarea
              value={kind === "external-services" ? form.operationalNotes : form.internalNotes}
              onChange={(event) =>
                kind === "external-services"
                  ? patch({ operationalNotes: event.target.value })
                  : patch({ internalNotes: event.target.value })
              }
              rows={3}
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">Itens inativos ficam guardados, mas ocultos nas opções futuras.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(checked) => patch({ isActive: checked })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "A guardar..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CatalogSummary({ total, active, inactive }: { total: number; active: number; inactive: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm">
      <span><strong>{total}</strong> total</span>
      <span aria-hidden="true" className="text-border">·</span>
      <span className="text-emerald-700"><strong>{active}</strong> ativos</span>
      <span aria-hidden="true" className="text-border">·</span>
      <span className="text-muted-foreground"><strong>{inactive}</strong> inativos</span>
    </div>
  );
}

function Info({ label, value, strong, className = "" }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className={"rounded-md bg-muted/40 px-3 py-2 " + className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={strong ? "font-semibold" : "font-medium"}>{value}</p>
    </div>
  );
}

function toFormState(kind: CatalogKind, item?: CatalogItem): CatalogFormState {
  if (!item) return emptyForm;

  return {
    code: "code" in item ? item.code : "",
    name: item.name,
    description: "description" in item && item.description ? item.description : "",
    category: "category" in item && item.category ? item.category : "",
    basePrice: String(item.basePrice),
    defaultStartTime: "defaultStartTime" in item && item.defaultStartTime ? item.defaultStartTime : "",
    defaultEndTime: "defaultEndTime" in item && item.defaultEndTime ? item.defaultEndTime : "",
    appliesTo: kind === "event-extras" && "appliesTo" in item ? item.appliesTo : "all",
    isActive: item.isActive,
    sortOrder: String(item.sortOrder),
    internalNotes: "internalNotes" in item && item.internalNotes ? item.internalNotes : "",
    operationalNotes: "operationalNotes" in item && item.operationalNotes ? item.operationalNotes : "",
  };
}

function toPayload(
  kind: CatalogKind,
  form: CatalogFormState,
  id?: string,
  overrides: Partial<CatalogFormState> = {},
): CatalogSavePayload {
  const nextForm = { ...form, ...overrides };
  const basePrice = toNumber(nextForm.basePrice);
  const sortOrder = Number.parseInt(nextForm.sortOrder || "0", 10);

  if (kind === "venue-packs") {
    return {
      id,
      name: nextForm.name.trim(),
      description: nullable(nextForm.description),
      basePrice,
      defaultStartTime: nullable(nextForm.defaultStartTime),
      defaultEndTime: nullable(nextForm.defaultEndTime),
      isActive: nextForm.isActive,
      sortOrder,
      internalNotes: nullable(nextForm.internalNotes),
    };
  }

  if (kind === "external-services") {
    return {
      id,
      code: nextForm.code.trim(),
      name: nextForm.name.trim(),
      description: nullable(nextForm.description),
      basePrice,
      isActive: nextForm.isActive,
      sortOrder,
      operationalNotes: nullable(nextForm.operationalNotes),
    };
  }

  return {
    id,
    name: nextForm.name.trim(),
    category: nullable(nextForm.category),
    basePrice,
    appliesTo: nextForm.appliesTo,
    isActive: nextForm.isActive,
    sortOrder,
    internalNotes: nullable(nextForm.internalNotes),
  };
}

function modalTitle(kind: CatalogKind) {
  if (kind === "venue-packs") return "Criar pack";
  if (kind === "external-services") return "Criar serviço externo";
  return "Criar extra";
}

function notesForItem(item: CatalogItem) {
  if ("operationalNotes" in item) return item.operationalNotes;
  if ("internalNotes" in item) return item.internalNotes;
  return null;
}

function appliesToLabel(value: EventExtra["appliesTo"]) {
  const labels: Record<EventExtra["appliesTo"], string> = {
    all: "Todos",
    venue_events: "Festas no Espaço",
    external_events: "Serviços Externos",
    workshops: "Workshops/Formações",
  };
  return labels[value];
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNumber(value: string) {
  return Number.parseFloat(value.replace(",", ".")) || 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}


