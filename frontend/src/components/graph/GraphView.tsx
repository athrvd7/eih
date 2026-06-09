import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import EihNode from "./EihNode";
import { buildFlowGraph, NODE_COLORS } from "../../lib/graphLayout";
import { useGraphStore } from "../../stores/useGraphStore";

import { useUIStore } from "../../stores/useUIStore";
import { api } from "../../services/api";
import type { NodeType } from "../../types";

const nodeTypes = { eihNode: EihNode };

const ALL_TYPES: NodeType[] = [
  "entry_point",
  "component",
  "service",
  "utility",
  "config",
  "test",
];

function GraphCanvas({ jobId }: { jobId: string }) {
  const {
    graph,
    selectedNodeId,
    highlightedNodeIds,
    filters,
    selectNode,
    setNodeDetails,
    setIsLoadingNodeDetails,
    updateFilter,
  } = useGraphStore();
  const { setRightPanel } = useUIStore();
  const { fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // Build flow graph from data
  useEffect(() => {
    if (!graph) return;
    const { nodes: rfNodes, edges: rfEdges } = buildFlowGraph(graph, filters);

    // Apply highlight/dim
    const updated = rfNodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      data: {
        ...n.data,
        isHighlighted:
          highlightedNodeIds.size > 0 && highlightedNodeIds.has(n.id),
        isDimmed:
          highlightedNodeIds.size > 0 &&
          !highlightedNodeIds.has(n.id) &&
          n.id !== selectedNodeId,
      },
    }));

    setNodes(updated);
    setEdges(rfEdges);
  }, [graph, filters, selectedNodeId, highlightedNodeIds]);

  // Fit view when graph first loads
  const hasfit = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasfit.current) {
      setTimeout(() => fitView({ padding: 0.1 }), 100);
      hasfit.current = true;
    }
  }, [nodes]);

  // Focus on highlighted nodes
  useEffect(() => {
    if (highlightedNodeIds.size > 0) {
      setTimeout(() => {
        fitView({
          nodes: Array.from(highlightedNodeIds).map((id) => ({ id })),
          padding: 0.3,
          duration: 600,
        });
      }, 100);
    }
  }, [highlightedNodeIds]);

  const onNodeClick = useCallback(
    async (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
      setRightPanel("node-details");
      setIsLoadingNodeDetails(true);

      try {
        const details = await api.graph.getNode(jobId, node.id);
        setNodeDetails(details);
      } catch (err) {
        console.error("Failed to load node details:", err);
      } finally {
        setIsLoadingNodeDetails(false);
      }
    },
    [jobId, selectNode, setNodeDetails, setRightPanel, setIsLoadingNodeDetails],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const languages = useMemo(() => {
    if (!graph) return [];
    const langs = new Set(graph.nodes.map((n) => n.language));
    return Array.from(langs);
  }, [graph]);

  if (!graph) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p>No graph data available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2.5}
        fitView
        attributionPosition="bottom-left"
        style={{ background: "var(--bg-primary)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--border)"
          gap={20}
          size={1}
        />
        <Controls
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}
        />
        <MiniMap
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}
          nodeColor={(n: { data: { nodeType?: NodeType } }) =>
            NODE_COLORS[n.data.nodeType as NodeType] || "var(--text-secondary)"
          }
          maskColor="rgba(250, 250, 250, 0.6)"
        />

        {/* Filters Panel */}
        <Panel
          position="top-left"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            maxWidth: 260,
            boxShadow: "0 8px 30px rgba(0,0,0,0.03)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 8,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            FILTERS
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search files..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter({ searchQuery: e.target.value })}
            style={{
              width: "100%",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "4px 8px",
              color: "var(--text-primary)",
              fontSize: 12,
              marginBottom: 8,
              outline: "none",
            }}
          />

          {/* Node types */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 8,
            }}
          >
            {ALL_TYPES.map((type) => {
              const active = filters.nodeTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => {
                    const newTypes = active
                      ? filters.nodeTypes.filter((t) => t !== type)
                      : [...filters.nodeTypes, type];
                    updateFilter({ nodeTypes: newTypes });
                  }}
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    background: active ? `${NODE_COLORS[type]}15` : "var(--bg-secondary)",
                    color: active ? NODE_COLORS[type] : "var(--text-secondary)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {type.replace("_", " ")}
                </button>
              );
            })}
          </div>

          {/* Language filter */}
          {languages.length > 1 && (
            <select
              value={filters.language}
              onChange={(e) => updateFilter({ language: e.target.value })}
              style={{
                width: "100%",
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "4px 8px",
                color: "var(--text-primary)",
                fontSize: 12,
              }}
            >
              <option value="">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Panel>

        {/* Graph stats */}
        <Panel
          position="top-right"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--text-secondary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function GraphView({ jobId }: { jobId: string }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas jobId={jobId} />
    </ReactFlowProvider>
  );
}
