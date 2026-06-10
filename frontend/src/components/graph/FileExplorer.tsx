import { useState, useMemo, useCallback } from 'react';
import {
  Search, ChevronRight, ChevronDown, FolderOpen, Folder,
  ArrowRight, Copy, Crosshair, MessageSquare,
} from 'lucide-react';
import { NODE_COLORS } from '../../lib/graphLayout';
import { useGraphStore } from '../../stores/useGraphStore';
import { useUIStore } from '../../stores/useUIStore';
import { api } from '../../services/api';
import type { GraphNode, NodeType } from '../../types';

const TYPE_LABELS: Record<NodeType, string> = {
  entry_point: 'Entry',
  component: 'Component',
  service: 'Service',
  utility: 'Utility',
  config: 'Config',
  test: 'Test',
};

interface FolderNode {
  name: string;
  path: string;
  children: Map<string, FolderNode>;
  files: GraphNode[];
  isExpanded: boolean;
}

function buildFileTree(nodes: GraphNode[]): FolderNode {
  const root: FolderNode = {
    name: '', path: '', children: new Map(), files: [], isExpanded: true,
  };

  for (const node of nodes) {
    const parts = node.id.split('/');
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part, path: currentPath, children: new Map(), files: [], isExpanded: false,
        });
      }
      current = current.children.get(part)!;
    }
    current.files.push(node);
  }

  return root;
}

function FolderItem({
  folder,
  selectedNodeId,
  depCounts,
  onSelectNode,
  onToggleFolder,
  depth = 0,
}: {
  folder: FolderNode;
  selectedNodeId: string | null;
  depCounts: Map<string, number>;
  onSelectNode: (id: string) => void;
  onToggleFolder: (path: string) => void;
  depth?: number;
}) {
  const hasContent = folder.files.length > 0 || folder.children.size > 0;
  if (!hasContent) return null;

  return (
    <div>
      {folder.name && (
        <button
          onClick={() => onToggleFolder(folder.path)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            width: '100%', padding: '3px 8px', background: 'transparent',
            border: 'none', cursor: 'pointer', fontSize: 11,
            color: 'var(--text-muted)', fontWeight: 500,
            paddingLeft: 8 + depth * 12,
            transition: 'background 0.1s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {folder.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {folder.isExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.name}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>
            {folder.files.length + [...folder.children.values()].reduce((sum, c) => sum + c.files.length, 0)}
          </span>
        </button>
      )}

      {(folder.isExpanded || !folder.name) && (
        <>
          {[...folder.children.values()].map((child) => (
            <FolderItem
              key={child.path}
              folder={child}
              selectedNodeId={selectedNodeId}
              depCounts={depCounts}
              onSelectNode={onSelectNode}
              onToggleFolder={onToggleFolder}
              depth={folder.name ? depth + 1 : depth}
            />
          ))}
          {folder.files.map((node) => (
            <FileItem
              key={node.id}
              node={node}
              isSelected={node.id === selectedNodeId}
              depCount={depCounts.get(node.id) || 0}
              onClick={() => onSelectNode(node.id)}
              depth={folder.name ? depth + 1 : depth}
            />
          ))}
        </>
      )}
    </div>
  );
}

function FileItem({
  node, isSelected, depCount, onClick, depth,
}: {
  node: GraphNode;
  isSelected: boolean;
  depCount: number;
  onClick: () => void;
  depth: number;
}) {
  const color = NODE_COLORS[node.type] || '#94a3b8';
  const isEntryPoint = node.type === 'entry_point';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '4px 8px',
        background: isSelected ? 'var(--accent-blue-bg)' : 'transparent',
        border: 'none', cursor: 'pointer',
        fontSize: 11, fontFamily: 'var(--font-mono)',
        color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
        fontWeight: isSelected ? 600 : 400,
        paddingLeft: 8 + depth * 12,
        borderRadius: 4,
        transition: 'all 0.1s',
        textAlign: 'left',
      }}
      onMouseOver={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
      }}
      onMouseOut={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
      title={node.id}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0,
      }} />
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {node.label}
      </span>
      {isEntryPoint && (
        <span style={{
          fontSize: 8, padding: '0 4px', borderRadius: 3,
          background: `${NODE_COLORS.entry_point}15`, color: NODE_COLORS.entry_point,
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          EP
        </span>
      )}
      {depCount > 0 && (
        <span style={{
          fontSize: 9, padding: '0 4px', borderRadius: 3,
          background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
          minWidth: 16, textAlign: 'center',
        }}>
          {depCount}
        </span>
      )}
    </button>
  );
}

