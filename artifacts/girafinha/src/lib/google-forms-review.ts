export function canConfirmReview(review: { venueEventId: string | null }): boolean {
  return Boolean(review.venueEventId);
}

export function matchingReviewEvents<
  T extends { eventDate: string; phone: string },
>(fields: { eventDate?: string; phone?: string }, events: T[]): T[] {
  const phone = (value: string) => value.replace(/\D/g, "").replace(/^351/, "");
  const rawDate = fields.eventDate ?? "";
  const ptDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rawDate);
  const date = ptDate ? `${ptDate[3]}-${ptDate[2]}-${ptDate[1]}` : rawDate;
  if (
    !/^\d{4}-\d\d-\d\d$/.test(date) ||
    !/^9\d{8}$/.test(phone(fields.phone ?? ""))
  )
    return [];
  return events.filter(
    (event) =>
      event.eventDate === date &&
      phone(event.phone) === phone(fields.phone ?? ""),
  );
}
