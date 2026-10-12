export type GoogleFormNotificationInput = {
  importId: string;
  status: "created" | "already_exists" | "needs_review";
  venueEventId?: string;
  eventDate?: string | null;
  packName?: string | null;
};

export function buildGoogleFormNotification(input: GoogleFormNotificationInput) {
  const hasEvent = Boolean(input.venueEventId);
  const needsReview = input.status !== "created";
  const title = hasEvent
    ? needsReview
      ? "Nova reserva — precisa de revisão"
      : "Nova reserva recebida"
    : "Novo pedido precisa de revisão";
  const message = hasEvent
    ? formatEventSummary(input.eventDate, input.packName)
    : "Não foi possível criar automaticamente a Festa.";
  const destination = input.venueEventId
    ? `/venue-events?open=${encodeURIComponent(input.venueEventId)}`
    : `/google-forms-review?open=${encodeURIComponent(input.importId)}`;

  return {
    type: needsReview ? "google_form_review" : "google_form_created",
    title,
    message,
    googleFormImportId: input.importId,
    venueEventId: input.venueEventId ?? null,
    destination,
    sourceKey: `google_forms:${input.importId}:initial`,
  };
}

function formatEventSummary(eventDate?: string | null, packName?: string | null) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(eventDate ?? "")
    ? `${eventDate!.slice(8, 10)}/${eventDate!.slice(5, 7)}/${eventDate!.slice(0, 4)}`
    : "Data por confirmar";
  return packName ? `${date} · Pack ${packName}` : date;
}
