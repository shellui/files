# Files app UX iterations (draft PR)

## Cycle 1 — shipped

**Review (weak spots):** Neutral gray tokens instead of Shellui honey gold; storage URL in the header; no history back/forward; no column sort; cramped bulk actions in the breadcrumb row; no keyboard row focus; sidebar “LOCATIONS” shouty uppercase.

**Implemented:**
- Shellui-aligned light/dark CSS tokens (gray canvas, honey gold primary/ring).
- Cleaner header toolbar with back/forward (React Router history), compact actions, no storage URL in chrome.
- Sortable columns (name, type, size, modified) with folders-first ordering.
- Dedicated selection bar below breadcrumbs; item count in path row.
- Arrow-key navigation, Enter to open, Delete on selection; double-click to open rows.
- Sticky list header; `listSort` unit tests.

**Cycle 1 — next (Cycle 2):** Type-ahead find; breadcrumb truncation for deep paths; richer empty/loading polish; improve arrow-key + selection sync tests.

## Cycle 2 — (pending)

## Cycle 3 — (pending)

## Cycle 4 — (pending)
