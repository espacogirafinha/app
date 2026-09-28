import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Boxes,
  Eye,
  Loader2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type {
  CreateInventoryItemBody,
  CreateInventoryMovementBody,
  InventoryItem,
  InventoryMovement,
  InventoryMovementReason,
  UpdateInventoryItemBody,
} from "@workspace/api-client-react";
import {
  getGetInventoryItemQueryKey,
  getGetInventorySummaryQueryKey,
  getListInventoryItemsQueryKey,
  getListInventoryMovementsQueryKey,
  useAdjustInventoryStock,
  useCreateInventoryItem,
  useCreateInventoryMovement,
  useGetInventorySummary,
  useListInventoryItems,
  useListInventoryMovements,
  useUpdateInventoryItem,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NullableNumericMoneyInput } from "@/components/money-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type TypeFilter = "all" | "consumable" | "material";
type AttentionFilter = "all" | "low" | "out" | "to_restock" | "inactive";

type InventoryForm = {
  itemType: "consumable" | "material";
  name: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  unit: string;
  minimumStock: string;
  location: string;
  referenceCost: number | null;
  notes: string;
  isActive: boolean;
  initialStock: string;
};

const EMPTY_FORM: InventoryForm = {
  itemType: "consumable",
  name: "",
  category: "",
  brand: "",
  color: "",
  size: "",
  unit: "unidade",
  minimumStock: "",
  location: "",
  referenceCost: null,
  notes: "",
  isActive: true,
  initialStock: "0",
};

const UNIT_SUGGESTIONS = [
  "unidade",
  "pacote",
  "saco",
  "caixa",
  "garrafa",
  "lata",
  "kg",
  "g",
  "L",
  "ml",
  "rolo",
];

const REASON_LABELS: Record<InventoryMovementReason, string> = {
  initial_stock: "Stock inicial",
  purchase: "Compra/reposição",
  usage: "Utilização",
  correction: "Correção",
  damaged: "Danificado",
  lost: "Perdido",
  return: "Devolução",
};

const ENTRY_REASONS: InventoryMovementReason[] = ["purchase", "return", "correction"];
const EXIT_REASONS: InventoryMovementReason[] = ["usage", "damaged", "lost", "correction"];

export default function InventoryPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editor, setEditor] = useState<{ open: boolean; item?: InventoryItem }>({ open: false });
  const [movement, setMovement] = useState<{ item: InventoryItem; direction: "in" | "out" } | null>(null);
  const [detail, setDetail] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  const params = {
    search: search.trim() || undefined,
    itemType: typeFilter === "all" ? undefined : typeFilter,
    category: category === "all" ? undefined : category,
    activity: attentionFilter === "inactive" ? "inactive" as const : "active" as const,
    stockStatus:
      attentionFilter === "low" || attentionFilter === "out" || attentionFilter === "to_restock"
        ? attentionFilter
        : undefined,
  };

  const itemsQuery = useListInventoryItems(params);
  const allItemsQuery = useListInventoryItems({ activity: "all" });
  const summaryQuery = useGetInventorySummary();

  const categories = useMemo(
    () =>
      [...new Set((allItemsQuery.data ?? []).map((item) => item.category).filter((value): value is string => Boolean(value)))]
        .sort((a, b) => a.localeCompare(b, "pt-PT", { sensitivity: "base" })),
    [allItemsQuery.data],
  );

  const summary = summaryQuery.data;

  return (
    <div className="animate-in space-y-4 overflow-x-hidden fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl bg-primary/10 p-2 text-primary sm:inline-flex">
              <Boxes className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Inventário</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Stock atual, entradas, saídas e materiais que precisam de reposição.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true })} className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" />
          Novo item
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <SummaryCard label="Itens ativos" value={summary?.activeItems ?? 0} />
        <SummaryCard label="Stock baixo" value={summary?.lowStock ?? 0} onClick={() => setAttentionFilter("low")} />
        <SummaryCard label="Sem stock" value={summary?.outOfStock ?? 0} onClick={() => setAttentionFilter("out")} />
        <SummaryCard label="A repor" value={summary?.toRestock ?? 0} onClick={() => setAttentionFilter("to_restock")} />
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-3 md:p-4">
          <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <TabsList className="grid h-auto grid-cols-3">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="consumable">Consumíveis</TabsTrigger>
              <TabsTrigger value="material">Materiais</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar água, rosa, painel, Sempertex..."
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={attentionFilter} onValueChange={(value) => setAttentionFilter(value as AttentionFilter)}>
              <SelectTrigger>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ativos</SelectItem>
                <SelectItem value="low">Stock baixo</SelectItem>
                <SelectItem value="out">Sem stock</SelectItem>
                <SelectItem value="to_restock">A repor</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {itemsQuery.isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (itemsQuery.data ?? []).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
            <Boxes className="h-8 w-8 text-muted-foreground/60" />
            <p className="font-semibold">Sem itens para mostrar</p>
            <p className="text-sm text-muted-foreground">Crie um item ou altere os filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(itemsQuery.data ?? []).map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              onEntry={() => setMovement({ item, direction: "in" })}
              onExit={() => setMovement({ item, direction: "out" })}
              onView={() => setDetail(item)}
            />
          ))}
        </div>
      )}

      <InventoryItemDialog
        open={editor.open}
        item={editor.item}
        onOpenChange={(open) => setEditor(open ? editor : { open: false })}
      />
      <StockMovementDialog movement={movement} onClose={() => setMovement(null)} />
      <InventoryDetailDialog
        item={detail}
        onClose={() => setDetail(null)}
        onEdit={(item) => {
          setDetail(null);
          setEditor({ open: true, item });
        }}
        onAdjust={(item) => {
          setDetail(null);
          setAdjustItem(item);
        }}
      />
      <AdjustStockDialog item={adjustItem} onClose={() => setAdjustItem(null)} />
    </div>
  );
}

