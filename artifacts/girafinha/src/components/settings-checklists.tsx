import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Edit, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getListChecklistTemplatesQueryKey,
  useCreateChecklistTemplate,
  useListChecklistTemplates,
  useUpsertChecklistTemplateItem,
} from "@workspace/api-client-react";
import type { ChecklistModule, ChecklistTemplate, ChecklistTemplateItem, CreateChecklistTemplateBody, CreateChecklistTemplateItemBody } from "@workspace/api-client-react";

const suggestedTemplates = [
  {
    name: "Checklist Festa no Espaço",
    module: "venue_events" as ChecklistModule,
    sortOrder: 10,
    items: [
      "Confirmar dados da festa",
      "Confirmar pagamento/sinal",
      "Confirmar tema e decoração",
      "Confirmar catering",
      "Preparar espaço",
      "Verificar limpeza final",
    ],
  },
  {
    name: "Checklist Serviço Externo",
    module: "external_events" as ChecklistModule,
    sortOrder: 20,
    items: [
      "Confirmar morada e horário",
      "Confirmar serviços contratados",
      "Preparar materiais",
      "Confirmar transporte/deslocação",
      "Confirmar montagem",
      "Confirmar desmontagem",
    ],
  },
];

type TemplateForm = {
  id?: string;
  name: string;
  module: ChecklistModule;
  eventType: string;
  serviceType: string;
  isActive: boolean;
  sortOrder: string;
};

type ItemForm = {
  id?: string;
  templateId: string;
  label: string;
  description: string;
  isRequired: boolean;
  sortOrder: string;
};

const emptyTemplate: TemplateForm = {
  name: "",
  module: "venue_events",
  eventType: "",
  serviceType: "",
  isActive: true,
  sortOrder: "0",
};

