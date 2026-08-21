export const EVENT_IMAGE_LIMIT = 10;
export const EVENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const EVENT_IMAGE_BUCKET = "event-images";

export type PendingEventImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export function validateEventImageFiles(files: File[], availableSlots: number) {
  const accepted: File[] = [];
  const rejected: Array<{ file: File; reason: string }> = [];

  for (const file of files) {
    if (accepted.length >= availableSlots) {
      rejected.push({
        file,
        reason: `Máximo de ${EVENT_IMAGE_LIMIT} imagens por evento.`,
      });
    } else if (!file.type.startsWith("image/")) {
      rejected.push({ file, reason: "O ficheiro não é uma imagem suportada." });
    } else if (file.size > EVENT_IMAGE_MAX_BYTES) {
      rejected.push({ file, reason: "A imagem excede 10 MB." });
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}

export function eventImageStoragePath(
  entityType: string,
  entityId: string,
  file: File,
) {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  return `${entityType}/${entityId}/${crypto.randomUUID()}.${extension}`;
}
