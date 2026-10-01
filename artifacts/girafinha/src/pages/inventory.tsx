import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  Boxes,
  History,
  ImageIcon,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListInventoryItemsQueryKey,
  getListInventoryMovementsQueryKey,
  useCreateInventoryItem,
  useCreateInventoryMovement,
  useListInventoryItems,
  useListInventoryMovements,
  useUpdateInventoryItem,
} from "@workspace/api-client-react";
import type {
  CreateInventoryItemBody,
  InventoryCondition,
  InventoryItem,
  InventoryItemType,
  InventoryMovement,
  InventoryMovementType,
  InventoryUnit,
  ListInventoryItemsParams,
  UpdateInventoryItemBody,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  INVENTORY_IMAGE_BUCKET,
  inventoryImageStoragePath,
  validateInventoryImage,
} from "@/lib/inventory-images";

const CONSUMABLE_CATEGORIES = [
  "Bebidas",
  "Snacks",
  "Doces",
  "Frescos",
  "Café / apoio",
  "Descartáveis",
  "Outros",
] as const;

const MATERIAL_CATEGORIES = [
  "Pratos decorativos",
  "Mesas",
  "Painéis",
  "Capas de painéis",
  "Cilindros",
  "Capas de cilindros",
  "Displays / temas",
  "Jarras / vasos",
  "Flores",
  "Números LED",
  "Estruturas / suportes",
  "Tecidos",
  "Outros",
] as const;

const UNITS: Array<{ value: InventoryUnit; label: string }> = [
  { value: "un", label: "un" },
  { value: "pacote", label: "pacote" },
  { value: "caixa", label: "caixa" },
  { value: "garrafa", label: "garrafa" },
  { value: "lata", label: "lata" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "ml", label: "ml" },
  { value: "conjunto", label: "conjunto" },
  { value: "outro", label: "outro" },
];

const LOCATIONS = ["Espaço Girafinha", "Loja", "Arrecadação", "Outro"] as const;
const CONDITIONS: Array<{ value: InventoryCondition; label: string }> = [
  { value: "bom", label: "Bom estado" },
  { value: "danificado", label: "Danificado" },
  { value: "em_reparacao", label: "Em reparação" },
];

type ActiveFilter = "active" | "inactive" | "all";

type ItemFormState = {
  name: string;
  category: string;
  quantity: string;
  unit: InventoryUnit;
  minimumStock: string;
  unitCost: string;
  color: string;
  theme: string;
  location: string;
  condition: InventoryCondition | "";
  purchaseCost: string;
  notes: string;
  isActive: boolean;
};

const EMPTY_FORM: ItemFormState = {
  name: "",
  category: "",
  quantity: "0",
  unit: "un",
  minimumStock: "",
  unitCost: "",
  color: "",
  theme: "",
  location: "",
  condition: "bom",
  purchaseCost: "",
  notes: "",
  isActive: true,
};