function SummaryCard({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  const content = (
    <CardContent className="p-3 md:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </CardContent>
  );

  if (!onClick) return <Card className="border-border/70 shadow-sm">{content}</Card>;

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full border-border/70 shadow-sm transition hover:border-primary/40">{content}</Card>
    </button>
  );
}

function InventoryCard({
  item,
  onEntry,
  onExit,
  onView,
}: {
  item: InventoryItem;
  onEntry: () => void;
  onExit: () => void;
  onView: () => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-3 p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words font-semibold">{item.name}</p>
              <TypeBadge itemType={item.itemType} />
              {!item.isActive ? <Badge variant="outline">Inativo</Badge> : <StockBadge item={item} />}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[item.category, item.location].filter(Boolean).join(" · ") || "Sem categoria/localização"}
            </p>
            {item.itemType === "material" && (item.brand || item.color || item.size) ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {[item.brand, item.color, item.size].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold">{formatQuantity(item.currentStock)}</p>
            <p className="text-xs text-muted-foreground">{item.unit}</p>
          </div>
        </div>

        {item.minimumStock !== null ? (
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <span>Mínimo {formatQuantity(item.minimumStock)} {item.unit}</span>
            {item.missingToMinimum > 0 ? (
              <span className="font-semibold text-amber-700">Faltam {formatQuantity(item.missingToMinimum)}</span>
            ) : (
              <span className="text-muted-foreground">Stock suficiente</span>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" onClick={onEntry} disabled={!item.isActive} className="gap-1">
            <ArrowUp className="h-4 w-4" />Entrada
          </Button>
          <Button type="button" variant="outline" onClick={onExit} disabled={!item.isActive || item.currentStock <= 0} className="gap-1">
            <ArrowDown className="h-4 w-4" />Saída
          </Button>
          <Button type="button" variant="secondary" onClick={onView} className="gap-1">
            <Eye className="h-4 w-4" />Ver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ itemType }: { itemType: InventoryItem["itemType"] }) {
  return <Badge variant="secondary">{itemType === "consumable" ? "Consumível" : "Material"}</Badge>;
}

function StockBadge({ item }: { item: InventoryItem }) {
  if (item.stockState === "out") return <Badge variant="destructive">Sem stock</Badge>;
  if (item.stockState === "low") {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Stock baixo</Badge>;
  }
  return null;
}

function InventoryItemDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item?: InventoryItem;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<InventoryForm>({ ...EMPTY_FORM });
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(item ? formFromItem(item) : { ...EMPTY_FORM });
  }, [open, item?.id]);

  const saving = createItem.isPending || updateItem.isPending;

  const save = async () => {
    const name = form.name.trim();
    const unit = form.unit.trim();
    const minimumStock = parseNullableQuantity(form.minimumStock);
    const initialStock = parseRequiredQuantity(form.initialStock, -1);

    if (!name || !unit) {
      toast({ title: "Preencha o nome e a unidade", variant: "destructive" });
      return;
    }
    if (form.minimumStock.trim() && minimumStock === null) {
      toast({ title: "Stock mínimo inválido", variant: "destructive" });
      return;
    }
    if (minimumStock !== null && minimumStock < 0) {
      toast({ title: "Stock mínimo inválido", variant: "destructive" });
      return;
    }
    if (!item && initialStock < 0) {
      toast({ title: "Stock inicial inválido", variant: "destructive" });
      return;
    }

    const base = {
      itemType: form.itemType,
      name,
      category: nullableText(form.category),
      brand: nullableText(form.brand),
      color: nullableText(form.color),
      size: nullableText(form.size),
      unit,
      minimumStock,
      location: nullableText(form.location),
      referenceCost: form.referenceCost,
      notes: nullableText(form.notes),
      isActive: form.isActive,
    };

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, data: base as UpdateInventoryItemBody });
      } else {
        await createItem.mutateAsync({ data: { ...base, initialStock } as CreateInventoryItemBody });
      }
      await refreshInventory(queryClient, item?.id);
      toast({ title: item ? "Item atualizado" : "Item criado" });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Não foi possível guardar", description: errorText(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item de inventário"}</DialogTitle>
          <DialogDescription>O stock é alterado por movimentos; estes campos descrevem o item.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select value={form.itemType} onValueChange={(value) => setForm({ ...form, itemType: value as InventoryForm["itemType"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consumable">Consumível</SelectItem>
                <SelectItem value="material">Material / decoração</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Água 33 cl" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Bebidas, Balões, Painéis" />
          </Field>
          <Field label="Unidade">
            <Input list="inventory-unit-options" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unidade" />
            <datalist id="inventory-unit-options">
              {UNIT_SUGGESTIONS.map((unit) => <option key={unit} value={unit} />)}
            </datalist>
          </Field>
          <Field label="Marca">
            <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Cor">
            <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="Tamanho / dimensão">
            <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder={'Ex.: 12", 1,80 m'} />
          </Field>
          <Field label="Localização">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex.: Armazém, Girafinha" />
          </Field>
          <Field label="Stock mínimo">
            <QuantityInput value={form.minimumStock} onChange={(value) => setForm({ ...form, minimumStock: value })} placeholder="Sem mínimo" />
          </Field>
          <Field label="Custo de referência">
            <NullableNumericMoneyInput value={form.referenceCost} onValueChange={(value) => setForm({ ...form, referenceCost: value })} placeholder="Opcional" />
          </Field>
          {!item ? (
            <Field label="Stock inicial">
              <QuantityInput value={form.initialStock} onChange={(value) => setForm({ ...form, initialStock: value })} placeholder="0" />
            </Field>
          ) : null}
          <div className="sm:col-span-2">
            <Field label="Notas">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas opcionais" />
            </Field>
          </div>
          {item ? (
            <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Item ativo</p>
                <p className="text-xs text-muted-foreground">Itens inativos mantêm todo o histórico.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} />
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            {item ? "Guardar alterações" : "Criar item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockMovementDialog({
  movement,
  onClose,
}: {
  movement: { item: InventoryItem; direction: "in" | "out" } | null;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<InventoryMovementReason>("purchase");
  const [note, setNote] = useState("");
  const mutation = useCreateInventoryMovement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!movement) return;
    setQuantity("");
    setReason(movement.direction === "out" ? "usage" : "purchase");
    setNote("");
  }, [movement?.item.id, movement?.direction]);

  if (!movement) return null;
  const reasons = movement.direction === "in" ? ENTRY_REASONS : EXIT_REASONS;

  const save = async () => {
    const parsedQuantity = parseRequiredQuantity(quantity, 0);
    if (parsedQuantity <= 0) {
      toast({ title: "Indique uma quantidade superior a zero", variant: "destructive" });
      return;
    }

    try {
      await mutation.mutateAsync({
        id: movement.item.id,
        data: {
          direction: movement.direction,
          quantity: parsedQuantity,
          reason: reason as CreateInventoryMovementBody["reason"],
          note: nullableText(note),
        },
      });
      await refreshInventory(queryClient, movement.item.id);
      toast({ title: movement.direction === "in" ? "Entrada registada" : "Saída registada" });
      onClose();
    } catch (error) {
      toast({
        title: movement.direction === "in" ? "Não foi possível registar a entrada" : "Não foi possível registar a saída",
        description: errorText(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{movement.direction === "in" ? "Entrada de stock" : "Saída de stock"}</DialogTitle>
          <DialogDescription>
            {movement.item.name} · atual {formatQuantity(movement.item.currentStock)} {movement.item.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Quantidade"><QuantityInput value={quantity} onChange={setQuantity} autoFocus /></Field>
          <Field label="Motivo">
            <Select value={reason} onValueChange={(value) => setReason(value as InventoryMovementReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {reasons.map((value) => <SelectItem key={value} value={value}>{REASON_LABELS[value]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : movement.direction === "in" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustStockDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [stock, setStock] = useState("");
  const [note, setNote] = useState("");
  const mutation = useAdjustInventoryStock();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!item) return;
    setStock(formatQuantity(item.currentStock));
    setNote("");
  }, [item?.id]);

  if (!item) return null;

  const save = async () => {
    const realStock = parseRequiredQuantity(stock, -1);
    if (realStock < 0) {
      toast({ title: "Stock real inválido", variant: "destructive" });
      return;
    }
    try {
      await mutation.mutateAsync({ id: item.id, data: { stock: realStock, note: nullableText(note) } });
      await refreshInventory(queryClient, item.id);
      toast({ title: "Stock ajustado", description: "Foi criado um movimento de correção no histórico." });
      onClose();
    } catch (error) {
      toast({ title: "Não foi possível ajustar o stock", description: errorText(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>
            {item.name} · a app indica {formatQuantity(item.currentStock)} {item.unit}. Introduza o valor contado fisicamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Stock real"><QuantityInput value={stock} onChange={setStock} autoFocus /></Field>
          <Field label="Nota"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: contagem física" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
            Ajustar stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryDetailDialog({
  item,
  onClose,
  onEdit,
  onAdjust,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}) {
  const movementsQuery = useListInventoryMovements(item?.id ?? "", { query: { enabled: Boolean(item) } });
  const updateItem = useUpdateInventoryItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!item) return null;

  const toggleActive = async () => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { isActive: !item.isActive } });
      await refreshInventory(queryClient, item.id);
      toast({ title: item.isActive ? "Item desativado" : "Item ativado" });
      onClose();
    } catch (error) {
      toast({ title: "Não foi possível alterar o estado", description: errorText(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{item.name}</DialogTitle>
            <TypeBadge itemType={item.itemType} />
            {!item.isActive ? <Badge variant="outline">Inativo</Badge> : <StockBadge item={item} />}
          </div>
          <DialogDescription>
            {formatQuantity(item.currentStock)} {item.unit} em stock
            {item.minimumStock !== null ? " · mínimo " + formatQuantity(item.minimumStock) : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Info label="Categoria" value={item.category || "—"} />
          <Info label="Localização" value={item.location || "—"} />
          <Info label="Marca" value={item.brand || "—"} />
          <Info label="Cor" value={item.color || "—"} />
          <Info label="Tamanho" value={item.size || "—"} />
          <Info label="Custo ref." value={item.referenceCost === null ? "—" : euro(item.referenceCost)} />
        </div>

        {item.notes ? <div className="rounded-xl bg-muted/40 p-3 text-sm whitespace-pre-wrap">{item.notes}</div> : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" />Editar</Button>
          <Button variant="outline" onClick={() => onAdjust(item)} disabled={!item.isActive}><SlidersHorizontal className="h-4 w-4" />Ajustar stock</Button>
          <Button variant="outline" onClick={toggleActive} disabled={updateItem.isPending}>
            <Archive className="h-4 w-4" />{item.isActive ? "Desativar" : "Ativar"}
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Histórico de stock</h3>
            <p className="text-xs text-muted-foreground">Movimentos mais recentes primeiro.</p>
          </div>
          {movementsQuery.isLoading ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (movementsQuery.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Sem movimentos.</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {(movementsQuery.data ?? []).map((movement) => <MovementRow key={movement.id} movement={movement} unit={item.unit} />)}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementRow({ movement, unit }: { movement: InventoryMovement; unit: string }) {
  const positive = movement.quantityDelta > 0;
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{REASON_LABELS[movement.reason]}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(movement.occurredAt)}</p>
        {movement.note ? <p className="mt-1 break-words text-xs text-muted-foreground">{movement.note}</p> : null}
      </div>
      <p className={"shrink-0 font-bold " + (positive ? "text-emerald-700" : "text-rose-700")}>
        {positive ? "+" : ""}{formatQuantity(movement.quantityDelta)} {unit}
      </p>
    </div>
  );
}

function QuantityInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" placeholder={placeholder} autoFocus={autoFocus} />;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>;
}

function nullableText(value: string) {
  return value.trim() || null;
}

function parseNullableQuantity(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredQuantity(value: string, fallback: number) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formFromItem(item: InventoryItem): InventoryForm {
  return {
    itemType: item.itemType,
    name: item.name,
    category: item.category ?? "",
    brand: item.brand ?? "",
    color: item.color ?? "",
    size: item.size ?? "",
    unit: item.unit,
    minimumStock: item.minimumStock === null ? "" : formatQuantity(item.minimumStock),
    location: item.location ?? "",
    referenceCost: item.referenceCost,
    notes: item.notes ?? "",
    isActive: item.isActive,
    initialStock: "0",
  };
}

function formatQuantity(value: number) {
  return value.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
}

function euro(value: number) {
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorText(error: unknown) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  if (typeof data?.error === "string") return data.error;
  return error instanceof Error ? error.message : "Tente novamente.";
}

async function refreshInventory(queryClient: QueryClient, itemId?: string) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetInventorySummaryQueryKey() }),
  ];
  if (itemId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: getGetInventoryItemQueryKey(itemId) }),
      queryClient.invalidateQueries({ queryKey: getListInventoryMovementsQueryKey(itemId) }),
    );
  }
  await Promise.all(invalidations);
}
