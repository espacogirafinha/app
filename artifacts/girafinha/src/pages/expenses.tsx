import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, ReceiptText, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  useListVenueEvents,
  useUpdateExpense,
  type CreateExpenseBody,
  type Expense,
  type ExpenseType,
} from "@workspace/api-client-react";

type DateMode = "month" | "custom";

type ExpenseForm = {
  expenseDate: string;
  description: string;
  amount: string;
  categoryId: string;
  expenseType: ExpenseType;
  supplier: string;
  notes: string;
  venueEventId: string;
};

const ALL = "__all__";
const NONE = "__none__";

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

function emptyForm(): ExpenseForm {
  return {
    expenseDate: today(),
    description: "",
    amount: "",
    categoryId: "",
    expenseType: "operational",
    supplier: "",
    notes: "",
    venueEventId: "",
  };
}

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

export default function ExpensesPage() {
  const [dateMode, setDateMode] = useState<DateMode>("month");
  const [month, setMonth] = useState(currentMonth());
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
    : { startDate: customStart, endDate: customEnd };

  const params = {
    startDate: range.startDate,
    endDate: range.endDate,
    search: search.trim() || undefined,
    categoryId: categoryId === ALL ? undefined : categoryId,
    expenseType: expenseType === ALL ? undefined : expenseType,
  };

  const expensesQuery = useListExpenses(params);
  const categoriesQuery = useListExpenseCategories();
  const venueEventsQuery = useListVenueEvents();
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

  const summary = useMemo(() => {
    const operational = expenses
      .filter((expense) => expense.expenseType === "operational")
      .reduce((sum, expense) => sum + expense.amount, 0);
    const investments = expenses
      .filter((expense) => expense.expenseType === "investment")
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { operational, investments, total: operational + investments };
  }, [expenses]);

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
            <Button type="button" size="sm" variant={dateMode === "custom" ? "default" : "outline"} onClick={() => setDateMode("custom")}>Intervalo</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {dateMode === "month" ? (
              <div className="space-y-2">
                <Label>Mês e ano</Label>
                <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
        <SummaryCard label="Operacionais" value={summary.operational} />
        <SummaryCard label="Investimentos" value={summary.investments} />
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
                  {expense.venueEventLabel ? <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{expense.venueEventLabel}</span> : null}
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
        venueEvents={venueEventsQuery.data ?? []}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
        <p className="mt-1 text-sm font-bold sm:text-lg">{euro(value)}</p>
      </CardContent>
    </Card>
  );
}

function ExpenseDialog({
  open,
  expense,
  categories,
  allCategories,
  venueEvents,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  expense: Expense | null;
  categories: Array<{ id: string; name: string }>;
  allCategories: Array<{ id: string; name: string }>;
  venueEvents: Array<{ id: string; eventDate: string; customerName: string; birthdayChildName?: string | null }>;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateExpenseBody) => Promise<void>;
}) {
  const [form, setForm] = useState<ExpenseForm>(emptyForm());
  const { toast } = useToast();

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
        venueEventId: expense.venueEventId ?? "",
      } : emptyForm());
    }
    onOpenChange(nextOpen);
  };

  const selectableCategories = expense && !categories.some((category) => category.id === expense.categoryId)
    ? [...categories, ...allCategories.filter((category) => category.id === expense.categoryId)]
    : categories;

  return (
    <Dialog open={open} onOpenChange={initialize}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Adicionar despesa"}</DialogTitle>
          <DialogDescription>Registe a saída real. Associar a uma Festa é opcional.</DialogDescription>
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
              venueEventId: form.venueEventId || null,
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
              <Select value={form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}>
                <SelectTrigger><SelectValue placeholder="Escolher categoria" /></SelectTrigger>
                <SelectContent>
                  {selectableCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tipo">
              <Select value={form.expenseType} onValueChange={(value) => setForm((current) => ({ ...current, expenseType: value as ExpenseType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Despesa operacional</SelectItem>
                  <SelectItem value="investment">Investimento / Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Fornecedor / Loja">
            <Input value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} placeholder="Opcional" />
          </Field>

          <Field label="Associar a uma Festa">
            <Select
              value={form.venueEventId || NONE}
              onValueChange={(value) => setForm((current) => ({ ...current, venueEventId: value === NONE ? "" : value }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem associação</SelectItem>
                {[...venueEvents]
                  .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
                  .map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.eventDate} · {event.birthdayChildName || event.customerName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
