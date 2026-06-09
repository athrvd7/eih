import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { DependencyGraph, NodeType } from "../types";

export const NODE_COLORS: Record<string, string> = {
  entry_point: "#22c55e",
  component: "#3b82f6",
  service: "#f97316",
  utility: "#94a3b8",
  config: "#a855f7",
  test: "#eab308",
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

export interface GraphFilter {
  nodeTypes: NodeType[];
  language: string;
  searchQuery: string;
}

interface EihNodeData {
  label: string;
  nodeType: string;
  language: string;
  linesOfCode: number;
  color: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  [key: string]: unknown;
}

export function buildFlowGraph(
  graph: DependencyGraph,
  filters: GraphFilter
): { nodes: Node<EihNodeData>[]; edges: Edge[] } {
  // Filter nodes by type and language
  const visibleNodes = graph.nodes.filter((n) => {
    if (filters.nodeTypes.length && !filters.nodeTypes.includes(n.type)) return false;
    if (filters.language && n.language !== filters.language) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!n.id.toLowerCase().includes(q) && !n.label.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 });

  for (const n of visibleNodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const visibleEdges = graph.edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
  );

  for (const e of visibleEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  const nodes: Node<EihNodeData>[] = visibleNodes.map((n) => {
    const pos = g.node(n.id) ?? { x: 0, y: 0 };
    return {
      id: n.id,
      type: "eihNode",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: n.label,
        nodeType: n.type,
        language: n.language,
        linesOfCode: n.lines_of_code,
        color: NODE_COLORS[n.type] ?? "#94a3b8",
        isSelected: false,
        isHighlighted: false,
        isDimmed: false,
      },
    };
  });

  const edges: Edge[] = visibleEdges.map((e) => ({
    id: e.id,
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
