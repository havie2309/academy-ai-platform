# CHECK-2026-07-09 — RAG Overhaul & Production‑Ready Demo Fixes

## Date
- 2026-07-09

## Related component
- Sample document generation (`generate_sample_docs.py`)
- Postgres SQL schema and views
- Guardrail / Safe refusal (`admin-config`, `pipeline.py`, `safe_refusal.py`)
- RAG retrieval & rerank (`retrieval.py`, `rerank.py`, `config.py`)
- Router & intent classification (`router.py`, `main.py`)
- Web UI (citation display)
- Dev tooling (`rag-cli.py`, `start-dev.ps1`, `stop-dev.ps1`)

## Related docs/code files
- `infra/mongodb/seed/generate_sample_docs.py`
- `infra/postgres/init/02-iam.sql`
- `infra/postgres/init/16-text-to-sql-views.sql`
- `infra/postgres/init/18-security-services.sql`
- `services/platform/apps/admin-config/src/admin-config.service.ts`
- `services/platform/src/common/audit-log.ts`
- `services/platform/src/common/security-alerts.service.ts`
- `services/rag-engine/app/config.py`
- `services/rag-engine/app/retrieval.py`
- `services/rag-engine/app/router.py`
- `services/rag-engine/app/sql_catalog.py`
- `services/rag-engine/app/sql_generate.py`
- `services/rag-engine/main.py`
- `services/web-ui/src/api/chat.ts`
- `services/web-ui/src/components/CitationList.tsx`
- `services/web-ui/src/pages/ChatPage.tsx`
- `rag-cli.py` (new)
- `scripts/start-dev.ps1`
- `scripts/stop-dev.ps1`

## Context

The PM2 RAG engine was failing critical demo queries:
- Academic queries retrieved adversarial answer keys instead of textbooks.
- The guardrail blocked benign queries (e.g., "Cách chống gian lận") and allowed some harmful ones.
- SQL aggregation by class returned errors because `v_diem_mon` lacked `ma_lop`.
- DML commands (DELETE/UPDATE) were routed to RAG instead of being properly rejected.
- Local development was painful due to `EADDRINUSE` port conflicts.

The goal was to deliver a **single cohesive PR** that fixes all these issues, aligns with production‑ready principles, and improves the developer experience.

## Initial AI proposal

- Fix the SQL view by adding `ma_lop`.
- Change the default guardrail from keyword to semantic (threshold 0.88).
- Add a flat security boost to internal/restricted documents.
- Route DML to `reject` with a generic message.
- Create a batch version of `rag-cli.py` for integration testing.
- Update `stop-dev.ps1` to kill processes by port.

## Problems in the initial proposal

- **Adversarial documents**: The initial idea was to keep them random, but the demo needed **topic‑aligned triples** (2 normal + 1 adversarial per topic) to show authority selection. Without grouped topics, the adversarial document was often unrelated to the query, making the test meaningless.
- **`isAdversarial` flag**: Initially proposed relying on the `isAdversarial` flag to filter out conflicting docs. This was correctly rejected – in production, there is no such flag; the system must infer trust from content and metadata (source, security level).
- **Category filter in Milvus**: We tried to apply a category filter in Milvus using `metadata['category']`. This failed because Milvus does not have a `metadata` field; the category is stored in MongoDB, not Milvus. The correct fix was a **post‑retrieval filter**, not a push‑down filter.
- **Semantic negation**: Initially wanted to add negation detection in `match_semantic` (keyword‑based). The user pointed out that this is a hack; it should be handled by the heuristic policy judge with proper intent detection.
- **DML rejection**: Initially routed DML to the generic `reject` route, which returned a vague "not found" message. The user required a specific `dml_denied` route with a clear, actionable refusal message.
- **Dev scripts**: The initial stop script was incomplete. It didn't kill processes by port, leading to `EADDRINUSE` errors. The fix required a more robust port‑based kill approach.

## Final agreed direction

1. **Sample documents**: Generate topic‑aligned triples (2 normal + 1 adversarial per topic) with proper metadata (`securityLevel='internal'` for normal, `'public'` for adversarial; `sourceSystem='official'` vs `'manual_upload'`).
2. **Guardrail**: Default to **semantic** (threshold 0.88) + absolute keyword fallback (e.g., `"mật khẩu hệ thống"`).
3. **SQL**: Updated `v_diem_mon` view to include `ma_lop`; updated SQL catalog with few‑shot examples for class‑average queries using `LIKE` semester filtering.
4. **Retrieval**: Added security boost (internal docs get +1.0, restricted docs get +2.0, confidential docs get +3.0).
5. **DML**: Added dedicated `dml_denied` route with a clear refusal message, separate from the generic `reject`.
6. **UI**: Admin users see normalized rerank scores in citation cards, sorted by score.
7. **Dev tooling**:
   - `rag-cli.py` – lightweight interactive CLI tester that shows rerank scores, vector scores, security levels, and chunk IDs.
   - `start-dev.ps1` – starts Ollama through the logging runner (`run-with-log.ps1`).
   - `stop-dev.ps1` – kills processes by port (including the gateway and Vite) to eliminate `EADDRINUSE` errors.
8. **Audit/security**: Normalized `'anonymous'` user ID to `null` in `audit_log` and `security_alerts` to avoid FK violations.

## Rationale

- **Production realism**: Removing the `isAdversarial` flag and relying on metadata (security level, source system) forces the system to choose the authoritative source based on content and trust signals – exactly as it would in the real world.
- **Usability**: Dedicated DML rejection and semantic guardrail improve user experience and safety.
- **Developer experience**: The new CLI and robust stop script make local development much smoother, reducing friction and time wasted on port conflicts.
- **Demo readiness**: The grouped adversarial documents allow a clear, repeatable demonstration of authority selection, which is a key acceptance criterion.

## Impact

- **Code changes**: Over 20 files modified or added, touching the full stack (backend, frontend, infrastructure, scripts).
- **Breaking changes**: None. The new `dml_denied` route is additive; the default guardrail policy is updated for new installations (existing `admin_configs` rows are not overwritten).
- **Migration**: The `login_logs` constraint needs updating; `policy_events` gains a `reason` column (no migration required for existing rows).

## Follow-up tasks

1. Run the updated `generate_sample_docs.py` to regenerate the sample corpus.
2. Re‑ingest all documents (drop MongoDB and Milvus collections) to reflect the new metadata.
3. Test the demo queries manually (or with `rag-cli.py`).
4. Build a systematic evaluation harness (as discussed) to track regression.

## Lesson for future AI/code assistant runs

- **Always question your assumptions**: Never assume a test flag (`isAdversarial`) will exist in production. Always design for the real world.
- **Listen to the user's context**: When the user says "my rag engine is not a docker service", that's a signal to stop suggesting Docker‑centric debugging and switch to local process debugging.
- **Iterate on feedback early**: The user corrected the direction on adversarial documents, guardrail negation, and DML routing multiple times. Capturing this in `Check-tren` prevents repeating the same missteps in future sessions.
- **Prioritise developer experience**: The `EADDRINUSE` fix and `rag-cli.py` were direct responses to pain points the user voiced. These are often as important as the core algorithm changes.