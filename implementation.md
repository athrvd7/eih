# Graph Explorer Redesign — Implementation Plan

**Date:** 2026-06-10  
**Scope:** Frontend workspace graph page (`frontend/src/pages/WorkspacePage.tsx`, `frontend/src/components/graph/`, `frontend/src/lib/graphLayout.ts`, `frontend/src/stores/useGraphStore.ts`)

---

## Objective

Redesign the graph/nodes page into a more usable **Graph Explorer** that helps users orient themselves, inspect files, follow dependencies, and ask contextual questions — without losing the graph context. The page should feel like a codebase cockpit, not a generic graph viewer.

---

## Implementation Plan

### 1. Define the new Graph Explorer layout

Separate the workspace into five distinct zones:

- **Toolbar** — persistent controls above the canvas
- **File Explorer** (left sidebar) — searchable, interactive file tree
- **React Flow Canvas** (center) — graph visualization
- **Inspector** (right panel) — tabbed node details
- **Chat Drawer** (bottom) — contextual conversation, not a floating overlay

This replaces the current monolithic layout where topbar controls, left sidebar, center graph, right panel, and floating chat are mixed without clear hierarchy.

**Rationale:** Separates navigation, visualization, inspection, and conversation into dedicated zones instead of mixing them in one crowded workspace.

---

### 2. Add a graph toolbar above the React Flow canvas

Add a persistent toolbar with visible controls for:

- Search files
- Filter by node type
- Filter by language
- Legend
- Layout mode: hierarchical, clustered, compact
- Fit view / Reset view
- Show/hide tests
- Show/hide dependencies
- Focus selected node
- Clear filters

**Rationale:** Users need visible controls for search, filters, layout, legend, reset view, and focus actions. The current filter panel is embedded inside the React Flow canvas and is too small for heavy use.

**Current starting point:** `frontend/src/components/graph/GraphView.tsx:177-297`

---

### 3. Add graph stats that matter

Replace the current `124 nodes · 83 edges` with richer orientation stats:

```
124 nodes · 83 edges
Entry points: 2
Languages: Python, TypeScript
Tests: 18
High-connectivity files: 7
Graph health: ready
```

**Rationale:** Raw node/edge counts are not enough to understand the codebase shape. Users need to know what kind of repo they are looking at before they interact.

**Current starting point:** `frontend/src/components/graph/GraphView.tsx:283-297`

---

### 4. Add dependency focus mode for selected nodes

When a node is selected, the graph should immediately highlight:

- The selected node
- Its direct dependencies (outgoing edges)
- Files that import it (incoming edges)
- The path between selected node and entry points
- Dim everything else

The store already has `highlightedNodeIds` but it is not meaningfully used yet.

**Rationale:** Users rarely need the entire graph at once. They need a focused slice that answers “Where is this file used?” and “What does this file depend on?”

**Current starting point:** `frontend/src/stores/useGraphStore.ts:10-27`

---

### 5. Make the left file sidebar searchable and interactive

Improve the current left sidebar from a plain list of 50 nodes into a functional file explorer:

- Search files by name or path
- Filter by type (entry point, service, component, utility, config, test)
- Filter by language
- Active selected node state
- Dependency count badges
- Entry point marker
- Expand/collapse by folder
- “Show only files with dependencies”
- “Show only high-connectivity nodes”

**Rationale:** The current sidebar only lists the first 50 nodes and does not show active state. Users should be able to jump to a file without hunting around the graph.

**Current starting point:** `frontend/src/pages/WorkspacePage.tsx:217-237`

---

### 6. Redesign the node details panel into tabs

Restructure the current linear node inspector into four tabbed sections:

| Tab | Content |
|-----|---------|
| **Overview** | File path, type badge, language, LOC, AI summary |
| **Connections** | Imports, imported by, entry point status, dependency depth |
| **Code** | Highlighted snippet, copy path, open related nodes |
| **Ask** | Suggested questions about this file, “Explain this file”, “How is this used?” |

**Rationale:** The current panel is useful but too linear. A tabbed inspector feels more like an IDE and organizes information by intent rather than dumping it all at once.

**Current starting point:** `frontend/src/components/graph/NodeDetailsPanel.tsx:50-140`

---

### 7. Add node actions

Add contextual actions inside the node inspector and on the node itself:

- Copy file path
- Focus node in graph
- Show dependencies
- Show dependents
- Ask about this file
- Jump to walkthrough step
- Jump to onboarding docs section

**Rationale:** Turns passive inspection into active navigation. Users should be able to act on what they see, not just read it.

---

### 8. Convert chat from floating overlay into a bottom drawer or inspector tab

