import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Loader2, ArrowRight, ArrowLeft, Code, FileCode } from 'lucide-react';
import { useGraphStore } from '../../stores/useGraphStore';
import { NODE_COLORS } from '../../lib/graphLayout';
import type { NodeType } from '../../types';

SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);

const LANG_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  tsx: 'typescript',
  markdown: 'markdown',
};

export function NodeDetailsPanel() {
  const { selectedNodeDetails, isLoadingNodeDetails, selectedNodeId } = useGraphStore();

  if (!selectedNodeId) {
    return (
      <div style={{ padding: 24, color: 'var(--text-secondary)', textAlign: 'center' }}>
        <FileCode size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>Click a node to see details</p>
      </div>
    );
  }

  if (isLoadingNodeDetails) {
    return (
      <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-secondary)' }}>
        <Loader2 size={18} className="animate-spin" />
        <span>Loading details...</span>
      </div>
    );
  }

  if (!selectedNodeDetails) return null;

  const { node, dependencies, dependents, code_snippet, file_path } = selectedNodeDetails;
  const color = NODE_COLORS[node.type as NodeType] || '#94a3b8';
  const language = LANG_MAP[node.language] || 'text';

  return (
    <div style={{ height: '100%', overflowY: 'auto', fontSize: 13 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{node.label}</span>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {file_path}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 12,
            background: `${color}15`, color, fontWeight: 500,
          }}>
            {node.type.replace('_', ' ')}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 12,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          }}>
            {node.language}
          </span>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 12,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          }}>
            {node.lines_of_code} lines
          </span>
        </div>
      </div>

      {/* AI Summary */}
      {node.summary && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI SUMMARY
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{node.summary}</p>
        </div>
      )}

      {/* Dependencies */}
      {(dependencies.length > 0 || dependents.length > 0) && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          {dependencies.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowRight size={10} /> IMPORTS ({dependencies.length})
              </div>
              {dependencies.slice(0, 8).map(dep => (
                <div key={dep} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dep}
                </div>
              ))}
            </div>
          )}
          {dependents.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ArrowLeft size={10} /> IMPORTED BY ({dependents.length})
              </div>
              {dependents.slice(0, 8).map(dep => (
                <div key={dep} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dep}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code snippet */}
      {code_snippet && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Code size={10} /> CODE PREVIEW
          </div>
          <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <SyntaxHighlighter
              language={language}
              style={atomOneLight}
              customStyle={{ margin: 0, fontSize: 11, maxHeight: 400, background: 'var(--bg-primary)' }}
              showLineNumbers
            >
              {code_snippet.slice(0, 2000)}
            </SyntaxHighlighter>
          </div>
        </div>
      )}
    </div>
  );
}