export function FileExplorer({ jobId }: { jobId: string }) {
  const { graph, selectedNodeId, filters, selectNode, setFocusedDependencies, updateFilter } = useGraphStore();
  const { setRightPanel } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<NodeType | ''>('');
  const [showDepsOnly, setShowDepsOnly] = useState(false);
  const [showHighConnectivity, setShowHighConnectivity] = useState(false);

  const depCounts = useMemo(() => {
    if (!graph) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const edge of graph.edges) {
      counts.set(edge.source, (counts.get(edge.source) || 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) || 0) + 1);
    }
    return counts;
  }, [graph]);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    let nodes = [...graph.nodes];

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
    }

    // Apply type filter
    if (typeFilter) {
      nodes = nodes.filter(n => n.type === typeFilter);
    }

    // Show only files with dependencies
    if (showDepsOnly) {
      nodes = nodes.filter(n => (depCounts.get(n.id) || 0) > 0);
    }

    // Show only high connectivity
    if (showHighConnectivity) {
      nodes = nodes.filter(n => (depCounts.get(n.id) || 0) >= 5);
    }

    return nodes;
  }, [graph, searchQuery, typeFilter, showDepsOnly, showHighConnectivity, depCounts]);

  const fileTree = useMemo(() => buildFileTree(filteredNodes), [filteredNodes]);

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleSelectNode = useCallback(async (nodeId: string) => {
    selectNode(nodeId);
    setFocusedDependencies(nodeId);
    setRightPanel('node-details');

    // Fetch node details
    const { setIsLoadingNodeDetails, setNodeDetails } = useGraphStore.getState();
    setIsLoadingNodeDetails(true);
    try {
      const details = await api.graph.getNode(jobId, nodeId);
      setNodeDetails(details);
    } catch (err) {
      console.error('Failed to load node details:', err);
    } finally {
      setIsLoadingNodeDetails(false);
    }
  }, [jobId, selectNode, setFocusedDependencies, setRightPanel]);

  if (!graph) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center', fontSize: 12 }}>
        No graph loaded
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-card)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em', fontWeight: 600,
          }}>
            FILES ({filteredNodes.length}/{graph.nodes.length})
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={12} style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            data-graph-search
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg-primary)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '5px 8px 5px 24px',
              color: 'var(--text-primary)', fontSize: 11, outline: 'none',
            }}
          />
        </div>

        {/* Type filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
          {(['entry_point', 'service', 'component', 'utility', 'config', 'test'] as NodeType[]).map(t => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(active ? '' : t)}
                style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 4,
                  border: 'none', cursor: 'pointer', fontWeight: active ? 600 : 400,
                  background: active ? `${NODE_COLORS[t]}15` : 'var(--bg-secondary)',
                  color: active ? NODE_COLORS[t] : 'var(--text-muted)',
                  transition: 'all 0.1s',
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* Toggle filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowDepsOnly(!showDepsOnly)}
            style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 4,
              border: `1px solid ${showDepsOnly ? 'var(--accent-blue)' : 'var(--border)'}`,
              background: showDepsOnly ? 'var(--accent-blue-bg)' : 'transparent',
              color: showDepsOnly ? 'var(--accent-blue)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: showDepsOnly ? 600 : 400,
            }}
          >
            With deps
          </button>
          <button
            onClick={() => setShowHighConnectivity(!showHighConnectivity)}
            style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 4,
              border: `1px solid ${showHighConnectivity ? 'var(--accent-blue)' : 'var(--border)'}`,
              background: showHighConnectivity ? 'var(--accent-blue-bg)' : 'transparent',
              color: showHighConnectivity ? 'var(--accent-blue)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: showHighConnectivity ? 600 : 400,
            }}
          >
            High connectivity
          </button>
        </div>
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {filteredNodes.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              No files match your search
            </p>
            <button
              onClick={() => { setSearchQuery(''); setTypeFilter(''); setShowDepsOnly(false); setShowHighConnectivity(false); }}
              style={{
                fontSize: 11, padding: '4px 10px', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 4,
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <FolderItem
            folder={fileTree}
            selectedNodeId={selectedNodeId}
            depCounts={depCounts}
            onSelectNode={handleSelectNode}
            onToggleFolder={handleToggleFolder}
          />
        )}
      </div>
    </div>
  );
}
