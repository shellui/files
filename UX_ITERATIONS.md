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

## Cycle 2 — shipped

**Review:** Deep paths overflow breadcrumbs; no quick “parent folder”; empty folder feels bare; no type-ahead to jump files in large folders.

**Implemented:**
- Collapsed breadcrumbs for deep paths (`BreadcrumbTrail`).
- “Up one folder” control beside breadcrumbs.
- Finder-style type-ahead filter with status bar (`useTypeaheadFind`, `FileFindBar`).
- Calmer empty folder state with upload / new-folder actions; dedicated no-match state.
- Tests for find filter.

**Cycle 2 — next (Cycle 3):** List density toggle; full-pane drag-over upload affordance; F2 rename; Space to toggle selection.

## Cycle 3 — (pending)

## Cycle 3 — (pending)

## Cycle 4 — (pending)
