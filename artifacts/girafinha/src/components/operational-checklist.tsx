import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ClipboardCheck, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  getListChecklistsQueryKey,
  useCreateChecklist,
  useListChecklists,
  useListChecklistTemplates,
  useUpsertChecklistItem,
} from "@workspace/api-client-react";
import type { ChecklistModule, ChecklistTemplate, EventChecklist } from "@workspace/api-client-react";

export function OperationalChecklist({ module, entityId, title }: { module: Extract<ChecklistModule, "venue_events" | "external_events">; entityId: string; title: string }) {
  const checklistsQuery = useListChecklists({ module, entityId });
  const templatesQuery = useListChecklistTemplates();
  const createChecklist = useCreateChecklist();
  const upsertItem = useUpsertChecklistItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const checklist = checklistsQuery.data?.[0];
  const template = useMemo(() => findTemplate(templatesQuery.data ?? [], module), [templatesQuery.data, module]);
  const done = checklist?.items.filter((item) => item.isDone).length ?? 0;
  const total = checklist?.items.length ?? 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListChecklistsQueryKey({ module, entityId }) });

  const handleCreate = async () => {
    try {
      await createChecklist.mutateAsync({ data: {
        module,
        entityId,
        templateId: template?.id ?? null,
        title,
        items: template?.items.map((item) => ({
          label: item.label,
          description: item.description,
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        })) ?? [],
      } });
      await refresh();
      toast({ title: "Checklist criada" });
    } catch {
      toast({ title: "Não foi possível criar checklist", variant: "destructive" });
    }
  };

  const toggleItem = async (itemId: string, isDone: boolean) => {
    try {
      await upsertItem.mutateAsync({ data: { id: itemId, isDone } });
      await refresh();
    } catch {
      toast({ title: "Não foi possível atualizar item", variant: "destructive" });
    }
  };

  if (checklistsQuery.isLoading) {
    return <Card className="border-border/70"><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />A carregar checklist...</CardContent></Card>;
  }

  return (
    <Card className="border-border/70 bg-background">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <p className="font-semibold">Checklist operacional</p>
            {checklist ? <Badge variant="outline">{done}/{total} concluídos</Badge> : null}
          </div>
          {!checklist ? (
            <Button size="sm" className="min-h-9" onClick={handleCreate} disabled={createChecklist.isPending}>
              <Plus className="h-4 w-4" />
              Criar checklist
            </Button>
          ) : null}
        </div>

        {!checklist ? (
          <p className="text-sm text-muted-foreground">
            {template ? "Será usada a checklist ativa de Definições." : "Não há template ativo. Pode criar uma checklist vazia para este evento."}
          </p>
        ) : checklist.items.length === 0 ? (
          <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Checklist vazia. Adicione itens no template em Definições para os próximos eventos.</p>
        ) : (
          <div className="space-y-2">
            {checklist.items.map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-md border border-border/70 p-3 text-sm">
                <Checkbox checked={item.isDone} onCheckedChange={(checked) => void toggleItem(item.id, checked === true)} />
                <span className="min-w-0 flex-1">
                  <span className={item.isDone ? "font-medium text-muted-foreground line-through" : "font-medium"}>{item.label}</span>
                  {item.description ? <span className="block text-muted-foreground">{item.description}</span> : null}
                </span>
                {item.isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function findTemplate(templates: ChecklistTemplate[], module: ChecklistModule) {
  return templates
    .filter((template) => template.module === module && template.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))[0];
}
