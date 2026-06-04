import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, MessageSquare, Plus, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getListMessageTemplatesQueryKey,
  useCreateMessageTemplate,
  useListMessageTemplates,
} from "@workspace/api-client-react";
import type {
  CreateMessageTemplateBody,
  MessageTemplate,
  MessageTemplateModule,
  MessageTemplateTriggerType,
} from "@workspace/api-client-react";

const suggestedMessageTemplates: CreateMessageTemplateBody[] = [
  {
    name: "Confirmação de festa",
    module: "venue_events",
    triggerType: "confirmation",
    body: "Olá {customerName}! Confirmamos a sua festa no Espaço Girafinha para {eventDate} às {startTime}. Qualquer dúvida estamos disponíveis. Obrigada!",
    variables: "customerName,eventDate,startTime",
    isActive: true,
    sortOrder: 10,
  },
  {
    name: "Pedido de sinal",
    module: "venue_events",
    triggerType: "payment_request",
    body: "Olá {customerName}! Para confirmarmos a reserva da festa, pedimos o pagamento do sinal. Valor em falta: {amountDue}. Obrigada!",
    variables: "customerName,amountDue",
    isActive: true,
    sortOrder: 20,
  },
  {
    name: "Confirmação serviço externo",
    module: "external_events",
    triggerType: "confirmation",
    body: "Olá {customerName}! Confirmamos o serviço externo para {eventDate}. Vamos preparar tudo com muito carinho. Obrigada!",
    variables: "customerName,eventDate",
    isActive: true,
    sortOrder: 30,
  },
  {
    name: "Confirmação workshop",
    module: "workshop_participants",
    triggerType: "confirmation",
    body: "Olá {participantName}! A sua inscrição no workshop {workshopName} está confirmada. Até breve!",
    variables: "participantName,workshopName",
    isActive: true,
    sortOrder: 40,
  },
];

const messageVariables = [
  "{customerName}",
  "{eventDate}",
  "{startTime}",
  "{amountDue}",
  "{packName}",
  "{eventLocation}",
  "{workshopName}",
  "{participantName}",
];

const messageModuleOptions: { value: MessageTemplateModule; label: string }[] = [
  { value: "venue_events", label: "Festas no Espaço" },
  { value: "external_events", label: "Serviços Externos" },
  { value: "workshops", label: "Workshops/Formações" },
  { value: "workshop_participants", label: "Participantes de Workshops" },
  { value: "general", label: "Geral" },
];

const messageTriggerOptions: { value: MessageTemplateTriggerType; label: string }[] = [
  { value: "confirmation", label: "Confirmação" },
  { value: "payment_request", label: "Pedido de pagamento" },
  { value: "payment_reminder", label: "Lembrete de pagamento" },
  { value: "event_reminder", label: "Lembrete de evento" },
  { value: "post_event", label: "Pós-evento" },
  { value: "cancellation", label: "Cancelamento" },
  { value: "custom", label: "Personalizado" },
];

const emptyTemplate: CreateMessageTemplateBody = {
  name: "",
  module: "venue_events",
  triggerType: "confirmation",
  body: "",
  variables: "",
  isActive: true,
  sortOrder: 0,
};

export function SettingsMessageTemplates() {
  const templatesQuery = useListMessageTemplates();
  const createTemplate = useCreateMessageTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<{ open: boolean; item?: MessageTemplate }>({ open: false });

  const items = templatesQuery.data ?? [];
  const activeCount = items.filter((item) => item.isActive).length;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListMessageTemplatesQueryKey() });

  const saveTemplate = async (data: CreateMessageTemplateBody) => {
    await createTemplate.mutateAsync({ data });
    await refresh();
  };

  const addSuggested = async () => {
    const existing = new Set(items.map((template) => `${template.module}:${template.triggerType}:${template.name.toLowerCase()}`));
    const missing = suggestedMessageTemplates.filter(
      (template) => !existing.has(`${template.module}:${template.triggerType}:${template.name.toLowerCase()}`),
    );

    if (missing.length === 0) {
      toast({ title: "Templates sugeridos já existem" });
      return;
    }

    try {
      for (const template of missing) {
        await createTemplate.mutateAsync({ data: template });
      }
      await refresh();
      toast({ title: "Templates sugeridos adicionados", description: `${missing.length} template(s) ficaram disponíveis.` });
    } catch {
      toast({ title: "Não foi possível adicionar os templates sugeridos", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Templates WhatsApp</CardTitle>
              <CardDescription className="mt-1">Cria mensagens padrão para usar nos botões WhatsApp da app.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="min-h-10" onClick={addSuggested} disabled={createTemplate.isPending}>
                <Sparkles className="h-4 w-4" />
                Adicionar templates sugeridos
              </Button>
              <Button className="min-h-10" onClick={() => setModal({ open: true })}>
                <Plus className="h-4 w-4" />
                Criar template
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <SummaryPill label="Total" value={items.length} />
            <SummaryPill label="Ativos" value={activeCount} tone="active" />
            <SummaryPill label="Inativos" value={items.length - activeCount} tone="inactive" />
          </div>
          <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
            {messageVariables.map((variable) => (
              <Badge key={variable} variant="outline" className="font-mono">{variable}</Badge>
            ))}
          </div>
        </CardHeader>
      </Card>

      {templatesQuery.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="h-48 animate-pulse border-border/70 bg-muted/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Ainda não existem templates WhatsApp.</p>
              <p className="mt-1 text-sm text-muted-foreground">Crie um template ou adicione os sugeridos para começar.</p>
            </div>
            <Button className="min-h-10" onClick={() => setModal({ open: true })}>Criar template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <MessageTemplateCard
              key={item.id}
              item={item}
              isSaving={createTemplate.isPending}
              onEdit={() => setModal({ open: true, item })}
              onToggle={async () => {
                await saveTemplate({ ...toTemplatePayload(item), isActive: !item.isActive });
              }}
            />
          ))}
        </div>
      )}

      <MessageTemplateModal
        open={modal.open}
        item={modal.item}
        isSaving={createTemplate.isPending}
        onOpenChange={(open) => setModal((current) => ({ ...current, open }))}
        onSubmit={async (data) => {
          await saveTemplate(data);
          setModal({ open: false });
        }}
      />
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone?: "active" | "inactive" }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "active" ? "text-lg font-semibold text-emerald-700" : tone === "inactive" ? "text-lg font-semibold text-muted-foreground" : "text-lg font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function MessageTemplateCard({
  item,
  isSaving,
  onEdit,
  onToggle,
}: {
  item: MessageTemplate;
  isSaving: boolean;
  onEdit: () => void;
  onToggle: () => Promise<void>;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold leading-tight">{item.name}</h3>
              <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Ativo" : "Inativo"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{moduleLabel(item.module)} · {triggerLabel(item.triggerType)}</p>
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={onEdit}>
            <Edit className="h-4 w-4" />
            Editar
          </Button>
        </div>
        <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{item.body}</p>
        {item.variables ? <p className="font-mono text-xs text-muted-foreground">{item.variables}</p> : null}
        <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
          <span className="text-sm font-medium">{item.isActive ? "Disponível para WhatsApp" : "Inativo"}</span>
          <Switch checked={item.isActive} disabled={isSaving} onCheckedChange={() => void onToggle()} />
        </div>
      </CardContent>
    </Card>
  );
}

