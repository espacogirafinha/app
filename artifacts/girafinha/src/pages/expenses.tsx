import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Edit, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MoneyInput } from "@/components/money-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { parseMoneyInput } from "@/lib/money";
import {
  getListExpensesQueryKey,
  useCreateExpense,
  useDeleteExpense,
  useListExpenseCategories,
  useListExpenses,
  useListExternalEvents,
  useListVenueEvents,
  useUpdateExpense,
  type CreateExpenseBody,
  type Expense,
  type ExpenseEventLink,
  type ExpenseEventLinkInput,
  type ExpenseType,
} from "@workspace/api-client-react";

type DateMode = "month" | "year" | "custom";

type ExpenseForm = {
  expenseDate: string;
  description: string;
  amount: string;
  categoryId: string;
  expenseType: ExpenseType;
  supplier: string;
  notes: string;
  eventLinks: ExpenseEventLinkInput[];
};

type ExpenseEventOption = {
  eventType: "venue_event" | "external_event";
  eventId: string;
  eventDate: string;
  customerName: string;
  birthdayChildName: string | null;
  typeLabel: "Festa" | "Serviço Externo";
  displayName: string;
};

const ALL = "__all__";
const PERSONNEL_EXPENSE_CATEGORY_NAME = "Pessoal / Colaboradores";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function yearRange(year: number) {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function emptyForm(): ExpenseForm {
  return {
    expenseDate: today(),
    description: "",
    amount: "",
    categoryId: "",
    expenseType: "operational",
    supplier: "",
    notes: "",
    eventLinks: [],
  };
}

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

export default function ExpensesPage() {
  const [dateMode, setDateMode] = useState<DateMode>("month");
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(() => monthRange(currentMonth()).startDate);
  const [customEnd, setCustomEnd] = useState(() => monthRange(currentMonth()).endDate);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL);
  const [expenseType, setExpenseType] = useState<ExpenseType | typeof ALL>(ALL);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const range = dateMode === "month"
    ? monthRange(month)
    : dateMode === "year"
      ? yearRange(year)
      : { startDate: customStart, endDate: customEnd };

  const summaryParams = {
    startDate: range.startDate,
    endDate: range.endDate,
    search: search.trim() || undefined,
    categoryId: categoryId === ALL ? undefined : categoryId,
  };
  const params = {
    ...summaryParams,
    expenseType: expenseType === ALL ? undefined : expenseType,
  };

  const expensesQuery = useListExpenses(params);
  const summaryExpensesQuery = useListExpenses(summaryParams);
  const categoriesQuery = useListExpenseCategories();
  const venueEventsQuery = useListVenueEvents();
  const externalEventsQuery = useListExternalEvents();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const categories = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt")),
    [categoriesQuery.data],
  );
  const activeCategories = categories.filter((category) => category.isActive);
  const expenses = expensesQuery.data ?? [];
  const summaryExpenses = summaryExpensesQuery.data ?? [];
  const eventOptions = useMemo<ExpenseEventOption[]>(
    () => [
      ...(venueEventsQuery.data ?? []).map((event) => ({
        eventType: "venue_event" as const,
        eventId: event.id,
        eventDate: event.eventDate,
        customerName: event.customerName,
        birthdayChildName: event.birthdayChildName ?? null,
        typeLabel: "Festa" as const,
        displayName: event.birthdayChildName || event.customerName,
      })),
      ...(externalEventsQuery.data ?? []).map((event) => ({
        eventType: "external_event" as const,
        eventId: event.id,
        eventDate: event.eventDate,
        customerName: event.customerName,
        birthdayChildName: null,
        typeLabel: "Serviço Externo" as const,
        displayName: event.customerName,
      })),
    ].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || a.displayName.localeCompare(b.displayName, "pt")),
    [externalEventsQuery.data, venueEventsQuery.data],
  );

  const summary = useMemo(() => {
    const operational = summaryExpenses
      .filter((expense) => expense.expenseType === "operational")
      .reduce((sum, expense) => sum + expense.amount, 0);
    const investments = summaryExpenses
      .filter((expense) => expense.expenseType === "investment")
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { operational, investments, total: operational + investments };
  }, [summaryExpenses]);

  const toggleExpenseType = (nextType: ExpenseType) => {
    setExpenseType((current) => current === nextType ? ALL : nextType);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey(params) });
  const isSaving = createExpense.isPending || updateExpense.isPending || deleteExpense.isPending;

  return (
    <div className="animate-in space-y-4 fade-in slide-in-from-bottom-4 duration-500 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">Despesas</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Saídas reais do negócio. O custo estimado das Festas é analisado separadamente nos Relatórios.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Adicionar despesa
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-3 md:p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={dateMode === "month" ? "default" : "outline"} onClick={() => setDateMode("month")}>Mês</Button>
            <Button type="button" size="sm" variant={dateMode === "year" ? "default" : "outline"} onClick={() => setDateMode("year")}>Ano</Button>
            <Button type="button" size="sm" variant={dateMode === "custom" ? "default" : "outline"} onClick={() => setDateMode("custom")}>Intervalo</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {dateMode === "month" ? (
              <div className="space-y-2">
                <Label>Mês e ano</Label>
                <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </div>
            ) : dateMode === "year" ? (
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>De</Label>
                  <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Até</Label>
                  <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Pesquisa</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Descrição ou fornecedor" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={expenseType} onValueChange={(value) => setExpenseType(value as ExpenseType | typeof ALL)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value="operational">Despesa operacional</SelectItem>
                  <SelectItem value="investment">Investimento / Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="Operacionais"
          value={summary.operational}
          active={expenseType === "operational"}
          onClick={() => toggleExpenseType("operational")}
        />
        <SummaryCard
          label="Investimentos"
          value={summary.investments}
          active={expenseType === "investment"}
          onClick={() => toggleExpenseType("investment")}
        />
        <SummaryCard label="Total saídas" value={summary.total} />
      </div>

      {expensesQuery.isLoading ? (
        <Card className="h-40 animate-pulse bg-muted/40" />
      ) : expenses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Sem despesas neste período/filtro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Card key={expense.id} className="border-border/70 shadow-sm">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{expense.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(`${expense.expenseDate}T12:00:00`).toLocaleDateString("pt-PT")}
                      {expense.supplier ? ` · ${expense.supplier}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-bold">{euro(expense.amount)}</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-muted px-2 py-1">{expense.categoryName}</span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    {expense.expenseType === "operational" ? "Operacional" : "Investimento"}
                  </span>
                  {expense.eventLinks.length > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                      {expense.eventLinks.length === 1
                        ? compactExpenseEventLabel(expense.eventLinks[0])
                        : `Associada a ${expense.eventLinks.length} eventos`}
                    </span>
                  ) : null}
                </div>

                {expense.notes ? <p className="mt-2 text-sm text-muted-foreground">{expense.notes}</p> : null}

                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(expense)}>
                    <Edit className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(expense)}>
                    <Trash2 className="h-4 w-4" /> Anular
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ExpenseDialog
        open={creating || Boolean(editing)}
        expense={editing}
        categories={activeCategories}
        allCategories={categories}
        eventOptions={eventOptions}
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
              await updateExpense.mutateAsync({ id: editing.id, data });
            } else {
              await createExpense.mutateAsync({ data });
            }
            await refresh();
            setCreating(false);
            setEditing(null);
            toast({ title: editing ? "Despesa atualizada" : "Despesa registada" });
          } catch {
            toast({ title: "Não foi possível guardar a despesa", variant: "destructive" });
          }
        }}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anular despesa?</DialogTitle>
            <DialogDescription>
              A despesa deixa de entrar nos Relatórios, mas permanece auditável como registo anulado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteExpense.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteExpense.mutateAsync({ id: deleteTarget.id });
                  await refresh();
                  setDeleteTarget(null);
                  toast({ title: "Despesa anulada" });
                } catch {
                  toast({ title: "Não foi possível anular a despesa", variant: "destructive" });
                }
              }}
            >
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <Card className="border-border/70">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
          <p className="mt-1 text-sm font-bold sm:text-lg">{euro(value)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "min-h-16 rounded-xl border bg-card p-3 text-left text-card-foreground shadow transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active ? "border-primary bg-primary/5 ring-1 ring-primary/25" : "border-border/70 hover:bg-muted/30",
      ].join(" ")}
    >
      <p className={active
        ? "text-[11px] font-medium text-primary sm:text-xs"
        : "text-[11px] text-muted-foreground sm:text-xs"}
      >
        {label}
      </p>
      <p className="mt-1 text-sm font-bold sm:text-lg">{euro(value)}</p>
    </button>
  );
}

function ExpenseDialog({
  open,
  expense,
  categories,
  allCategories,
  eventOptions,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  expense: Expense | null;
  categories: Array<{ id: string; name: string }>;
  allCategories: Array<{ id: string; name: string }>;
  eventOptions: ExpenseEventOption[];
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateExpenseBody) => Promise<void>;
}) {
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(expense ? {
      expenseDate: expense.expenseDate,
      description: expense.description,
      amount: String(expense.amount),
      categoryId: expense.categoryId,
      expenseType: expense.expenseType,
      supplier: expense.supplier ?? "",
      notes: expense.notes ?? "",
      eventLinks: expense.eventLinks.map(({ eventType, eventId }) => ({ eventType, eventId })),
    } : emptyForm());
  }, [expense, open]);

  const initialize = (nextOpen: boolean) => {
    if (nextOpen) {
      setForm(expense ? {
        expenseDate: expense.expenseDate,
        description: expense.description,
        amount: String(expense.amount),
        categoryId: expense.categoryId,
        expenseType: expense.expenseType,
        supplier: expense.supplier ?? "",
        notes: expense.notes ?? "",
        eventLinks: expense.eventLinks.map(({ eventType, eventId }) => ({ eventType, eventId })),
      } : emptyForm());
    }
    onOpenChange(nextOpen);
  };

  const selectableCategories = expense && !categories.some((category) => category.id === expense.categoryId)
    ? [...categories, ...allCategories.filter((category) => category.id === expense.categoryId)]
    : categories;
  const selectedCategory = selectableCategories.find((category) => category.id === form.categoryId);
  const personnelCategorySelected = selectedCategory?.name === PERSONNEL_EXPENSE_CATEGORY_NAME;

  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Adicionar despesa"}</DialogTitle>
          <DialogDescription>Registe a saída real. Associar a eventos é opcional.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = parseMoneyInput(form.amount);
            if (!form.expenseDate || !form.description.trim() || !form.categoryId || amount <= 0) {
              toast({ title: "Preencha data, descrição, valor e categoria", variant: "destructive" });
              return;
            }
            void onSave({
              expenseDate: form.expenseDate,
              description: form.description.trim(),
              amount,
              categoryId: form.categoryId,
              expenseType: form.expenseType,
              supplier: form.supplier.trim() || null,
              notes: form.notes.trim() || null,
              eventLinks: form.eventLinks,
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" value={form.expenseDate} onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            </Field>
            <Field label="Valor">
              <MoneyInput value={form.amount} onValueChange={(amount) => setForm((current) => ({ ...current, amount }))} />
            </Field>
          </div>

          <Field label="Descrição">
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: Continente" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria">
              <Select
                value={form.categoryId}
                onValueChange={(value) => {
                  const category = selectableCategories.find((item) => item.id === value);
                  setForm((current) => ({
                    ...current,
                    categoryId: value,
                    expenseType: category?.name === PERSONNEL_EXPENSE_CATEGORY_NAME ? "operational" : current.expenseType,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Escolher categoria" /></SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tipo">
              <Select
                value={form.expenseType}
                disabled={personnelCategorySelected}
                onValueChange={(value) => setForm((current) => ({ ...current, expenseType: value as ExpenseType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Despesa operacional</SelectItem>
                  <SelectItem value="investment">Investimento / Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {personnelCategorySelected ? (
            <p className="text-xs text-muted-foreground">
              Pessoal / Colaboradores é sempre registado como despesa operacional.
            </p>
          ) : null}

          <Field label="Fornecedor / Loja">
            <Input value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} placeholder="Opcional" />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Associar a eventos</Label>
              <span className="text-xs text-muted-foreground">Opcional</span>
            </div>
            <ExpenseEventMultiSelect
              options={eventOptions}
              selected={form.eventLinks}
              onChange={(eventLinks) => setForm((current) => ({ ...current, eventLinks }))}
            />
          </div>

          <Field label="Notas">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Opcional" />
          </Field>

          <p className="text-xs text-muted-foreground">
            Comprovativo: ficará como melhoria posterior; os anexos atuais são específicos de eventos/imagens e não serão duplicados aqui.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? "A guardar..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeEventSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .trim();
}

function formatEventDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-PT");
}

function compactExpenseEventLabel(link: ExpenseEventLink) {
  const type = link.eventType === "venue_event" ? "Festa" : "Serviço";
  const name = link.birthdayChildName || link.customerName;
  return `${type} · ${name} · ${formatEventDate(link.eventDate)}`;
}

function eventOptionKey(option: Pick<ExpenseEventOption, "eventType" | "eventId">) {
  return `${option.eventType}:${option.eventId}`;
}

function ExpenseEventMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: ExpenseEventOption[];
  selected: ExpenseEventLinkInput[];
  onChange: (links: ExpenseEventLinkInput[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedKeys = new Set(selected.map(eventOptionKey));
  const normalizedSearch = normalizeEventSearch(search);
  const filteredOptions = options.filter((option) => {
    if (!normalizedSearch) return true;
    const haystack = normalizeEventSearch([
      option.typeLabel,
      option.eventDate,
      formatEventDate(option.eventDate),
      option.customerName,
      option.birthdayChildName ?? "",
    ].join(" "));
    return haystack.includes(normalizedSearch);
  });
  const selectedOptions = selected
    .map((link) => options.find((option) => eventOptionKey(option) === eventOptionKey(link)))
    .filter((option): option is ExpenseEventOption => Boolean(option));

  const toggle = (option: ExpenseEventOption) => {
    const key = eventOptionKey(option);
    onChange(
      selectedKeys.has(key)
        ? selected.filter((link) => eventOptionKey(link) !== key)
        : [...selected, { eventType: option.eventType, eventId: option.eventId }],
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Associar a eventos"
            aria-expanded={open}
            className="min-h-11 w-full justify-between font-normal"
          >
            <span className={selected.length ? "" : "text-muted-foreground"}>
              {selected.length === 0
                ? "Selecionar eventos"
                : selected.length === 1
                  ? "1 evento selecionado"
                  : `${selected.length} eventos selecionados`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-24px)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Pesquisar festa ou serviço…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-[55dvh] sm:max-h-[300px]">
              <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const key = eventOptionKey(option);
                  const isSelected = selectedKeys.has(key);
                  return (
                    <CommandItem
                      key={key}
                      value={key}
                      onSelect={() => toggle(option)}
                      className="items-start py-2"
                    >
                      <Check className={`mt-0.5 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {option.typeLabel} · {formatEventDate(option.eventDate)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {option.displayName}
                          {option.birthdayChildName && option.customerName !== option.birthdayChildName
                            ? ` · Cliente: ${option.customerName}`
                            : ""}
                        </p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => {
            const key = eventOptionKey(option);
            return (
              <span
                key={key}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
              >
                <span className="truncate">
                  {option.typeLabel === "Serviço Externo" ? "Serviço" : "Festa"} · {option.displayName} · {formatEventDate(option.eventDate)}
                </span>
                <button
                  type="button"
                  aria-label={`Remover ${option.displayName}`}
                  className="rounded-full p-0.5 hover:bg-primary/10"
                  onClick={() => onChange(selected.filter((link) => eventOptionKey(link) !== key))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
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
