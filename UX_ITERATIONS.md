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

## Cycle 3 — shipped

**Review:** Large folders need tighter density; external file drag is easy to miss; power users expect F2 rename and Space to toggle selection.

**Implemented:**
- Comfortable / compact density toggle (persisted in `localStorage`).
- Full-pane dashed overlay when dragging files from the OS.
- F2 rename and Space to toggle selection on focused row.
- Auto-scroll focused row into view.

**Cycle 3 — next (Cycle 4):** Error retry affordance; Alt+Up parent navigation; keyboard shortcut hints; final visual polish.

## Cycle 4 — shipped (+ final polish)

**Review:** Refresh flashes skeleton over existing rows; errors have no recovery; parent navigation lacks a keyboard chord; shortcuts are undiscoverable.

**Implemented:**
- Stale-while-revalidate listing (keep rows visible, dim while refreshing).
- Error banner with “Try again”.
- Alt+↑ to go to parent folder; shared with the up button.
- Keyboard hints footer (desktop).
- `KeyboardHintsFooter` and error retry i18n.

## Remaining backlog (frontend, not in this PR)

- Virtualized rows when list limits increase beyond ~200 items.
- Grid / gallery view toggle.
- Sidebar folder tree (needs lazy tree API or client cache strategy).
- Recent / pinned folders (localStorage + navigation history).
- Bulk move from selection toolbar (modal already exists per-item).
