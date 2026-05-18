import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, CheckCircle2, Circle, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetTasksSummaryQueryKey,
} from "@workspace/api-client-react";
import type { Reservation, Task } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function ChecklistModal({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: tasks, isLoading } = useListTasks(reservation.id, {
    query: { enabled: open } as any,
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(reservation.id) });
    queryClient.invalidateQueries({ queryKey: getGetTasksSummaryQueryKey() });
  };

  const handleToggle = (task: Task) => {
    updateTask.mutate(
      { taskId: task.id, data: { completed: !task.completed } },
      {
        onSuccess: () => {
          invalidate();
        },
      }
    );
  };

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    createTask.mutate(
      { id: reservation.id, data: { title } },
      {
        onSuccess: () => {
          setNewTitle("");
          invalidate();
          toast({ title: "Tarefa adicionada" });
        },
      }
    );
  };

  const handleDelete = (task: Task) => {
    deleteTask.mutate(
      { taskId: task.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Tarefa removida" });
        },
      }
    );
  };

  const sortedTasks = tasks
    ? [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      })
    : [];

  const total = sortedTasks.length;
  const completed = sortedTasks.filter((t) => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 gap-0",
          isMobile
            ? "max-w-full h-[100vh] sm:h-auto rounded-none sm:rounded-lg"
            : "max-w-lg"
        )}
      >
        <DialogHeader className="p-5 border-b border-border bg-card sticky top-0 z-10">
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Checklist
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {reservation.customerName} · {reservation.eventDate}
          </p>

          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium">
                {completed}/{total} tarefas concluídas
              </span>
              <span className={cn(
                "font-bold",
                percent === 100 ? "text-emerald-600" : "text-primary"
              )}>
                {percent}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all duration-500 ease-out",
                  percent === 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </DialogHeader>

        <div className={cn(
          "overflow-y-auto px-5 py-4 space-y-2",
          isMobile ? "flex-1" : "max-h-[50vh]"
        )}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ListChecks className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p>Nenhuma tarefa ainda.</p>
              <p className="text-xs mt-1">Adicione a primeira tarefa abaixo.</p>
            </div>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => handleToggle(task)}
                onDelete={() => handleDelete(task)}
                isMutating={updateTask.isPending || deleteTask.isPending}
              />
            ))
          )}
        </div>

        <div className="p-4 border-t border-border bg-card sticky bottom-0">
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar tarefa..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="min-h-[44px] rounded-xl"
              disabled={createTask.isPending}
            />
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!newTitle.trim() || createTask.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl min-h-[44px] gap-1.5 px-4"
            >
              {createTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Adicionar</span>
            </Button>
          </div>
          {isMobile && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full mt-3 rounded-xl min-h-[44px]"
            >
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  isMutating,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  isMutating: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
        task.completed
          ? "bg-emerald-50/60 border-emerald-200"
          : "bg-card border-border hover:border-primary/40 hover:bg-muted/30"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={isMutating}
        className="flex-shrink-0 transition-transform active:scale-90"
        aria-label={task.completed ? "Desmarcar tarefa" : "Marcar tarefa concluída"}
      >
        {task.completed ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600 transition-all" />
        ) : (
          <Circle className="h-6 w-6 text-muted-foreground/60 hover:text-primary transition-colors" />
        )}
      </button>

      <span
        className={cn(
          "flex-1 text-sm transition-all duration-200",
          task.completed
            ? "line-through text-muted-foreground/70"
            : "text-foreground"
        )}
      >
        {task.title}
      </span>

      <button
        type="button"
        onClick={onDelete}
        disabled={isMutating}
        className="flex-shrink-0 p-2 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 focus-visible:text-destructive focus-visible:bg-destructive/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
        aria-label="Eliminar tarefa"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