export function SettingsChecklists() {
  const templatesQuery = useListChecklistTemplates();
  const createTemplate = useCreateChecklistTemplate();
  const upsertItem = useUpsertChecklistTemplateItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [templateModal, setTemplateModal] = useState<{ open: boolean; template?: ChecklistTemplate }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean; template?: ChecklistTemplate; item?: ChecklistTemplateItem }>({ open: false });

  const templates = useMemo(
    () => [...(templatesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [templatesQuery.data],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() });

  const addSuggested = async () => {
    let createdCount = 0;
    let itemCount = 0;

    try {
      for (const template of suggestedTemplates) {
        let target = templates.find((current) => current.module === template.module && current.name.toLowerCase() === template.name.toLowerCase());
        if (!target) {
          target = await createTemplate.mutateAsync({ data: {
            name: template.name,
            module: template.module,
            isActive: true,
            sortOrder: template.sortOrder,
          } });
          createdCount += 1;
        }

        const existingLabels = new Set((target.items ?? []).map((item) => item.label.toLowerCase()));
        for (const [index, label] of template.items.entries()) {
          if (existingLabels.has(label.toLowerCase())) continue;
          await upsertItem.mutateAsync({ data: { templateId: target.id, label, isRequired: false, sortOrder: (index + 1) * 10 } });
          itemCount += 1;
        }
      }

      await refresh();
      toast({ title: "Checklists sugeridas adicionadas", description: `${createdCount} template(s), ${itemCount} item(ns).` });
    } catch {
      toast({ title: "Não foi possível adicionar checklists sugeridas", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Checklists operacionais</CardTitle>
              <CardDescription>Templates reutilizáveis para preparar festas e serviços externos.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="min-h-10" onClick={addSuggested} disabled={createTemplate.isPending || upsertItem.isPending}>
                <Sparkles className="h-4 w-4" />
                Adicionar checklists sugeridas
              </Button>
              <Button className="min-h-10" onClick={() => setTemplateModal({ open: true })}>
                <Plus className="h-4 w-4" />
                Criar checklist
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {templatesQuery.isLoading ? (
        <Card className="h-36 animate-pulse border-border/70 bg-muted/40" />
      ) : templates.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Ainda não existem templates de checklist.</p>
            <p className="text-sm text-muted-foreground">Crie um template ou adicione as checklists sugeridas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="border-border/70 shadow-sm">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words font-semibold">{template.name}</h3>
                      <Badge variant={template.isActive ? "default" : "secondary"}>{template.isActive ? "Ativo" : "Inativo"}</Badge>
                      <Badge variant="outline">{moduleLabel(template.module)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{template.items.length} item(ns) · ordem {template.sortOrder}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setTemplateModal({ open: true, template })}>
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                </div>

                <div className="space-y-2">
                  {template.items.length === 0 ? (
                    <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Sem itens. Adicione tarefas ao template.</p>
                  ) : template.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border/70 p-3 text-sm">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.description ? <p className="text-muted-foreground">{item.description}</p> : null}
                        <p className="text-xs text-muted-foreground">Ordem {item.sortOrder}{item.isRequired ? " · obrigatório" : ""}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setItemModal({ open: true, template, item })}>Editar</Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                  <span className="text-sm text-muted-foreground">{template.isActive ? "Disponível para novas checklists" : "Oculto para novas checklists"}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setItemModal({ open: true, template })}>
                      <Plus className="h-4 w-4" />
                      Item
                    </Button>
                    <Switch
                      checked={template.isActive}
                      disabled={createTemplate.isPending}
                      onCheckedChange={() => void createTemplate.mutateAsync({ data: templatePayload(template, { isActive: !template.isActive }) }).then(refresh)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateModal
        open={templateModal.open}
        template={templateModal.template}
        isSaving={createTemplate.isPending}
        onOpenChange={(open) => setTemplateModal((current) => ({ ...current, open }))}
        onSubmit={async (payload) => {
          await createTemplate.mutateAsync({ data: payload });
          await refresh();
          setTemplateModal({ open: false });
          toast({ title: payload.id ? "Template atualizado" : "Template criado" });
        }}
      />

      <ItemModal
        open={itemModal.open}
        template={itemModal.template}
        item={itemModal.item}
        isSaving={upsertItem.isPending}
        onOpenChange={(open) => setItemModal((current) => ({ ...current, open }))}
        onSubmit={async (payload) => {
          if (!itemModal.template) return;
          const data: CreateChecklistTemplateItemBody = {
            id: payload.id,
            templateId: itemModal.template.id,
            label: payload.label.trim(),
            description: payload.description.trim() || null,
            isRequired: payload.isRequired,
            sortOrder: Number.parseInt(payload.sortOrder || "0", 10) || 0,
          };
          await upsertItem.mutateAsync({ data });
          await refresh();
          setItemModal({ open: false });
          toast({ title: payload.id ? "Item atualizado" : "Item criado" });
        }}
      />
    </div>
  );
}

function TemplateModal({ open, template, isSaving, onOpenChange, onSubmit }: {
  open: boolean;
  template?: ChecklistTemplate;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateChecklistTemplateBody & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<TemplateForm>(emptyTemplate);

  useMemo(() => {
    if (open) {
      setForm(template ? {
        id: template.id,
        name: template.name,
        module: template.module,
        eventType: template.eventType ?? "",
        serviceType: template.serviceType ?? "",
        isActive: template.isActive,
        sortOrder: String(template.sortOrder),
      } : emptyTemplate);
    }
  }, [open, template]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{template ? "Editar checklist" : "Criar checklist"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(templatePayload(form)); }}>
          <Field label="Nome"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Módulo">
              <Select value={form.module} onValueChange={(value) => setForm({ ...form, module: value as ChecklistModule })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venue_events">Festas no Espaço</SelectItem>
                  <SelectItem value="external_events">Serviços Externos</SelectItem>
                  <SelectItem value="workshops">Workshops</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ordem"><Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de evento"><Input value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })} /></Field>
            <Field label="Tipo de serviço"><Input value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
            <span className="text-sm font-medium">Ativo</span>
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={isSaving}>{isSaving ? "A guardar..." : "Guardar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemModal({ open, template, item, isSaving, onOpenChange, onSubmit }: {
  open: boolean;
  template?: ChecklistTemplate;
  item?: ChecklistTemplateItem;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ItemForm) => Promise<void>;
}) {
  const [form, setForm] = useState<ItemForm>({ templateId: "", label: "", description: "", isRequired: false, sortOrder: "0" });

  useMemo(() => {
    if (open) {
      setForm(item ? {
        id: item.id,
        templateId: item.templateId,
        label: item.label,
        description: item.description ?? "",
        isRequired: item.isRequired,
        sortOrder: String(item.sortOrder),
      } : { templateId: template?.id ?? "", label: "", description: "", isRequired: false, sortOrder: String((template?.items.length ?? 0) * 10 + 10) });
    }
  }, [open, item, template]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{item ? "Editar item" : "Adicionar item"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
          <Field label="Tarefa"><Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></Field>
          <Field label="Descrição"><Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ordem"><Input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
            <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
              <span className="text-sm font-medium">Obrigatório</span>
              <Switch checked={form.isRequired} onCheckedChange={(checked) => setForm({ ...form, isRequired: checked })} />
            </div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={isSaving}>{isSaving ? "A guardar..." : "Guardar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function templatePayload(source: TemplateForm | ChecklistTemplate, overrides: Partial<TemplateForm> = {}): CreateChecklistTemplateBody & { id?: string } {
  const merged = { ...source, ...overrides } as TemplateForm;
  return {
    id: "id" in source ? source.id : undefined,
    name: merged.name.trim(),
    module: merged.module,
    eventType: merged.eventType?.trim() ? merged.eventType.trim() : null,
    serviceType: merged.serviceType?.trim() ? merged.serviceType.trim() : null,
    isActive: merged.isActive,
    sortOrder: Number.parseInt(String(merged.sortOrder || "0"), 10) || 0,
  };
}

function moduleLabel(module: ChecklistModule) {
  const labels: Record<ChecklistModule, string> = {
    venue_events: "Festas no Espaço",
    external_events: "Serviços Externos",
    workshops: "Workshops",
    general: "Geral",
  };
  return labels[module];
}


