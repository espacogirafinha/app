import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getListExpenseCategoriesQueryKey,
  useCreateExpenseCategory,
  useListExpenseCategories,
  useUpdateExpenseCategory,
  type ExpenseCategory,
} from "@workspace/api-client-react";

export function SettingsExpenseCategories() {
  const query = useListExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt")),
    [query.data],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListExpenseCategoriesQueryKey() });
  const isSaving = createCategory.isPending || updateCategory.isPending;

  const toggle = async (category: ExpenseCategory) => {
    try {
      await updateCategory.mutateAsync({
        id: category.id,
        data: { isActive: !category.isActive },
      });
      await refresh();
    } catch {
      toast({ title: "Não foi possível atualizar a categoria", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-3 p-3 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Categorias de despesas</CardTitle>
              <CardDescription className="mt-1">
                Categorias usadas no registo e nos relatórios de despesas. Categorias antigas devem ser inativadas, não apagadas.
              </CardDescription>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Criar categoria
            </Button>
          </div>
        </CardHeader>
      </Card>

      {query.isLoading ? (
        <Card className="h-40 animate-pulse bg-muted/40" />
      ) : categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ainda não existem categorias. A migration proposta inclui as categorias iniciais sugeridas.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {categories.map((category) => (
            <Card key={category.id} className="border-border/70 shadow-sm">
              <CardContent className="space-y-3 p-3 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-xs text-muted-foreground">Ordem: {category.sortOrder}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditing(category)}>
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">{category.isActive ? "Ativa" : "Inativa"}</span>
                  <Switch
                    checked={category.isActive}
                    disabled={isSaving}
                    onCheckedChange={() => void toggle(category)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={creating || Boolean(editing)}
        category={editing}
        isSaving={isSaving}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSave={async (data) => {
          try {
            if (editing) {
              await updateCategory.mutateAsync({ id: editing.id, data });
            } else {
              await createCategory.mutateAsync({ data });
            }
            await refresh();
            setCreating(false);
            setEditing(null);
            toast({ title: editing ? "Categoria atualizada" : "Categoria criada" });
          } catch {
            toast({ title: "Não foi possível guardar a categoria", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  category,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  category: ExpenseCategory | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; sortOrder: number; isActive: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const { toast } = useToast();

  const initialize = (nextOpen: boolean) => {
    if (nextOpen) {
      setName(category?.name ?? "");
      setSortOrder(String(category?.sortOrder ?? 0));
      setIsActive(category?.isActive ?? true);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Criar categoria"}</DialogTitle>
          <DialogDescription>As categorias usadas historicamente devem ser mantidas e podem ser inativadas.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const order = Number.parseInt(sortOrder || "0", 10);
            if (!name.trim()) {
              toast({ title: "Nome obrigatório", variant: "destructive" });
              return;
            }
            if (Number.isNaN(order)) {
              toast({ title: "Ordem inválida", variant: "destructive" });
              return;
            }
            void onSave({ name: name.trim(), sortOrder: order, isActive });
          }}
        >
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Ordem</Label>
            <Input type="number" step="1" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Ativa</p>
              <p className="text-xs text-muted-foreground">Inativas deixam de aparecer em novas despesas.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
