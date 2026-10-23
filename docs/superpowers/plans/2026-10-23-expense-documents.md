# Expense documents implementation plan

Goal: private, reusable receipts attached to existing expenses, without financial mutations.
Architecture: document metadata + many-to-many expense links; dedicated private Storage bucket. Reuse `/api/expenses?documentAction=...` through the existing physical adapter. Direct browser upload avoids Vercel request-body limits. Server validates bytes, MIME, size and SHA-256 before publishing the attachment.

- [x] Add validation tests (types, signatures, 10 MB boundary, content hash).
- [x] Add reversible migration: documents, links, RLS and private bucket. No financial DML; no remote migration.
- [x] Add document API with role authorization, deduplication, atomic linking/unlinking and tracked cleanup retries. Keep tombstones for deleted uploads to prevent late-upload orphans.
- [x] Add responsive Comprovativos section, camera input, reusable document picker, private previews/downloads, association removal and list counts.
- [x] Verify full lifecycle and unchanged financial rows against isolated PostgreSQL; test authorization, failures and concurrent operations.
- [x] Run desktop/mobile UI tests, existing regression tests, typecheck and build. Capture UI evidence.
- [x] Publish separate draft PR and verify real Preview routing and READY status. Report unavailable checks honestly; never modify Production data or schema.

Review focus: upload failure/retry, simultaneous identical files, last-link removal/storage errors, unauthorized signed-in users, preview without the pending migration. No changes to event images, payments, totals, reports, or event associations.

Open gate: persistent end-to-end use in the Vercel Preview needs an isolated Supabase environment; no Production migration is authorized. Real Storage validation uses disposable Supabase in CI.