Move the chat panel from a fixed overlay that covers the graph into:

- A collapsible bottom drawer, OR
- A dedicated “Ask” tab inside the right inspector

Clicking a citation should highlight the referenced node or chunk in the graph.

**Rationale:** Prevents chat from covering the graph and makes it contextual. Users should be able to chat and inspect the graph at the same time.

**Current starting point:** `frontend/src/components/chat/ChatPanel.tsx:79-89`

---

### 9. Add empty, loading, and error states

Add explicit feedback states for:

- Graph loading (skeleton or spinner)
- Graph failed to load
- No nodes match filters
- No search results
- Try clearing search
- Graph has no edges yet
- Embedding failed, but graph is still available
- No node selected (inspector empty state)

**Rationale:** Improves confidence during ingestion, failed API calls, and no-result searches. Users should always know what is happening and what they can do next.

---

### 10. Add keyboard navigation

Developers should be able to navigate the graph without relying entirely on the mouse:

- Arrow keys to move between connected nodes
- Enter to open inspector
- Escape to close inspector
- / to focus search
- F to fit view
- R to reset view
- Ctrl+K for command palette (future)

**Rationale:** Keyboard navigation is expected for developers who spend most of their time in code editors.

---

### 11. Persist UI preferences

Store user preferences so they survive view switching:

- Selected filters (node types, language, search)
- Layout mode (hierarchical, clustered, compact)
- Sidebar width
- Selected node
- Inspector active tab
- Chat drawer open/closed

**Rationale:** Users should not lose their context when switching between walkthrough, docs, and graph tabs.

---

### 12. Optimize large graph performance

For repos with 100+ files:

- Debounce search input
- Cache dagre layout results per filter set
- Hide tests and config by default for large repos
- Add compact layout mode (smaller nodes, fewer labels)
- Virtualize the file sidebar list

**Rationale:** Large repos are common and the graph should remain responsive.

**Current starting point:** `frontend/src/lib/graphLayout.ts:35-119`

---

## Verification Criteria

- [ ] Clicking a node updates the inspector and highlights its dependency neighborhood.
- [ ] Searching for a file focuses the matching node and scrolls it into view.
- [ ] Filters update both the graph canvas and the file sidebar consistently.
- [ ] The graph toolbar includes fit view, reset view, legend, and layout controls.
- [ ] The file sidebar shows the active selected node state.
- [ ] Chat no longer obscures important graph context.
- [ ] Empty states are shown for no search results, failed graph load, and no selected node.
- [ ] Keyboard users can select nodes and open details without using the mouse.
- [ ] UI preferences persist across tab switches.
- [ ] Frontend build passes (`npm run build`).
- [ ] Manual testing confirms the graph remains responsive on a medium-sized repo (50–150 files).

---

## Potential Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **React Flow state drift** | Keep node/edge state controlled, reset view explicitly, and avoid unnecessary state resets during hover/filter changes. |
| **Large graphs become slow** | Debounce search, cache layouts, hide tests/config by default for large repos, and add compact layout mode. |
| **Too many controls clutter the UI** | Group toolbar actions logically and hide advanced options behind dropdowns. |
| **AI-generated summaries add latency** | Cache summaries, show loading skeletons, and allow users to continue exploring while summaries load. |
| **Chat integration becomes distracting** | Keep chat collapsible and context-aware instead of always open. |

---

## Alternative Approaches

| Approach | Description | Trade-off |
|----------|-------------|-----------|
| **Incremental polish** | Add toolbar, better filters, active file tree, and dependency highlighting without changing the overall layout. | Fastest, lowest risk, but less transformative. |
| **Full Graph Explorer redesign** | Rebuild the workspace around toolbar, file explorer, canvas, inspector, and contextual chat drawer. | Best UX, more implementation work. |
| **Data-first improvement** | Improve backend graph data with clusters, dependency counts, entry point paths, and richer edge metadata before redesigning the UI. | Enables better UX later, but users will not immediately feel the improvement. |
| **Replace React Flow with a custom canvas** | Gives maximum control over rendering and clustering. | High effort and unnecessary unless React Flow becomes a hard limitation. |

---

## Recommendation

Proceed with the **Full Graph Explorer redesign**, but keep React Flow as the rendering engine. Start with these four items in order — they deliver the highest UX impact per implementation effort:

1. Graph toolbar  
2. Dependency focus mode  
3. Searchable file tree  
4. Tabbed node inspector  

Once those are stable, follow with:

5. Contextual chat drawer  
6. Empty/loading/error states  
7. Keyboard navigation  
8. UI preference persistence  
9. Large-graph performance optimizations
