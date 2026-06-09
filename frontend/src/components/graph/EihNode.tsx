import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_COLORS } from '../../lib/graphLayout';
import type { NodeType } from '../../types';

interface EihNodeData {
  label: string;
  nodeType: NodeType;
  language: string;
  loc: number;
  isEntryPoint: boolean;
  summary?: string;
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

interface EihNodeProps {
  data: EihNodeData;
  selected: boolean;
}

const LANG_BADGE: Record<string, string> = {
  python: 'py',
  typescript: 'ts',
  javascript: 'js',
  tsx: 'tsx',
  markdown: 'md',
};

function EihNode({ data, selected }: EihNodeProps) {
  const color = NODE_COLORS[data.nodeType] || '#94a3b8';
  const opacity = data.isDimmed ? 0.2 : 1;

  return (
    <div
      style={{
        opacity,
        background: selected ? 'var(--bg-tertiary)' : 'var(--bg-card)',
        border: `1px solid ${selected ? color : data.isHighlighted ? color : 'var(--border)'}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 140,
        maxWidth: 180,
        boxShadow: selected ? `0 4px 12px ${color}25` : '0 2px 8px rgba(0,0,0,0.02)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--border)', width: 6, height: 6 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{
          fontSize: 9,
          padding: '1px 5px',
          background: `${color}15`,
          color: color,
          borderRadius: 4,
          fontWeight: 600,
          textTransform: 'uppercase',
        }}>
          {data.nodeType.replace('_', ' ')}
        </span>
        {LANG_BADGE[data.language] && (
          <span style={{
            fontSize: 9,
            padding: '1px 5px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            borderRadius: 4,
          }}>
            {LANG_BADGE[data.language]}
          </span>
        )}
        <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>{data.loc}L</span>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: 'var(--border)', width: 6, height: 6 }} />
    </div>
  );
}

export default memo(EihNode);