function MessageTemplateModal({
  open,
  item,
  isSaving,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  item?: MessageTemplate;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateMessageTemplateBody) => Promise<void>;
}) {
  const [form, setForm] = useState<CreateMessageTemplateBody>(emptyTemplate);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(item ? toTemplatePayload(item) : emptyTemplate);
  }, [item, open]);

  const patch = (value: Partial<CreateMessageTemplateBody>) => setForm((current) => ({ ...current, ...value }));
  const preview = renderTemplatePreview(form.body);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.module || !form.triggerType || !form.body.trim()) {
      toast({ title: "Campos obrigatórios", description: "Nome, módulo, tipo e mensagem são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      await onSubmit({ ...form, name: form.name.trim(), body: form.body.trim(), variables: nullable(form.variables ?? "") });
      toast({ title: item ? "Template atualizado" : "Template criado" });
    } catch {
      toast({ title: "Não foi possível guardar o template", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar template WhatsApp" : "Criar template WhatsApp"}</DialogTitle>
          <DialogDescription>Configure a mensagem e veja uma pré-visualização antes de guardar.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Confirmação de festa" />
            </Field>
            <Field label="Ordem">
              <Input type="number" value={String(form.sortOrder ?? 0)} onChange={(event) => patch({ sortOrder: Number.parseInt(event.target.value || "0", 10) })} />
            </Field>
            <Field label="Módulo">
              <Select value={form.module} onValueChange={(value) => patch({ module: value as MessageTemplateModule })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {messageModuleOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo/momento">
              <Select value={form.triggerType} onValueChange={(value) => patch({ triggerType: value as MessageTemplateTriggerType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {messageTriggerOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Mensagem">
            <Textarea value={form.body} onChange={(event) => patch({ body: event.target.value })} rows={6} placeholder="Olá {customerName}..." />
          </Field>
          <Field label="Variáveis usadas">
            <Input value={form.variables ?? ""} onChange={(event) => patch({ variables: event.target.value })} placeholder="customerName,eventDate,startTime" />
          </Field>
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4" />Pré-visualizar mensagem</div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview || "Escreva uma mensagem para pré-visualizar."}</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">Templates inativos ficam guardados, mas não são usados nos botões WhatsApp.</p>
            </div>
            <Switch checked={form.isActive ?? true} onCheckedChange={(checked) => patch({ isActive: checked })} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function toTemplatePayload(template: MessageTemplate): CreateMessageTemplateBody {
  return {
    id: template.id,
    name: template.name,
    module: template.module,
    triggerType: template.triggerType,
    body: template.body,
    variables: template.variables,
    isActive: template.isActive,
    sortOrder: template.sortOrder,
  };
}

function renderTemplatePreview(body: string) {
  const values: Record<string, string> = {
    customerName: "Ana Silva",
    eventDate: "12/06/2026",
    startTime: "10:00",
    amountDue: "50,00 €",
    packName: "Pack Simples",
    eventLocation: "Espaço Girafinha",
    workshopName: "Workshop Balões Nível 1",
    participantName: "Maria Santos",
  };
  return body.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

function moduleLabel(value: MessageTemplateModule) {
  return messageModuleOptions.find((option) => option.value === value)?.label ?? value;
}

function triggerLabel(value: MessageTemplateTriggerType) {
  return messageTriggerOptions.find((option) => option.value === value)?.label ?? value;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
