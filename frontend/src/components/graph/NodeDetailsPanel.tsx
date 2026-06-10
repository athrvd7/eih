import { useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  Loader2, ArrowRight, ArrowLeft, Code, FileCode, Copy,
  Crosshair, MessageSquare, BookOpen, Check,
} from 'lucide-react';
import { useGraphStore } from '../../stores/useGraphStore';
import { useUIStore } from '../../stores/useUIStore';
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

type InspectorTab = 'overview' | 'connections' | 'code' | 'ask';

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'connections', label: 'Connections' },
  { id: 'code', label: 'Code' },
  { id: 'ask', label: 'Ask' },
];

export function NodeDetailsPanel({ jobId }: { jobId: string }) {
  const { selectedNodeDetails, isLoadingNodeDetails, selectedNodeId, graph } = useGraphStore();
  const { inspectorActiveTab, setInspectorActiveTab } = useUIStore();
  const [copiedPath, setCopiedPath] = useState(false);

  const activeTab = inspectorActiveTab as InspectorTab;

  if (!selectedNodeId) {
    return (
      <div style={{
        padding: 32, color: 'var(--text-secondary)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <FileCode size={32} style={{ opacity: 0.3 }} />
        <p style={{ fontSize: 13 }}>Click a node to inspect it</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Use arrow keys to navigate connected nodes
        </p>
      </div>
    );
  }

  if (isLoadingNodeDetails) {
    return (
      <div style={{
        padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text-secondary)',
      }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading details...</span>
      </div>
    );
  }

  if (!selectedNodeDetails) return null;

  const { node, dependencies, dependents, code_snippet, file_path } = selectedNodeDetails;
  const color = NODE_COLORS[node.type as NodeType] || '#94a3b8';
  const language = LANG_MAP[node.language] || 'text';

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(file_path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 1500);
    } catch {}
  };

  const handleFocusInGraph = () => {
    const { setFocusedDependencies } = useGraphStore.getState();
    setFocusedDependencies(selectedNodeId);
    window.dispatchEvent(new CustomEvent('graph:fitView'));
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      {/* Header */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </span>
        </div>
        <div style={{
          color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)',
          wordBreak: 'break-all', marginBottom: 8,
        }}>
          {file_path}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 10,
            background: `${color}15`, color, fontWeight: 500,
          }}>
            {node.type.replace('_', ' ')}
          </span>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 10,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          }}>
            {node.language}
          </span>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 10,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
          }}>
            {node.lines_of_code} lines
          </span>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <ActionButton
            icon={copiedPath ? <Check size={11} /> : <Copy size={11} />}
            label={copiedPath ? 'Copied' : 'Copy path'}
            onClick={handleCopyPath}
          />
          <ActionButton
            icon={<Crosshair size={11} />}
            label="Focus"
            onClick={handleFocusInGraph}
          />
          <ActionButton
            icon={<MessageSquare size={11} />}
            label="Ask"
            onClick={() => setInspectorActiveTab('ask')}
          />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInspectorActiveTab(tab.id)}
            style={{
              flex: 1, padding: '8px 4px', background: 'transparent',
              border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--text-primary)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <OverviewTab node={node} file_path={file_path} color={color} />
        )}
        {activeTab === 'connections' && (
          <ConnectionsTab
            dependencies={dependencies}
            dependents={dependents}
            node={node}
            graph={graph}
          />
        )}
        {activeTab === 'code' && (
          <CodeTab code_snippet={code_snippet} language={language} file_path={file_path} />
        )}
        {activeTab === 'ask' && (
          <AskTab node={node} jobId={jobId} />
        )}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        padding: '3px 7px', background: 'transparent',
        border: '1px solid var(--border)', borderRadius: 5,
        color: 'var(--text-secondary)', cursor: 'pointer',
        fontSize: 10, transition: 'all 0.15s',
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
      {icon} {label}
    </button>
  );
}

