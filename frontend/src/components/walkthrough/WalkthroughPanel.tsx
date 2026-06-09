import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, BookOpen } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import { atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useGraphStore } from '../../stores/useGraphStore';
import { api } from '../../services/api';
import type { Walkthrough } from '../../types';

SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);

const LANG_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  tsx: 'typescript',
};

export function WalkthroughPanel({ jobId }: { jobId: string }) {
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setHighlightedNodes } = useGraphStore();

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api.walkthrough.get(jobId)
      .then(data => {
        setWalkthrough(data);
        if (data.steps?.[0]) {
          setHighlightedNodes(data.steps[0].graph_node_ids);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  const goToStep = (idx: number) => {
    setCurrentStep(idx);
    if (walkthrough?.steps[idx]) {
      setHighlightedNodes(walkthrough.steps[idx].graph_node_ids);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={24} style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13 }}>Generating walkthrough...</p>
        <p style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>This uses AI and may take 30–60 seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--error)' }}>
        <p style={{ fontSize: 13, marginBottom: 8 }}>Failed to generate walkthrough</p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, padding: '6px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!walkthrough || walkthrough.steps.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <BookOpen size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>No walkthrough available</p>
      </div>
    );
  }

  const step = walkthrough.steps[currentStep];
  const ext = step.file_path.split('.').pop() || '';
  const language = LANG_MAP[ext] || ext || 'text';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Step navigator */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Step {currentStep + 1} of {walkthrough.total_steps}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => goToStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              style={{
                padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 4, color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentStep === 0 ? 'default' : 'pointer', fontSize: 12,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => goToStep(Math.min(walkthrough.total_steps - 1, currentStep + 1))}
              disabled={currentStep === walkthrough.total_steps - 1}
              style={{
                padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 4, color: currentStep === walkthrough.total_steps - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: currentStep === walkthrough.total_steps - 1 ? 'default' : 'pointer', fontSize: 12,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {walkthrough.steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToStep(idx)}
              style={{
                width: idx === currentStep ? 20 : 8,
                height: 6,
                borderRadius: 3,
                background: idx === currentStep ? 'var(--text-primary)' : 'var(--border)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{step.title}</h3>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>{step.file_path}</div>

        {/* Concepts */}
        {step.concepts.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
            {step.concepts.map(c => (
              <span key={c} style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 12,
                background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 500,
              }}>
                {c}
              </span>
            ))}
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {step.explanation}
        </p>

        {/* Code snippet */}
        {step.code_snippet && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              KEY SNIPPET (lines {step.snippet_start_line}–{step.snippet_end_line})
            </div>
            <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <SyntaxHighlighter
                language={language}
                style={atomOneLight}
                customStyle={{ margin: 0, fontSize: 11, background: 'var(--bg-primary)' }}
                showLineNumbers
                startingLineNumber={step.snippet_start_line}
              >
                {step.code_snippet}
              </SyntaxHighlighter>
            </div>
          </div>
        )}

        {/* Related files */}
        {step.related_files.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              RELATED FILES
            </div>
            {step.related_files.map(f => (
              <div key={f} style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>{f}</div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
