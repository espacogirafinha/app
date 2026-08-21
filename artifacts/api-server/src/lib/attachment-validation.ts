export const EVENT_ATTACHMENT_LIMIT = 10;
export const EVENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EVENT_ATTACHMENT_BUCKET = "event-images";
export const EVENT_ATTACHMENT_ENTITY_TYPES = [
  "venue_event",
  "external_event",
] as const;

export type EventAttachmentEntityType =
  (typeof EVENT_ATTACHMENT_ENTITY_TYPES)[number];

export function isEventAttachmentEntityType(
  value: string,
): value is EventAttachmentEntityType {
  return EVENT_ATTACHMENT_ENTITY_TYPES.includes(
    value as EventAttachmentEntityType,
  );
}

export function isValidEventAttachmentPath(
  entityType: EventAttachmentEntityType,
  entityId: string,
  storagePath: string,
) {
  return (
    storagePath.startsWith(`${entityType}/${entityId}/`) &&
    !storagePath.includes("..")
  );
}

export function isImageMimeType(mimeType: string) {
  return mimeType.startsWith("image/");
}
