import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, FileText, MessageSquare, Menu,
  ChevronLeft, GitBranch, Loader2, X, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { GraphView } from '../components/graph/GraphView';
import { NodeDetailsPanel } from '../components/graph/NodeDetailsPanel';
import { FileExplorer } from '../components/graph/FileExplorer';
import { WalkthroughPanel } from '../components/walkthrough/WalkthroughPanel';
import { DocsPanel } from '../components/docs/DocsPanel';
import { ChatDrawer } from '../components/chat/ChatPanel';
import { useJobStore } from '../stores/useJobStore';
import { useGraphStore } from '../stores/useGraphStore';
import { useUIStore } from '../stores/useUIStore';
import { useSSE } from '../hooks/useSSE';
import { api } from '../services/api';
import type { SSEEvent } from '../types';

const STAGES = [
  { key: 'ingesting', label: 'Ingesting' },
  { key: 'chunking', label: 'Chunking' },
  { key: 'embedding', label: 'Embedding' },
  { key: 'graphing', label: 'Graphing' },
  { key: 'ready', label: 'Ready' },
];

function ProgressOverlay({ currentStage, progress, message }: { currentStage: string; progress: number; message: string }) {
  const stageIdx = STAGES.findIndex(s => currentStage?.toLowerCase().includes(s.key));

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(250, 250, 250, 0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 40, maxWidth: 440, width: '90%',
        textAlign: 'center',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-bg)', border: '2px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <Loader2 size={24} style={{ color: 'var(--text-primary)', animation: 'spin 1s linear infinite' }} />
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          Analyzing Repository
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          {message || 'Processing...'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {STAGES.slice(0, 4).map((stage, idx) => (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: idx < stageIdx ? 'var(--success)' : idx === stageIdx ? 'var(--text-primary)' : 'var(--bg-secondary)',
                border: `2px solid ${idx < stageIdx ? 'var(--success)' : idx === stageIdx ? 'var(--text-primary)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: idx <= stageIdx ? 'var(--bg-card)' : 'var(--text-muted)',
                fontWeight: 700, transition: 'all 0.3s ease',
              }}>
                {idx < stageIdx ? '\u2713' : idx + 1}
              </div>
              <span style={{
                fontSize: 9,
                color: idx <= stageIdx ? 'var(--text-secondary)' : 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
                {stage.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'var(--text-primary)',
            borderRadius: 4, transition: 'width 0.3s ease',
            width: `${Math.max(5, progress * 100)}%`,
          }} />
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const isDragging = { current: false } as { current: boolean };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    const startX = e.clientX;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      onResize(e.clientX - startX);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4, cursor: 'col-resize', flexShrink: 0,
        background: 'var(--border)',
        transition: 'background 0.15s',
        position: 'relative',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--text-muted)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'var(--border)')}
    />
  );
}

export function WorkspacePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { jobStatus, handleSSEEvent, setJobStatus } = useJobStore();
  const { graph, setGraph, setIsLoadingGraph, setGraphError, graphError } = useGraphStore();
  const { rightPanel, setRightPanel, isLeftSidebarOpen, toggleLeftSidebar, sidebarWidth, setSidebarWidth, chatDrawerOpen } = useUIStore();
  const [isProcessing, setIsProcessing] = useState(true);
  const [latestProgress, setLatestProgress] = useState(0);
  const [latestMessage, setLatestMessage] = useState('Initializing...');
  const [latestStage, setLatestStage] = useState('');

  const onSSEEvent = useCallback((event: SSEEvent) => {
    handleSSEEvent(event);
    setLatestStage(event.stage || '');
    if (event.progress !== undefined) setLatestProgress(event.progress);
    if (event.message) setLatestMessage(event.message);

    if ((event.status === 'complete' && event.stage === 'pipeline') || event.status === 'done') {
      setIsProcessing(false);
    }
    if (event.status === 'failed') {
      setIsProcessing(false);
    }
  }, [handleSSEEvent]);

  useSSE(jobId || null, { onEvent: onSSEEvent, enabled: isProcessing });

  // Check initial job status
  useEffect(() => {
    if (!jobId) return;
    api.jobs.get(jobId).then(status => {
      setJobStatus(status);
      if (status.status === 'ready') {
        setIsProcessing(false);
      } else if (status.status === 'failed') {
        setIsProcessing(false);
        setLatestMessage(status.error || 'Pipeline failed');
      }
    }).catch(console.error);
  }, [jobId]);

  // Load graph when ready
  useEffect(() => {
    if (!isProcessing && jobId && !graph) {
      setIsLoadingGraph(true);
      setGraphError(null);
      api.graph.get(jobId)
        .then(data => setGraph(data))
        .catch(err => {
          console.error('Failed to load graph:', err);
          setGraphError(err.message || 'Failed to load graph');
        })
        .finally(() => setIsLoadingGraph(false));
    }
  }, [isProcessing, jobId]);

  if (!jobId) return <div>Invalid job</div>;

  const repoName = jobStatus?.repo_name || 'Repository';

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary)', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        height: 44, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
        flexShrink: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/analyze')}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={toggleLeftSidebar}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: 4, display: 'flex',
          }}
          title={isLeftSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {isLeftSidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>

        <GitBranch size={13} style={{ color: 'var(--accent-blue)' }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {repoName}
        </span>

        {/* View switcher */}
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { id: 'node-details' as const, icon: LayoutDashboard, label: 'Details' },
            { id: 'walkthrough' as const, icon: BookOpen, label: 'Walkthrough' },
            { id: 'docs' as const, icon: FileText, label: 'Docs' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setRightPanel(rightPanel === id ? null : id)}
              style={{
                padding: '4px 8px', borderRadius: 5,
                background: rightPanel === id ? 'var(--bg-secondary)' : 'transparent',
                border: `1px solid ${rightPanel === id ? 'var(--border)' : 'transparent'}`,
                color: rightPanel === id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar — File Explorer */}
        {isLeftSidebarOpen && (
          <>
            <div style={{
              width: sidebarWidth, flexShrink: 0,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              borderRight: '1px solid var(--border)',
            }}>
              <FileExplorer jobId={jobId} />
            </div>
            <ResizeHandle onResize={(delta) => setSidebarWidth(sidebarWidth + delta)} />
          </>
        )}

        {/* Center — Graph Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <GraphView jobId={jobId} />

          {/* Processing overlay */}
          {isProcessing && (
            <ProgressOverlay
              currentStage={latestStage}
              progress={latestProgress}
              message={latestMessage}
            />
          )}
        </div>

        {/* Right panel — Inspector */}
        {rightPanel && (
          <>
            <ResizeHandle onResize={(delta) => {
              // For right panel, dragging left increases width
            }} />
            <div style={{
              width: 340, flexShrink: 0,
              background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '8px 12px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-secondary)', flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {rightPanel === 'node-details' ? 'Inspector' : rightPanel === 'walkthrough' ? 'Walkthrough' : 'Onboarding Docs'}
                </span>
                <button
                  onClick={() => setRightPanel(null)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {rightPanel === 'node-details' && <NodeDetailsPanel jobId={jobId} />}
                {rightPanel === 'walkthrough' && !isProcessing && <WalkthroughPanel jobId={jobId} />}
                {rightPanel === 'docs' && !isProcessing && <DocsPanel jobId={jobId} />}
                {rightPanel !== 'node-details' && isProcessing && (
                  <div style={{
                    padding: 24, color: 'var(--text-secondary)',
                    textAlign: 'center', fontSize: 13,
                  }}>
                    <Loader2 size={20} style={{ marginBottom: 8, animation: 'spin 1s linear infinite' }} />
                    <p>Waiting for pipeline to complete...</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat drawer — bottom */}
      {!isProcessing && <ChatDrawer jobId={jobId} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
