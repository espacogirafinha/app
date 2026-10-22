-- PREVIEW-ONLY: unique catalogue prefix for reusable Girafinha materials.
-- Not applied to production. Only material names with code prefixes are indexed.
-- Existing articles without code prefixes remain unaffected.
--
-- Example: P01 · Painel, D38-A · Silhueta.
-- This index is the database-level idempotency guarantee for importer retries.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_catalog_code_unique_idx
ON public.inventory_items
  ((substring(name FROM '^([A-Z]{1,4}[0-9]{2}(-[A-Z0-9]+)?)[[:space:]]*·[[:space:]]*')))
WHERE item_type='material'
  AND name ~ '^[A-Z]{1,4}[0-9]{2}(-[A-Z0-9]+)?[[:space:]]*·[[:space:]]*';

COMMENT ON INDEX public.inventory_items_catalog_code_unique_idx IS
  'Unique catalogue material prefix; protects repeated Girafinha decoration imports.';
