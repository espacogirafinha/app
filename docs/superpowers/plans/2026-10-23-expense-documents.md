# Expense documents implementation plan

Goal: private, reusable receipts attached to existing expenses, without financial mutations.
Architecture: document metadata + many-to-many expense links; dedicated private Storage bucket. Reuse `/api/expenses?documentAction=...` through the existing physical adapter. Direct browser upload avoids Vercel request-body limits. Server validates bytes, MIME, size and SHA-256 before publishing the attachment.

- [ ] Add validation tests (types, signatures, 10 MB boundary, content hash).
- [ ] Add reversible migration: documents, links, RLS and private bucket. No financial DML; no remote migration.
- [ ] Add document API with role authorization, deduplication, atomic linking/unlinking and tracked cleanup retries. Keep tombstones for deleted uploads to prevent late-upload orphans.
- [ ] Add responsive Comprovativos section, camera input, reusable document picker, private previews/downloads, association removal and list counts.
- [ ] Verify full lifecycle and unchanged financial rows against isolated PostgreSQL; test authorization, failures and concurrent operations.
- [ ] Run desktop/mobile UI tests, existing regression tests, typecheck and build. Capture UI evidence.
- [ ] Publish separate draft PR and verify real Preview routing and READY status. Report unavailable checks honestly; never modify Production data or schema.

Review focus: upload failure/retry, simultaneous identical files, last-link removal/storage errors, unauthorized signed-in users, preview without the pending migration. No changes to event images, payments, totals, reports, or event associations.