export default function InventoryPage() {
  const [itemType, setItemType] = useState<InventoryItemType>("consumable");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [condition, setCondition] = useState("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [editor, setEditor] = useState<{ item?: InventoryItem } | null>(null);
  const [movement, setMovement] = useState<{ item: InventoryItem; type: InventoryMovementType } | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const params = useMemo<ListInventoryItemsParams>(() => ({
    itemType,
    search: search.trim() || undefined,
    category: category === "all" ? undefined : category,
    location: itemType === "material" && location !== "all" ? location : undefined,
    condition: itemType === "material" && condition !== "all" ? condition as InventoryCondition : undefined,
    active: activeFilter === "all" ? undefined : activeFilter === "active",
    lowStock: itemType === "consumable" && lowStockOnly ? true : undefined,
  }), [activeFilter, category, condition, itemType, location, lowStockOnly, search]);

  const itemsQuery = useListInventoryItems(params);
  const items = itemsQuery.data ?? [];
  const categories = itemType === "consumable" ? CONSUMABLE_CATEGORIES : MATERIAL_CATEGORIES;

  const changeType = (value: string) => {
    setItemType(value as InventoryItemType);
    setCategory("all");
    setLocation("all");
    setCondition("all");
    setLowStockOnly(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Inventário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock físico e material reutilizável da Girafinha.
          </p>
        </div>
        <Button className="w-full rounded-xl sm:w-auto" onClick={() => setEditor({})}>
          <Plus className="h-4 w-4" />
          Novo artigo
        </Button>
      </div>

      <Tabs value={itemType} onValueChange={changeType}>
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl p-1 sm:w-auto">
          <TabsTrigger value="consumable" className="min-h-11 rounded-lg px-4">Comida e consumíveis</TabsTrigger>
          <TabsTrigger value="material" className="min-h-11 rounded-lg px-4">Material / decoração</TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="rounded-xl border border-border bg-card p-3 md:p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={itemType === "material" ? "Pesquisar nome ou tema…" : "Pesquisar por nome…"}
              className="pl-9"
            />
          </div>
          <FilterSelect value={category} onValueChange={setCategory} placeholder="Categoria">
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </FilterSelect>

          {itemType === "material" ? (
            <>
              <FilterSelect value={location} onValueChange={setLocation} placeholder="Localização">
                <SelectItem value="all">Todas as localizações</SelectItem>
                {LOCATIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </FilterSelect>
              <FilterSelect value={condition} onValueChange={setCondition} placeholder="Estado">
                <SelectItem value="all">Todos os estados</SelectItem>
                {CONDITIONS.map((value) => <SelectItem key={value.value} value={value.value}>{value.label}</SelectItem>)}
              </FilterSelect>
            </>
          ) : null}

          <FilterSelect value={activeFilter} onValueChange={(value) => setActiveFilter(value as ActiveFilter)} placeholder="Estado">
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </FilterSelect>
        </div>

        {itemType === "consumable" ? (
          <Button
            type="button"
            variant={lowStockOnly ? "default" : "outline"}
            size="sm"
            className="mt-3 rounded-xl"
            onClick={() => setLowStockOnly((value) => !value)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {lowStockOnly ? "A mostrar stock baixo" : "Ver stock baixo"}
          </Button>
        ) : null}
      </section>

      {itemsQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">A carregar inventário…</p>
      ) : itemsQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Não foi possível carregar o inventário.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Boxes className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum artigo encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou crie o primeiro artigo.</p>
        </div>
      ) : (
        <div className={itemType === "material" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
          {items.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              onEdit={() => setEditor({ item })}
              onMovement={(type) => setMovement({ item, type })}
              onHistory={() => setHistoryItem(item)}
            />
          ))}
        </div>
      )}

      <ItemEditorDialog
        key={editor?.item?.id ?? (editor ? "new" : "closed")}
        open={Boolean(editor)}
        itemType={itemType}
        item={editor?.item}
        onClose={() => setEditor(null)}
      />
      <MovementDialog
        key={movement ? movement.item.id + movement.type : "closed"}
        state={movement}
        onClose={() => setMovement(null)}
      />
      <HistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="min-h-10"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function InventoryCard({
  item,
  onEdit,
  onMovement,
  onHistory,
}: {
  item: InventoryItem;
  onEdit: () => void;
  onMovement: (type: InventoryMovementType) => void;
  onHistory: () => void;
}) {
  const queryClient = useQueryClient();
  const updateItem = useUpdateInventoryItem();
  const { toast } = useToast();
  const conditionLabel = CONDITIONS.find((entry) => entry.value === item.condition)?.label;

  const toggleActive = async () => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { isActive: !item.isActive } });
      await queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
      toast({ title: item.isActive ? "Artigo inativado" : "Artigo reativado" });
    } catch (error) {
      toast({ title: "Não foi possível atualizar o artigo", description: errorMessage(error), variant: "destructive" });
    }
  };

  return (
    <article className={"overflow-hidden rounded-xl border bg-card " + (!item.isActive ? "opacity-65" : "")}>
      {item.itemType === "material" ? (
        <InventoryImage path={item.photoPath} name={item.name} large={false} />
      ) : null}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{item.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {item.isLowStock ? <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Stock baixo</Badge> : null}
            {!item.isActive ? <Badge variant="outline">Inativo</Badge> : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-lg bg-muted/35 p-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Quantidade atual</p>
            <p className="mt-0.5 text-xl font-bold">{formatQuantity(item.quantityCurrent)} <span className="text-sm font-medium text-muted-foreground">{item.unit}</span></p>
          </div>
          {item.minimumStock !== null ? (
            <p className="text-right text-xs text-muted-foreground">Mín. {formatQuantity(item.minimumStock)} {item.unit}</p>
          ) : null}
        </div>

        {item.itemType === "material" ? (
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {item.location ? <Badge variant="outline">{item.location}</Badge> : null}
            {conditionLabel ? <Badge variant="outline">{conditionLabel}</Badge> : null}
            {item.theme ? <Badge variant="outline">Tema: {item.theme}</Badge> : null}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => onMovement("entry")}>
            <PackagePlus className="h-4 w-4" /> Entrada
          </Button>
          <Button variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => onMovement("exit")}>
            <Minus className="h-4 w-4" /> Saída
          </Button>
          <Button variant="outline" size="sm" className="min-h-10 rounded-xl" onClick={() => onMovement("adjustment")}>
            Ajuste
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={onHistory}><History className="h-4 w-4" /> Histórico</Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onEdit} aria-label={"Editar " + item.name}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleActive} aria-label={item.isActive ? "Inativar artigo" : "Reativar artigo"}>
              {item.isActive ? <Trash2 className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ItemEditorDialog({
  open,
  itemType,
  item,
  onClose,
}: {
  open: boolean;
  itemType: InventoryItemType;
  item?: InventoryItem;
  onClose: () => void;
}) {
  const actualType = item?.itemType ?? itemType;
  const categories = actualType === "consumable" ? CONSUMABLE_CATEGORIES : MATERIAL_CATEGORIES;
  const [form, setForm] = useState<ItemFormState>(() => itemToForm(item));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const previewUrl = useMemo(() => photoFile ? URL.createObjectURL(photoFile) : null, [photoFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const set = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.category) {
      toast({ title: "Indique o nome e a categoria", variant: "destructive" });
      return;
    }

    const quantity = parseOptionalNumber(form.quantity) ?? 0;
    if (!item && quantity < 0) {
      toast({ title: "A quantidade inicial não pode ser negativa", variant: "destructive" });
      return;
    }

    if (photoFile) {
      const imageError = validateInventoryImage(photoFile);
      if (imageError) {
        toast({ title: "Imagem inválida", description: imageError, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    let createdNewItem = false;
    try {
      const common = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        minimumStock: parseOptionalNumber(form.minimumStock),
        unitCost: parseOptionalNumber(form.unitCost),
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      };

      let saved: InventoryItem;
      if (!item) {
        const body: CreateInventoryItemBody = actualType === "consumable"
          ? { ...common, itemType: actualType, quantity }
          : {
              ...common,
              itemType: actualType,
              quantity,
              color: form.color.trim() || null,
              theme: form.theme.trim() || null,
              location: form.location || null,
              condition: form.condition || null,
              purchaseCost: parseOptionalNumber(form.purchaseCost),
            };
        saved = await createItem.mutateAsync({ data: body });
        createdNewItem = true;
      } else {
        const body: UpdateInventoryItemBody = actualType === "consumable"
          ? common
          : {
              ...common,
              color: form.color.trim() || null,
              theme: form.theme.trim() || null,
              location: form.location || null,
              condition: form.condition || null,
              purchaseCost: parseOptionalNumber(form.purchaseCost),
              ...(removePhoto ? { photoPath: null } : {}),
            };
        saved = await updateItem.mutateAsync({ id: item.id, data: body });
      }

      if (actualType === "material" && photoFile) {
        uploadedPath = inventoryImageStoragePath(saved.id, photoFile);
        const { error: uploadError } = await supabase.storage
          .from(INVENTORY_IMAGE_BUCKET)
          .upload(uploadedPath, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) throw uploadError;

        await updateItem.mutateAsync({ id: saved.id, data: { photoPath: uploadedPath } });
        uploadedPath = null;

        if (item?.photoPath) {
          void supabase.storage.from(INVENTORY_IMAGE_BUCKET).remove([item.photoPath]);
        }
      } else if (actualType === "material" && removePhoto && item?.photoPath) {
        void supabase.storage.from(INVENTORY_IMAGE_BUCKET).remove([item.photoPath]);
      }

      await queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
      toast({ title: item ? "Artigo atualizado" : "Artigo criado" });
      onClose();
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from(INVENTORY_IMAGE_BUCKET).remove([uploadedPath]);
      }
      if (createdNewItem) {
        await queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() });
        toast({
          title: "Artigo criado sem foto",
          description: "O artigo foi guardado, mas a imagem não ficou associada. Pode adicioná-la ao editar.",
          variant: "destructive",
        });
        onClose();
      } else {
        toast({ title: "Não foi possível guardar o artigo", description: errorMessage(error), variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar artigo" : actualType === "consumable" ? "Novo consumível" : "Novo material"}</DialogTitle>
          <DialogDescription>
            {actualType === "consumable" ? "Gira stock, mínimo e custo aproximado." : "Regista material físico reutilizável e a respetiva foto."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {actualType === "material" ? (
            <div className="sm:col-span-2">
              <Label>Foto principal</Label>
              <div className="mt-2 overflow-hidden rounded-xl border border-dashed border-border">
                {previewUrl ? (
                  <img src={previewUrl} alt="Pré-visualização" className="h-48 w-full object-contain bg-muted/20" />
                ) : item?.photoPath && !removePhoto ? (
                  <InventoryImage path={item.photoPath} name={item.name} large />
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex h-36 w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ImageIcon className="h-7 w-7" /> Adicionar foto
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  {item?.photoPath || photoFile ? "Alterar foto" : "Escolher foto"}
                </Button>
                {(item?.photoPath || photoFile) ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setPhotoFile(null); setRemovePhoto(true); }}>
                    Remover
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) { setPhotoFile(file); setRemovePhoto(false); }
                  event.target.value = "";
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG ou WebP · máximo 5 MB.</p>
            </div>
          ) : null}

          <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Categoria">
            <Select value={form.category || undefined} onValueChange={(value) => set("category", value)}>
              <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
              <SelectContent>{categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          {!item ? <Field label="Quantidade inicial"><Input type="number" min="0" step="0.001" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} /></Field> : null}
          <Field label="Unidade">
            <Select value={form.unit} onValueChange={(value) => set("unit", value as InventoryUnit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          {actualType === "consumable" ? (
            <>
              <Field label="Stock mínimo"><Input type="number" min="0" step="0.001" value={form.minimumStock} onChange={(e) => set("minimumStock", e.target.value)} placeholder="Opcional" /></Field>
              <Field label="Custo unitário aproximado"><Input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => set("unitCost", e.target.value)} placeholder="Opcional" /></Field>
            </>
          ) : (
            <>
              <Field label="Cor"><Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="Opcional" /></Field>
              <Field label="Tema"><Input value={form.theme} onChange={(e) => set("theme", e.target.value)} placeholder="Opcional" /></Field>
              <Field label="Localização">
                <Select value={form.location || "none"} onValueChange={(value) => set("location", value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Não definida</SelectItem>{LOCATIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Estado / condição">
                <Select value={form.condition || "none"} onValueChange={(value) => set("condition", value === "none" ? "" : value as InventoryCondition)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Não definido</SelectItem>{CONDITIONS.map((value) => <SelectItem key={value.value} value={value.value}>{value.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Custo de compra"><Input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={(e) => set("purchaseCost", e.target.value)} placeholder="Opcional" /></Field>
            </>
          )}

          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea className="mt-2" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Opcional" />
          </div>

          {item ? (
            <div className="sm:col-span-2 rounded-lg border border-border p-3">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => set("isActive", !form.isActive)}>
                <div><p className="text-sm font-medium">{form.isActive ? "Artigo ativo" : "Artigo inativo"}</p><p className="text-xs text-muted-foreground">Artigos inativos ficam fora da vista normal.</p></div>
                <Badge variant={form.isActive ? "default" : "outline"}>{form.isActive ? "Ativo" : "Inativo"}</Badge>
              </button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "A guardar…" : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  state,
  onClose,
}: {
  state: { item: InventoryItem; type: InventoryMovementType } | null;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(state?.type === "adjustment" ? String(state.item.quantityCurrent) : "");
  const [reason, setReason] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocalInput(new Date()));
  const mutation = useCreateInventoryMovement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!state) return null;

  const labels: Record<InventoryMovementType, string> = {
    entry: "Entrada de stock",
    exit: "Saída de stock",
    adjustment: "Correção / ajuste",
  };

  const save = async () => {
    const value = Number(quantity);
    if (!Number.isFinite(value) || value < 0 || (state.type !== "adjustment" && value <= 0)) {
      toast({ title: "Indique uma quantidade válida", variant: "destructive" });
      return;
    }

    try {
      await mutation.mutateAsync({
        id: state.item.id,
        data: {
          movementType: state.type,
          quantity: value,
          occurredAt: new Date(occurredAt).toISOString(),
          reason: reason.trim() || null,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListInventoryItemsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListInventoryMovementsQueryKey(state.item.id) }),
      ]);
      toast({ title: labels[state.type] + " registada" });
      onClose();
    } catch (error) {
      toast({ title: "Não foi possível registar o movimento", description: errorMessage(error), variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels[state.type]}</DialogTitle>
          <DialogDescription>{state.item.name} · atual: {formatQuantity(state.item.quantityCurrent)} {state.item.unit}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={state.type === "adjustment" ? "Nova quantidade física" : "Quantidade"}>
            <Input type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </Field>
          <Field label="Data / hora">
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </Field>
          <Field label="Motivo / nota">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra, utilizado em festa, estragado…" />
          </Field>
          {state.type === "exit" ? <p className="text-xs text-muted-foreground">A app bloqueia saídas que deixem o stock negativo.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={mutation.isPending}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de stock</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        {item ? <MovementHistory item={item} /> : null}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementHistory({ item }: { item: InventoryItem }) {
  const query = useListInventoryMovements(item.id);
  const movements = query.data ?? [];

  if (query.isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">A carregar histórico…</p>;
  if (movements.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Ainda não existem movimentos.</p>;

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {movements.map((movement) => <MovementRow key={movement.id} movement={movement} unit={item.unit} />)}
    </div>
  );
}

function MovementRow({ movement, unit }: { movement: InventoryMovement; unit: InventoryUnit }) {
  const label = movement.movementType === "entry" ? "Entrada" : movement.movementType === "exit" ? "Saída" : "Ajuste";
  const signed = movement.quantityDelta > 0 ? "+" + formatQuantity(movement.quantityDelta) : formatQuantity(movement.quantityDelta);
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div>
        <p className="text-sm font-medium">{label} · {signed} {unit}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(movement.occurredAt)}</p>
        {movement.reason ? <p className="mt-1 text-xs text-muted-foreground">{movement.reason}</p> : null}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">{formatQuantity(movement.quantityBefore)} → {formatQuantity(movement.quantityAfter)}</p>
    </div>
  );
}

function InventoryImage({ path, name, large }: { path: string | null; name: string; large: boolean }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) { setSrc(null); return; }
    void supabase.storage.from(INVENTORY_IMAGE_BUCKET).createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled) setSrc(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);

  const height = large ? "h-48" : "h-40";
  if (!src) {
    return <div className={height + " flex w-full items-center justify-center bg-muted/30 text-muted-foreground"}><ImageIcon className="h-8 w-8" /></div>;
  }
  return <img src={src} alt={name} className={height + " w-full object-contain bg-muted/20"} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label><div className="mt-2">{children}</div></div>;
}

function itemToForm(item?: InventoryItem): ItemFormState {
  if (!item) return { ...EMPTY_FORM };
  return {
    name: item.name,
    category: item.category,
    quantity: String(item.quantityCurrent),
    unit: item.unit,
    minimumStock: item.minimumStock === null ? "" : String(item.minimumStock),
    unitCost: item.unitCost === null ? "" : String(item.unitCost),
    color: item.color ?? "",
    theme: item.theme ?? "",
    location: item.location ?? "",
    condition: item.condition ?? "",
    purchaseCost: item.purchaseCost === null ? "" : String(item.purchaseCost),
    notes: item.notes ?? "",
    isActive: item.isActive,
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 3 }).format(value);
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocalInput(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado";
}
