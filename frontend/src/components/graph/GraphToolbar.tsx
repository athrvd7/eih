import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Filter, Layout, Eye, EyeOff, Crosshair,
  RotateCcw, Maximize2, Info, ChevronDown,
} from 'lucide-react';
import { NODE_COLORS } from '../../lib/graphLayout';
import { useGraphStore } from '../../stores/useGraphStore';
import type { LayoutMode } from '../../stores/useGraphStore';
import type { NodeType } from '../../types';

const ALL_TYPES: NodeType[] = [
  'entry_point', 'component', 'service', 'utility', 'config', 'test',
];

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  hierarchical: 'Hierarchical',
  clustered: 'Clustered',
  compact: 'Compact',
};

const TYPE_LABELS: Record<NodeType, string> = {
  entry_point: 'Entry',
  component: 'Component',
  service: 'Service',
  utility: 'Utility',
  config: 'Config',
  test: 'Test',
};

export function GraphToolbar() {
  const {
    graph, filters, layoutMode, showLegend, stats,
    updateFilter, setLayoutMode, toggleLegend, clearFilters,
    selectedNodeId, setFocusedDependencies,
  } = useGraphStore();

  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) setShowLayoutMenu(false);
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setShowTypeMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const languages = [...new Set(graph?.nodes.map(n => n.language) || [])];
  const hasActiveFilters = filters.searchQuery || filters.language ||
    filters.nodeTypes.length < ALL_TYPES.length || !filters.showTests;

  const handleFocusNode = useCallback(() => {
    if (selectedNodeId) {
      setFocusedDependencies(selectedNodeId);
    }
  }, [selectedNodeId, setFocusedDependencies]);

  if (!graph) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {/* Search */}
      <div style={{
        position: 'relative', flex: '0 1 200px', minWidth: 120,
      }}>
        <Search size={13} style={{
          position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} />
        <input
          type="text"
          placeholder="Search files..."
          value={filters.searchQuery}
          onChange={(e) => updateFilter({ searchQuery: e.target.value })}
          style={{
            width: '100%', background: 'var(--bg-primary)',
            border: '1px solid var(--border)', borderRadius: 6,
            padding: '5px 8px 5px 26px',
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--text-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      <ToolbarDivider />

      {/* Node type filter */}
      <div ref={typeRef} style={{ position: 'relative' }}>
        <ToolbarButton
          icon={<Filter size={13} />}
          label="Type"
          active={filters.nodeTypes.length < ALL_TYPES.length}
          onClick={() => setShowTypeMenu(!showTypeMenu)}
        />
        {showTypeMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 8, minWidth: 160, zIndex: 50,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
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
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '5px 8px', background: 'transparent',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    fontSize: 11, color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: active ? NODE_COLORS[type] : 'var(--border)',
                    transition: 'background 0.15s',
                  }} />
                  {TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Language filter */}
      {languages.length > 1 && (
        <select
          value={filters.language}
          onChange={(e) => updateFilter({ language: e.target.value })}
          style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 8px',
            color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}

      {/* Show/hide tests */}
      <ToolbarButton
        icon={filters.showTests ? <Eye size={13} /> : <EyeOff size={13} />}
        label="Tests"
        active={!filters.showTests}
        onClick={() => updateFilter({ showTests: !filters.showTests })}
      />

      <ToolbarDivider />

      {/* Layout mode */}
      <div ref={layoutRef} style={{ position: 'relative' }}>
        <ToolbarButton
          icon={<Layout size={13} />}
          label={LAYOUT_LABELS[layoutMode]}
          onClick={() => setShowLayoutMenu(!showLayoutMenu)}
        />
        {showLayoutMenu && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 4, minWidth: 130, zIndex: 50,
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          }}>
            {(Object.entries(LAYOUT_LABELS) as [LayoutMode, string][]).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => { setLayoutMode(mode); setShowLayoutMenu(false); }}
                style={{
                  display: 'block', width: '100%', padding: '6px 10px',
                  background: layoutMode === mode ? 'var(--accent-blue-bg)' : 'transparent',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  fontSize: 11, fontWeight: layoutMode === mode ? 600 : 400,
                  color: layoutMode === mode ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fit view */}
      <ToolbarButton
        icon={<Maximize2 size={13} />}
        label="Fit"
        onClick={() => {
          // Dispatched via custom event — GraphView listens
          window.dispatchEvent(new CustomEvent('graph:fitView'));
        }}
      />

      {/* Reset view */}
      <ToolbarButton
        icon={<RotateCcw size={13} />}
        label="Reset"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('graph:resetView'));
        }}
      />

      {/* Focus selected node dependencies */}
      <ToolbarButton
        icon={<Crosshair size={13} />}
        label="Focus"
        disabled={!selectedNodeId}
        active={selectedNodeId ? true : false}
        onClick={handleFocusNode}
      />

      <ToolbarDivider />

      {/* Legend toggle */}
      <ToolbarButton
        icon={<Info size={13} />}
        label="Legend"
        active={showLegend}
        onClick={toggleLegend}
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          style={{
            padding: '4px 8px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: 11, marginLeft: 'auto',
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-primary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return (
    <div style={{
      width: 1, height: 20, background: 'var(--border)', flexShrink: 0,
    }} />
  );
}

function ToolbarButton({
  icon, label, active, disabled, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', background: active ? 'var(--accent-blue-bg)' : 'transparent',
        border: `1px solid ${active ? 'rgba(37,99,235,0.15)' : 'transparent'}`,
        borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-muted)' : active ? 'var(--accent-blue)' : 'var(--text-secondary)',
        fontSize: 11, fontWeight: active ? 600 : 400,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
      onMouseOver={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--bg-secondary)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {icon} {label}
    </button>
  );
}

function GraphLegend() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 0',
    }}>
      {(Object.entries(NODE_COLORS) as [string, string][]).map(([type, color]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: color,
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
            {type.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}

export { GraphLegend };
