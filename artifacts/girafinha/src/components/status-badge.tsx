import { Badge } from "@/components/ui/badge";

type Status = "paid" | "partial" | "unpaid";

export function StatusBadge({ status, size = "default" }: { status: Status; size?: "default" | "lg" }) {
  const sizeClasses = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";

  if (status === "paid") {
    return (
      <Badge className={`bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none rounded-full font-semibold ${sizeClasses}`}>
        Pago
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className={`bg-amber-100 text-amber-800 hover:bg-amber-200 border-none rounded-full font-semibold ${sizeClasses}`}>
        Sinal
      </Badge>
    );
  }
  return (
    <Badge className={`bg-rose-100 text-rose-800 hover:bg-rose-200 border-none rounded-full font-semibold ${sizeClasses}`}>
      Pendente
    </Badge>
  );
}

export function PaymentSummary({ totalPrice, amountPaid, remainingBalance, compact = false }: {
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="space-y-0.5 text-sm">
        <div className="font-semibold">€{totalPrice.toFixed(2)}</div>
        {remainingBalance > 0 ? (
          <>
            <div className="text-emerald-600 text-xs">Pago: €{amountPaid.toFixed(2)}</div>
            <div className="text-rose-600 text-xs font-medium">Falta: €{remainingBalance.toFixed(2)}</div>
          </>
        ) : (
          <div className="text-emerald-600 text-xs">Totalmente pago</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <span className="font-semibold">€{totalPrice.toFixed(2)} total</span>
      <span className="text-emerald-600">Pago: €{amountPaid.toFixed(2)}</span>
      {remainingBalance > 0 && (
        <span className="text-rose-600 font-medium">Falta: €{remainingBalance.toFixed(2)}</span>
      )}
    </div>
  );
}
