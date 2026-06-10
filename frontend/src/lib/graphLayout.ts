import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { DependencyGraph, NodeType } from "../types";
import type { LayoutMode } from "../stores/useGraphStore";

export const NODE_COLORS: Record<string, string> = {
  entry_point: "#22c55e",
  component: "#3b82f6",
  service: "#f97316",
  utility: "#94a3b8",
  config: "#a855f7",
  test: "#eab308",
};

export interface GraphFilter {
  nodeTypes: NodeType[];
  language: string;
  searchQuery: string;
  showTests: boolean;
  showDependencies: boolean;
}

interface EihNodeData {
  label: string;
  nodeType: string;
  language: string;
  linesOfCode: number;
  color: string;
  isEntryPoint: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  [key: string]: unknown;
}

interface LayoutConfig {
  rankdir: string;
  ranksep: number;
  nodesep: number;
  nodeWidth: number;
  nodeHeight: number;
}

const LAYOUT_CONFIGS: Record<LayoutMode, LayoutConfig> = {
  hierarchical: {
    rankdir: "LR",
    ranksep: 80,
    nodesep: 40,
    nodeWidth: 180,
    nodeHeight: 56,
  },
  clustered: {
    rankdir: "TB",
    ranksep: 60,
    nodesep: 50,
    nodeWidth: 180,
    nodeHeight: 56,
  },
  compact: {
    rankdir: "LR",
    ranksep: 40,
    nodesep: 20,
    nodeWidth: 140,
    nodeHeight: 40,
  },
};

export function buildFlowGraph(
  graph: DependencyGraph,
  filters: GraphFilter,
  layoutMode: LayoutMode = "hierarchical",
): { nodes: Node<EihNodeData>[]; edges: Edge[] } {
  const config = LAYOUT_CONFIGS[layoutMode];

  const uniqueNodes: DependencyGraph["nodes"] = [];
  const seenNodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || seenNodeIds.has(node.id)) continue;
    seenNodeIds.add(node.id);
    uniqueNodes.push(node);
  }

  // Filter nodes
  const visibleNodes = uniqueNodes.filter((n) => {
    if (
      filters.nodeTypes.length &&
      !filters.nodeTypes.includes(n.type)
    )
      return false;
    if (filters.language && n.language !== filters.language) return false;
    if (!filters.showTests && n.type === "test") return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (
        !n.id.toLowerCase().includes(q) &&
        !n.label.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  const uniqueEdges: DependencyGraph["edges"] = [];
  const seenEdgeKeys = new Set<string>();
  for (const edge of graph.edges) {
    const edgeKey = `${edge.source}\u0000${edge.target}\u0000${edge.relation}\u0000${edge.imported_symbols.join("\u0000")}`;
    if (seenEdgeKeys.has(edgeKey)) continue;
    seenEdgeKeys.add(edgeKey);
    uniqueEdges.push(edge);
  }

  const visibleEdges = uniqueEdges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  // For clustered mode, group nodes by type
  if (layoutMode === "clustered") {
    return buildClusteredLayout(
      visibleNodes,
      visibleEdges,
      graph,
      config,
    );
  }

  // Hierarchical / Compact — standard dagre layout
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: config.rankdir,
    ranksep: config.ranksep,
    nodesep: config.nodesep,
  });

  for (const n of visibleNodes) {
    g.setNode(n.id, { width: config.nodeWidth, height: config.nodeHeight });
  }
  for (const e of visibleEdges) {
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  const nodes: Node<EihNodeData>[] = visibleNodes.map((n) => {
    const pos = g.node(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: "eihNode",
      position: {
        x: pos.x - config.nodeWidth / 2,
        y: pos.y - config.nodeHeight / 2,
      },
      data: {
        label: n.label,
        nodeType: n.type,
        language: n.language,
        linesOfCode: n.lines_of_code,
        color: NODE_COLORS[n.type] ?? "#94a3b8",
        isEntryPoint: graph.entry_points.includes(n.id),
        isSelected: false,
        isHighlighted: false,
        isDimmed: false,
      },
    };
  });

  const edges: Edge[] = visibleEdges.map((e, index) => ({
    id: `${e.id}-${index}`,
    source: e.source,
    target: e.target,
    animated: false,
    style: {
      stroke: "#3a4060",
      strokeWidth: 1.5,
      opacity: 0.7,
    },
  }));

  return { nodes, edges };
}

function buildClusteredLayout(
  visibleNodes: DependencyGraph["nodes"],
  visibleEdges: DependencyGraph["edges"],
  graph: DependencyGraph,
  config: LayoutConfig,
): { nodes: Node<EihNodeData>[]; edges: Edge[] } {
  // Group by type
  const groups = new Map<string, DependencyGraph["nodes"]>();
  const typeOrder: string[] = [
    "entry_point",
    "service",
    "component",
    "utility",
    "config",
    "test",
  ];
  for (const t of typeOrder) groups.set(t, []);
  for (const n of visibleNodes) {
    const group = groups.get(n.type);
    if (group) group.push(n);
  }

  const nodes: Node<EihNodeData>[] = [];
  let yOffset = 0;
  const xGap = 20;
  const yGap = 30;
  const rowHeight = config.nodeHeight + yGap;
  const maxPerRow = 6;
  const rowWidth = maxPerRow * (config.nodeWidth + xGap);

  for (const [type, groupNodes] of groups) {
    if (groupNodes.length === 0) continue;

    const rows = Math.ceil(groupNodes.length / maxPerRow);
    for (let i = 0; i < groupNodes.length; i++) {
      const n = groupNodes[i];
      const row = Math.floor(i / maxPerRow);
      const col = i % maxPerRow;
      nodes.push({
        id: n.id,
        type: "eihNode",
        position: {
          x: col * (config.nodeWidth + xGap),
          y: yOffset + row * rowHeight,
        },
        data: {
          label: n.label,
          nodeType: n.type,
          language: n.language,
          linesOfCode: n.lines_of_code,
          color: NODE_COLORS[n.type] ?? "#94a3b8",
          isEntryPoint: graph.entry_points.includes(n.id),
          isSelected: false,
          isHighlighted: false,
          isDimmed: false,
        },
      });
    }
    yOffset += rows * rowHeight + 40; // Extra gap between groups
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = visibleEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, index) => ({
      id: `${e.id}-${index}`,
      source: e.source,
      target: e.target,
      animated: false,
      style: {
        stroke: "#3a4060",
        strokeWidth: 1.5,
        opacity: 0.7,
      },
    }));

  return { nodes, edges };
}
