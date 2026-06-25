# CHECK-2026-06-25-demo2-feedback-implementation

## Date
- 2026-06-25

## Related component
- Access Token Management (frontend memory, multi-node deployment)
- RAG Engine (access scope filter)
- AI Policy (safe refusal)
- Admin Dashboard (UI, monitoring, logs)
- Password Hashing
- Document Processing (chunking)
- Chat/RAG Priority

## Related docs/code files
- `docs/B_Architecture/B7_Sequence_Diagrams.md`
- `docs/C_UI_UX/C1_Screen_Inventory.md`
- `docs/G_Planning/G3_Decision_Memory.md`
- `docs/task list.md`

## Context
- Demo 2 was presented to supervisors on 2026-06-25.
- The team showcased: Auth pipeline, Document Ingest, RAG Engine, Text-to-SQL, Safe Refusal & AI Policy, Admin Dashboard (health, policy, audit, account ops).
- Supervisors provided 11 technical concerns and requirements for improvement.

## Initial AI proposal
- The AI assistant initially proposed addressing all feedback with specific implementation solutions, and correctly interpreted the audit log concern as needing admin monitoring capabilities (not training concerns).

## Problems identified by supervisors
1. **Access Token Storage:** Current localStorage/memory storage works on 1 node but may cause issues when scaling to 2 nodes.
2. **Access Token Theft:** Risk of XSS stealing access_token from UI.
3. **RAG Scope Filter:** Diagram did not show access scope filter layer in retrieval.
4. **AI Policy:** Keyword-based blacklist is insufficient; needs semantic/context-based blocking.
5. **Audit Log:** Admin cannot monitor other users' chat sessions/queries.
6. **Password Hashing:** SHA-256 + salt is outdated; need modern method (Argon2id).
7. **Token Format Validation:** No format validation before DB lookup.
8. **Admin Dashboard UX:** Overcrowded with accounts and audit logs; needs tabs and pagination.
9. **Service Logs:** Admin cannot view service logs (only dev via terminal).
10. **Admin Scope Management:** Admin cannot assign/edit document scope/security level after creation.
11. **Chunking:** Need better heading detection for DOCX (maybe convert to PDF first).
12. **RAG Priority:** No priority system for data sources (database vs documents by security level).

## Final agreed direction
- Update all diagrams to reflect actual implementation (including scope filter).
- Prioritize high-impact improvements for next demo:
  - Admin Dashboard UX improvements (tabs, pagination)
  - Admin Chat Monitoring (view user sessions)
  - Admin Scope Management (edit document scope)
  - RAG Scope Filter diagram update
  - Clarify audit log usage policy
- Research and plan for medium-term improvements:
  - Argon2id migration
  - Semantic AI Policy
  - RAG priority scoring
  - Access token validation format

## Rationale
- The scope filter was already implemented but missing from the diagram → quick fix.
- Admin features (monitoring, scope management, UX) are critical for supervisors to see in Demo 3.
- Security upgrades (Argon2id, token validation) are best practices but can be planned for the next sprint.
- Semantic policy and RAG priority are more complex and need research before implementation.

## Impact
- `B7_Sequence_Diagrams.md` updated with access scope filter layer.
- `C1_Screen_Inventory.md` updated with UI-13 (Admin Chat Monitoring).
- `task list.md` updated with N-01 to N-12 action items.
- `G3_Decision_Memory.md` updated with DEC-PM2-18 to DEC-PM2-23.
- Meeting minutes document created.

## Follow-up tasks
1. **Immediate (before Demo 3):**
   - Update RAG diagram with scope filter ✅
   - Refactor Admin Dashboard to tabbed UI
   - Add Admin Chat Monitoring
   - Implement Admin Scope Management
   - Clarify audit log policy

2. **Short-term (next sprint):**
   - Research Argon2id migration
   - Add access token format validation
   - Add service log viewer for admin

3. **Long-term (research):**
   - Semantic AI Policy
   - RAG priority scoring
   - DOCX → PDF for chunking

## Lesson for future AI/code assistant runs
- When supervisors raise concerns about missing features in diagrams, first check if the feature is actually implemented (like the scope filter in RAG). If so, the priority is updating documentation, not code.
- For security concerns (password hashing, token validation), provide research-backed recommendations and timeline estimates.
- Admin UX feedback is important and should be prioritized for the next demo to show responsiveness.
- The audit log concern was misinterpreted initially – always clarify the exact issue before proposing solutions. The real issue was lack of admin monitoring, not training data concerns.