export const INVENTORY_IMAGE_BUCKET = "inventory-images";
export const INVENTORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const INVENTORY_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateInventoryImage(file: File) {
  if (!INVENTORY_IMAGE_MIME_TYPES.includes(file.type as (typeof INVENTORY_IMAGE_MIME_TYPES)[number])) {
    return "Use uma imagem JPEG, PNG ou WebP.";
  }
  if (file.size > INVENTORY_IMAGE_MAX_BYTES) {
    return "A imagem excede 5 MB.";
  }
  return null;
}

export function inventoryImageStoragePath(itemId: string, file: File) {
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `material/${itemId}/${crypto.randomUUID()}.${extension}`;
}
