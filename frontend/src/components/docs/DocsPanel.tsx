import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, FileText, Download, Copy, Edit, Check } from 'lucide-react';
import { api } from '../../services/api';
import type { OnboardingDoc, DocSection } from '../../types';

export function DocsPanel({ jobId }: { jobId: string }) {
  const [doc, setDoc] = useState<OnboardingDoc | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api.docs.get(jobId)
      .then(setDoc)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  const startEdit = (idx: number, section: DocSection) => {
    setEditingSectionIdx(idx);
    setEditContent(section.content);
  };

  const saveEdit = async () => {
    if (!doc || editingSectionIdx === null) return;
    const newSections = doc.sections.map((s, i) =>
      i === editingSectionIdx ? { ...s, content: editContent } : s
    );
    setIsSaving(true);
    try {
      await api.docs.update(jobId, newSections);
      setDoc({ ...doc, sections: newSections });
      setEditingSectionIdx(null);
    } catch (e: unknown) {
      alert('Failed to save: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  };

  const exportMarkdown = () => {
    if (!doc) return;
    const content = doc.sections.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.repo_name.replace('/', '_')}_onboarding.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = () => {
    if (!doc) return;
    const content = doc.sections.map(s => `# ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={24} style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13 }}>Generating documentation...</p>
        <p style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>This uses AI and may take 30–60 seconds</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--error)' }}>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)',
      }}>
        <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {doc.repo_name}
        </span>
        <button onClick={copyAll} style={btnStyle}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={exportMarkdown} style={btnStyle}>
          <Download size={12} /> Export .md
        </button>
      </div>

      {/* Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {doc.sections.map((section, idx) => (
          <div key={section.title} style={{
            marginBottom: 24, background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 16px', background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{section.title}</h3>
              {editingSectionIdx === idx ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingSectionIdx(null)} style={btnStyle}>Cancel</button>
                  <button onClick={saveEdit} disabled={isSaving} style={{ ...btnStyle, background: 'var(--text-primary)', border: 'none', color: 'var(--bg-card)' }}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button onClick={() => startEdit(idx, section)} style={btnStyle}>
                  <Edit size={11} /> Edit
                </button>
              )}
            </div>
            <div style={{ padding: 16 }}>
              {editingSectionIdx === idx ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  style={{
                    width: '100%', minHeight: 200, background: 'var(--bg-primary)',
                    border: '1px solid var(--border)', borderRadius: 4, padding: 10,
                    color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                  <ReactMarkdown
                    components={{
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-');
                        return isBlock ? (
                          <pre style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, overflow: 'auto', marginBottom: 12, border: '1px solid var(--border)' }}>
                            <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{children}</code>
                          </pre>
                        ) : (
                          <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{children}</code>
                        );
                      },
                      h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, marginTop: 16 }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, marginTop: 12 }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, marginTop: 8 }}>{children}</h3>,
                      p: ({ children }) => <p style={{ marginBottom: 10 }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ paddingLeft: 20, marginBottom: 10 }}>{children}</ul>,
                      li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                      strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>,
                    }}
                  >
                    {section.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};
