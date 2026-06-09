import { create } from 'zustand';
import type { DependencyGraph, NodeDetails, NodeType } from '../types';

interface GraphFilter {
  nodeTypes: NodeType[];
  language: string;
  searchQuery: string;
}

interface GraphStore {
  graph: DependencyGraph | null;
  selectedNodeId: string | null;
  selectedNodeDetails: NodeDetails | null;
  highlightedNodeIds: Set<string>;
  isLoadingGraph: boolean;
  isLoadingNodeDetails: boolean;
  filters: GraphFilter;

  setGraph: (graph: DependencyGraph) => void;
  selectNode: (nodeId: string | null) => void;
  setNodeDetails: (details: NodeDetails | null) => void;
  setHighlightedNodes: (ids: string[]) => void;
  setIsLoadingGraph: (v: boolean) => void;
  setIsLoadingNodeDetails: (v: boolean) => void;
  updateFilter: (filter: Partial<GraphFilter>) => void;
  clearGraph: () => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  graph: null,
  selectedNodeId: null,
  selectedNodeDetails: null,
  highlightedNodeIds: new Set(),
  isLoadingGraph: false,
  isLoadingNodeDetails: false,
  filters: {
    nodeTypes: ['entry_point', 'component', 'service', 'utility', 'config', 'test'],
    language: '',
    searchQuery: '',
  },

  setGraph: (graph) => set({ graph }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedNodeDetails: null }),
  setNodeDetails: (details) => set({ selectedNodeDetails: details }),
  setHighlightedNodes: (ids) => set({ highlightedNodeIds: new Set(ids) }),
  setIsLoadingGraph: (v) => set({ isLoadingGraph: v }),
  setIsLoadingNodeDetails: (v) => set({ isLoadingNodeDetails: v }),
  updateFilter: (filter) => set((state) => ({ filters: { ...state.filters, ...filter } })),
  clearGraph: () => set({ graph: null, selectedNodeId: null, selectedNodeDetails: null, highlightedNodeIds: new Set() }),
}));