function OverviewTab({ node, file_path, color }: { node: any; file_path: string; color: string }) {
  return (
    <div style={{ padding: 12 }}>
      {node.summary ? (
        <div>
          <SectionLabel>AI Summary</SectionLabel>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 12 }}>
            {node.summary}
          </p>
        </div>
      ) : (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
          No AI summary available for this file
        </div>
      )}
    </div>
  );
}

function ConnectionsTab({
  dependencies, dependents, node, graph,
}: {
  dependencies: string[];
  dependents: string[];
  node: any;
  graph: any;
}) {
  const totalDeps = dependencies.length;
  const totalDependents = dependents.length;
  const isConnectedToEntryPoint = graph?.entry_points?.some(
    (ep: string) => dependencies.includes(ep) || node.id === ep
  );

  return (
    <div style={{ padding: 12 }}>
      {/* Connection summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16,
      }}>
        <StatBox label="Imports" value={totalDeps} />
        <StatBox label="Imported by" value={totalDependents} />
      </div>

      {isConnectedToEntryPoint && (
        <div style={{
          padding: '6px 10px', background: `${NODE_COLORS.entry_point}10`,
          border: `1px solid ${NODE_COLORS.entry_point}20`, borderRadius: 6,
          fontSize: 11, color: NODE_COLORS.entry_point, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: NODE_COLORS.entry_point }} />
          Connected to entry point
        </div>
      )}

      {dependencies.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel>
            <ArrowRight size={10} /> Imports ({dependencies.length})
          </SectionLabel>
          {dependencies.map((dep) => (
            <DependencyItem key={dep} path={dep} graph={graph} />
          ))}
        </div>
      )}

      {dependents.length > 0 && (
        <div>
          <SectionLabel>
            <ArrowLeft size={10} /> Imported by ({dependents.length})
          </SectionLabel>
          {dependents.map((dep) => (
            <DependencyItem key={dep} path={dep} graph={graph} />
          ))}
        </div>
      )}

      {dependencies.length === 0 && dependents.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
          No connections found
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: '8px 10px', background: 'var(--bg-primary)',
      border: '1px solid var(--border)', borderRadius: 6,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function DependencyItem({ path, graph }: { path: string; graph: any }) {
  const node = graph?.nodes?.find((n: any) => n.id === path);
  const color = node ? NODE_COLORS[node.type] || '#94a3b8' : '#94a3b8';
  const label = path.split('/').pop() || path;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 0', fontSize: 11,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{
        fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {label}
      </span>
      {node && (
        <span style={{
          fontSize: 8, padding: '0 4px', borderRadius: 3,
          background: `${color}15`, color, fontWeight: 600,
        }}>
          {node.type.replace('_', ' ')}
        </span>
      )}
    </div>
  );
}

function CodeTab({ code_snippet, language, file_path }: { code_snippet: string; language: string; file_path: string }) {
  if (!code_snippet) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center', fontSize: 12 }}>
        No code preview available
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <SyntaxHighlighter
          language={language}
          style={atomOneLight}
          customStyle={{ margin: 0, fontSize: 11, maxHeight: 500, background: 'var(--bg-primary)' }}
          showLineNumbers
        >
          {code_snippet.slice(0, 3000)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function AskTab({ node, jobId }: { node: any; jobId: string }) {
  const suggestedQuestions = [
    `Explain what ${node.label} does`,
    `What files depend on ${node.label}?`,
    `How is ${node.label} used in the codebase?`,
  ];

  const handleAskQuestion = (question: string) => {
    // Navigate to chat with the question pre-filled
    const { setChatDrawerOpen } = useUIStore.getState();
    setChatDrawerOpen(true);
    // Store the question to be sent
    sessionStorage.setItem('eih-pending-question', question);
    window.dispatchEvent(new CustomEvent('chat:ask', { detail: { question } }));
  };

  return (
    <div style={{ padding: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        Ask questions about this file:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            onClick={() => handleAskQuestion(q)}
            style={{
              padding: '8px 12px', background: 'var(--bg-primary)',
              border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: 12, textAlign: 'left', transition: 'all 0.15s',
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
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {children}
    </div>
  );
}
