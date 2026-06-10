import { create } from 'zustand';
import type { DependencyGraph, NodeDetails, NodeType } from '../types';

export type LayoutMode = 'hierarchical' | 'clustered' | 'compact';

interface GraphFilter {
  nodeTypes: NodeType[];
  language: string;
  searchQuery: string;
  showTests: boolean;
  showDependencies: boolean;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  entryPoints: number;
  languages: string[];
  testCount: number;
  highConnectivityCount: number;
}

interface GraphStore {
  graph: DependencyGraph | null;
  selectedNodeId: string | null;
  selectedNodeDetails: NodeDetails | null;
  highlightedNodeIds: Set<string>;
  focusedDependencies: Set<string>;
  isLoadingGraph: boolean;
  isLoadingNodeDetails: boolean;
  graphError: string | null;
  filters: GraphFilter;
  layoutMode: LayoutMode;
  showLegend: boolean;

  // Computed
  stats: GraphStats | null;
  dependencyMap: Map<string, { imports: string[]; importedBy: string[] }>;

  setGraph: (graph: DependencyGraph) => void;
  selectNode: (nodeId: string | null) => void;
  setNodeDetails: (details: NodeDetails | null) => void;
  setHighlightedNodes: (ids: string[]) => void;
  setFocusedDependencies: (nodeId: string | null) => void;
  setIsLoadingGraph: (v: boolean) => void;
  setIsLoadingNodeDetails: (v: boolean) => void;
  setGraphError: (error: string | null) => void;
  updateFilter: (filter: Partial<GraphFilter>) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  toggleLegend: () => void;
  clearFilters: () => void;
  clearGraph: () => void;
}

function buildDependencyMap(graph: DependencyGraph) {
  const map = new Map<string, { imports: string[]; importedBy: string[] }>();
  for (const node of graph.nodes) {
    map.set(node.id, { imports: [], importedBy: [] });
  }
  for (const edge of graph.edges) {
    const source = map.get(edge.source);
    const target = map.get(edge.target);
    if (source) source.imports.push(edge.target);
    if (target) target.importedBy.push(edge.source);
  }
  return map;
}

function computeStats(graph: DependencyGraph, depMap: Map<string, { imports: string[]; importedBy: string[] }>): GraphStats {
  const languages = [...new Set(graph.nodes.map(n => n.language))];
  const testCount = graph.nodes.filter(n => n.type === 'test').length;
  const highConnectivityCount = [...depMap.values()].filter(
    d => d.imports.length + d.importedBy.length >= 5
  ).length;

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    entryPoints: graph.entry_points.length,
    languages,
    testCount,
    highConnectivityCount,
  };
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  graph: null,
  selectedNodeId: null,
  selectedNodeDetails: null,
  highlightedNodeIds: new Set(),
  focusedDependencies: new Set(),
  isLoadingGraph: false,
  isLoadingNodeDetails: false,
  graphError: null,
  filters: {
    nodeTypes: ['entry_point', 'component', 'service', 'utility', 'config', 'test'],
    language: '',
    searchQuery: '',
    showTests: true,
    showDependencies: true,
  },
  layoutMode: 'hierarchical',
  showLegend: false,
  stats: null,
  dependencyMap: new Map(),

  setGraph: (graph) => {
    const depMap = buildDependencyMap(graph);
    const stats = computeStats(graph, depMap);
    set({ graph, dependencyMap: depMap, stats, graphError: null });
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedNodeDetails: null }),
  setNodeDetails: (details) => set({ selectedNodeDetails: details }),
  setHighlightedNodes: (ids) => set({ highlightedNodeIds: new Set(ids) }),
  setFocusedDependencies: (nodeId) => {
    if (!nodeId) {
      set({ focusedDependencies: new Set() });
      return;
    }
    const { graph } = get();
    if (!graph) return;
    const depMap = buildDependencyMap(graph);
    const deps = depMap.get(nodeId);
    if (!deps) {
      set({ focusedDependencies: new Set([nodeId]) });
      return;
    }
    const focused = new Set<string>([nodeId, ...deps.imports, ...deps.importedBy]);
    set({ focusedDependencies: focused });
  },
  setIsLoadingGraph: (v) => set({ isLoadingGraph: v }),
  setIsLoadingNodeDetails: (v) => set({ isLoadingNodeDetails: v }),
  setGraphError: (error) => set({ graphError: error }),
  updateFilter: (filter) => set((state) => ({ filters: { ...state.filters, ...filter } })),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  toggleLegend: () => set((s) => ({ showLegend: !s.showLegend })),
  clearFilters: () => set((state) => ({
    filters: {
      nodeTypes: ['entry_point', 'component', 'service', 'utility', 'config', 'test'],
      language: '',
      searchQuery: '',
      showTests: true,
      showDependencies: true,
    }
  })),
  clearGraph: () => set({
    graph: null, selectedNodeId: null, selectedNodeDetails: null,
    highlightedNodeIds: new Set(), focusedDependencies: new Set(),
    stats: null, dependencyMap: new Map(), graphError: null,
  }),
}));
