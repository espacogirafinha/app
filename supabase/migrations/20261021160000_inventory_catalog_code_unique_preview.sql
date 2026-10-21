-- PREVIEW-ONLY: catalogue code uniqueness for material/decor items.
-- Commit is a proposal; this migration has NOT been applied to Production.
-- Legacy inventory rows without a Girafinha prefix remain unaffected.
-- The importer uses: ON CONFLICT DO NOTHING; only inserted items get initial movements.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_catalog_code_unique_idx
ON public.inventory_items
  ((substring(name FROM '^([A-Z]{1,4}[0-9]{2}(-[A-Z0-9]+)?)\\s*·\\s*')))
WHERE item_type='material'
  AND name ~ '^[A-Z]{1,4}[0-9]{2}(-[A-Z0-9]+)?\\s*·\\s*';

COMMENT ON INDEX public.inventory_items_catalog_code_unique_idx IS
  'Unique Girafinha material catalogue prefix (e.g. P01 · Arqueado); prevents duplicate imports while preserving legacy names.';
