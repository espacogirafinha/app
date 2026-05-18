import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

type MessageType = "reservation" | "depositRequest" | "depositConfirmation" | "postEvent";

interface WhatsAppButtonProps {
  phone: string;
  customerName: string;
  eventDate: string;
  eventTime: string;
  pack?: string;
  serviceType?: string;
  extras?: string | null;
  totalPrice?: number;
  amountPaid?: number;
  remainingBalance?: number;
  variant?: "default" | "reminder";
  messageType?: MessageType;
  label?: string;
  onSent?: (messageType: MessageType) => void;
  className?: string;
}

function serviceLabel(serviceType?: string) {
  if (serviceType === "Workshops") return "workshop";
  if (serviceType === "Serviços externos") return "serviço";
  return "festa";
}

function buildSummary({
  pack,
  extras,
  totalPrice,
  amountPaid,
  remainingBalance,
}: Pick<WhatsAppButtonProps, "pack" | "extras" | "totalPrice" | "amountPaid" | "remainingBalance">) {
  const lines: string[] = [];
  if (pack) lines.push(`Serviço: ${pack}`);
  if (extras) lines.push(`Extras: ${extras}`);
  if (totalPrice !== undefined) lines.push(`Total: ${totalPrice.toFixed(2)} €`);
  if (amountPaid !== undefined && amountPaid > 0) lines.push(`Valor pago: ${amountPaid.toFixed(2)} €`);
  if (remainingBalance !== undefined && remainingBalance > 0) lines.push(`Valor em aberto: ${remainingBalance.toFixed(2)} €`);
  return lines.length ? `\n\nResumo:\n${lines.join("\n")}` : "";
}

function buildWhatsAppMessage({
  customerName,
  eventLabel,
  eventDate,
  eventTime,
  summary,
  remainingBalance,
  messageType,
  variant,
}: {
  customerName: string;
  eventLabel: string;
  eventDate: string;
  eventTime: string;
  summary: string;
  remainingBalance?: number;
  messageType: MessageType;
  variant: NonNullable<WhatsAppButtonProps["variant"]>;
}) {
  if (messageType === "depositRequest") {
    return `Olá ${customerName}! Para confirmar a sua reserva no Espaço Girafinha para dia ${eventDate} às ${eventTime}, pedimos o pagamento do sinal.${summary}\n\nDepois envie-nos o comprovativo por aqui. Obrigado!`;
  }

  if (messageType === "depositConfirmation") {
    return `Olá ${customerName}! Confirmamos a receção do sinal. A sua reserva no Espaço Girafinha para dia ${eventDate} às ${eventTime} fica confirmada.${summary}\n\nObrigado!`;
  }

  if (messageType === "postEvent") {
    return `Olá ${customerName}! Esperamos que tenham gostado da festa no Espaço Girafinha. Muito obrigado pela confiança!\n\nSe quiserem, podem deixar-nos o vosso feedback ou identificar-nos nas fotos. Até breve!`;
  }

  if (variant === "reminder" && remainingBalance && remainingBalance > 0) {
    return `Olá ${customerName}! Esperamos que esteja tudo bem. Gostaríamos de lembrar que o seu ${eventLabel} no Espaço Girafinha está marcado para dia ${eventDate} às ${eventTime}.${summary}\n\nObrigado!`;
  }

  return `Olá ${customerName}! O seu ${eventLabel} no Espaço Girafinha está confirmado para dia ${eventDate} às ${eventTime}.${summary}\n\nObrigado!`;
}

export function WhatsAppButton({
  phone,
  customerName,
  eventDate,
  eventTime,
  pack,
  serviceType,
  extras,
  totalPrice,
  amountPaid,
  remainingBalance,
  variant = "default",
  messageType = "reservation",
  label,
  onSent,
  className,
}: WhatsAppButtonProps) {
  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/\D/g, "");
    const eventLabel = serviceLabel(serviceType);
    const summary = buildSummary({ pack, extras, totalPrice, amountPaid, remainingBalance });
    const message = buildWhatsAppMessage({
      customerName,
      eventLabel,
      eventDate,
      eventTime,
      summary,
      remainingBalance,
      messageType,
      variant,
    });

    const url = `https://wa.me/351${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    onSent?.(messageType);
  };

  if (variant === "reminder") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleWhatsAppClick}
        className={`text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200 min-h-[44px] gap-1.5 rounded-xl ${className || ""}`}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">{label ?? "Lembrete"}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleWhatsAppClick}
      className={`text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 min-h-[44px] gap-1.5 rounded-xl ${className || ""}`}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">{label ?? "WhatsApp"}</span>
    </Button>
  );
}
