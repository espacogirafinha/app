import { useState } from "react";
import { ListChecks, AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChecklistModal } from "./checklist-modal";
import { useGetTasksSummary } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import type { Reservation, TaskSummary } from "@workspace/api-client-react";

export function useReservationTaskSummaries(reservationIds: number[]): Map<number, TaskSummary> {
  const idsKey = reservationIds.length > 0 ? reservationIds.join(",") : "";
  const { data } = useGetTasksSummary(
    { reservationIds: idsKey },
    { query: { enabled: reservationIds.length > 0 } as any }
  );

  const map = new Map<number, TaskSummary>();
  if (data) {
    for (const summary of data) {
      map.set(summary.reservationId, summary);
    }
  }
  return map;
}

export function ChecklistButton({
  reservation,
  summary,
  variant = "default",
  showAlert = true,
}: {
  reservation: Reservation;
  summary?: TaskSummary;
  variant?: "default" | "compact" | "icon";
  showAlert?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const total = summary?.total ?? 0;
  const completed = summary?.completed ?? 0;
  const allDone = total > 0 && completed === total;

  const daysUntil = differenceInDays(parseISO(reservation.eventDate), new Date());
  const isUrgentIncomplete =
    showAlert && daysUntil <= 2 && daysUntil >= 0 && total > 0 && completed < total;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "rounded-xl min-h-[44px] gap-1.5 font-medium",
          isUrgentIncomplete && "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100",
          allDone && !isUrgentIncomplete && "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        )}
      >
        {isUrgentIncomplete ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <ListChecks className="h-4 w-4" />
        )}
        {variant === "icon" ? null : variant === "compact" ? (
          <span>{total > 0 ? `${completed}/${total}` : "Tarefas"}</span>
        ) : (
          <span>
            {total > 0 ? `Tarefas ${completed}/${total}` : "Tarefas"}
          </span>
        )}
      </Button>

      <ChecklistModal
        reservation={reservation}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

export function ChecklistProgressBar({ summary }: { summary?: TaskSummary }) {
  const total = summary?.total ?? 0;
  const completed = summary?.completed ?? 0;
  if (total === 0) return null;

  const percent = Math.round((completed / total) * 100);
  const allDone = percent === 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{completed}/{total} tarefas</span>
        <span className={cn("font-medium", allDone ? "text-emerald-600" : "text-muted-foreground")}>
          {percent}%
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all duration-500 ease-out",
            allDone ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
