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
import { GraphToolbar, GraphLegend } from "./GraphToolbar";
import { buildFlowGraph, NODE_COLORS } from "../../lib/graphLayout";
import { useGraphStore } from "../../stores/useGraphStore";
import { useUIStore } from "../../stores/useUIStore";
import { api } from "../../services/api";
import type { NodeType } from "../../types";

const nodeTypes = { eihNode: EihNode };

function GraphCanvas({ jobId }: { jobId: string }) {
  const {
    graph,
    selectedNodeId,
    highlightedNodeIds,
    focusedDependencies,
    filters,
    layoutMode,
    showLegend,
    stats,
    selectNode,
    setNodeDetails,
    setIsLoadingNodeDetails,
    setFocusedDependencies,
    graphError,
    isLoadingGraph,
  } = useGraphStore();
  const { setRightPanel } = useUIStore();
  const { fitView, getNodes } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // Build flow graph from data
  useEffect(() => {
    if (!graph) return;
    const { nodes: rfNodes, edges: rfEdges } = buildFlowGraph(graph, filters, layoutMode);

    // Determine active highlight set (either walkthrough highlights or focus deps)
    const activeHighlights = focusedDependencies.size > 0
      ? focusedDependencies
      : highlightedNodeIds;

    const updated = rfNodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      data: {
        ...n.data,
        isEntryPoint: graph.entry_points.includes(n.id),
        isHighlighted:
          activeHighlights.size > 0 && activeHighlights.has(n.id),
        isDimmed:
          activeHighlights.size > 0 &&
          !activeHighlights.has(n.id) &&
          n.id !== selectedNodeId,
      },
    }));

    setNodes(updated);
    setEdges(rfEdges);
  }, [graph, filters, selectedNodeId, highlightedNodeIds, focusedDependencies, layoutMode]);

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
    const activeHighlights = focusedDependencies.size > 0
      ? focusedDependencies
      : highlightedNodeIds;
    if (activeHighlights.size > 0) {
      setTimeout(() => {
        fitView({
          nodes: Array.from(activeHighlights).map((id) => ({ id })),
          padding: 0.3,
          duration: 600,
        });
      }, 100);
    }
  }, [highlightedNodeIds, focusedDependencies]);

  // Listen for toolbar events
  useEffect(() => {
    const handleFitView = () => fitView({ padding: 0.1, duration: 400 });
    const handleResetView = () => {
      setFocusedDependencies(null);
      fitView({ padding: 0.1, duration: 400 });
    };
    window.addEventListener('graph:fitView', handleFitView);
    window.addEventListener('graph:resetView', handleResetView);
    return () => {
      window.removeEventListener('graph:fitView', handleFitView);
      window.removeEventListener('graph:resetView', handleResetView);
    };
  }, [fitView, setFocusedDependencies]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if (e.key === 'Escape') {
        selectNode(null);
        setFocusedDependencies(null);
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-graph-search]');
        searchInput?.focus();
        return;
      }

      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        fitView({ padding: 0.1, duration: 400 });
        return;
      }

      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusedDependencies(null);
        fitView({ padding: 0.1, duration: 400 });
        return;
      }

      // Arrow key navigation between connected nodes
      if (selectedNodeId && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const graphData = useGraphStore.getState().graph;
        if (!graphData) return;

        const connectedEdges = graphData.edges.filter(
          (edge) => edge.source === selectedNodeId || edge.target === selectedNodeId
        );
        const connectedIds = connectedEdges.map((edge) =>
          edge.source === selectedNodeId ? edge.target : edge.source
        );

        if (connectedIds.length === 0) return;

        const currentIdx = connectedIds.indexOf(selectedNodeId);
        let nextIdx: number;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIdx = (currentIdx + 1) % connectedIds.length;
        } else {
          nextIdx = (currentIdx - 1 + connectedIds.length) % connectedIds.length;
        }

        const nextId = connectedIds[nextIdx] || connectedIds[0];
        if (nextId) {
          selectNode(nextId);
          setRightPanel('node-details');
        }
      }

      // Enter to open inspector
      if (e.key === 'Enter' && selectedNodeId) {
        setRightPanel('node-details');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectNode, setFocusedDependencies, setRightPanel, fitView]);

  const onNodeClick = useCallback(
    async (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
      setFocusedDependencies(node.id);
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
    [jobId, selectNode, setNodeDetails, setRightPanel, setIsLoadingNodeDetails, setFocusedDependencies],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setFocusedDependencies(null);
  }, [selectNode, setFocusedDependencies]);

  // Loading state
  if (isLoadingGraph) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)", flexDirection: "column", gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid var(--border)',
          borderTopColor: 'var(--text-primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 13 }}>Loading graph...</p>
      </div>
    );
  }

  // Error state
  if (graphError) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>!</div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--error)" }}>Failed to load graph</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{graphError}</p>
      </div>
    );
  }

  // Empty state
  if (!graph) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-secondary)", flexDirection: "column", gap: 8,
      }}>
        <div style={{ fontSize: 36, opacity: 0.3 }}>&#x1F4CA;</div>
        <p style={{ fontSize: 13 }}>No graph data available</p>
      </div>
    );
  }

  // No results from filters
  if (nodes.length === 0 && graph) {
    return (
      <>
        <GraphToolbar />
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-secondary)", flexDirection: "column", gap: 8,
        }}>
          <p style={{ fontSize: 14, fontWeight: 500 }}>No nodes match your filters</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Try adjusting the search or filter criteria</p>
        </div>
      </>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      <GraphToolbar />

      <div style={{ flex: 1, position: "relative" }}>
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
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
            }}
          />
          <MiniMap
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
            }}
            nodeColor={(n: { data: { nodeType?: NodeType } }) =>
              NODE_COLORS[n.data.nodeType as NodeType] || "var(--text-secondary)"
            }
            maskColor="rgba(250, 250, 250, 0.6)"
          />

          {/* Rich stats panel */}
          {stats && (
            <Panel
              position="top-right"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 14px", fontSize: 11,
                color: "var(--text-secondary)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {stats.totalNodes} nodes &middot; {stats.totalEdges} edges
              </div>
              <div>Entry points: {stats.entryPoints}</div>
              <div>Languages: {stats.languages.join(", ")}</div>
              {stats.testCount > 0 && <div>Tests: {stats.testCount}</div>}
              {stats.highConnectivityCount > 0 && (
                <div>High-connectivity files: {stats.highConnectivityCount}</div>
              )}
            </Panel>
          )}

          {/* Legend panel */}
          {showLegend && (
            <Panel
              position="bottom-left"
              style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 14px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8,
              }}>
                LEGEND
              </div>
              <GraphLegend />
            </Panel>
          )}
        </ReactFlow>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
