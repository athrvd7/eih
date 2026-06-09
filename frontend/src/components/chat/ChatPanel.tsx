import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { api } from '../../services/api';
import type { Citation } from '../../types';

function CitationChip({ citation }: { citation: Citation }) {
  return (
    <span
      title={`${citation.file_path}:${citation.start_line}-${citation.end_line}\n${citation.snippet}`}
      style={{
        display: 'inline-block', fontSize: 10, padding: '1px 6px',
        background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
        border: '1px solid rgba(37, 99, 235, 0.15)',
        borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)',
        marginLeft: 4, verticalAlign: 'middle',
      }}
    >
      {citation.file_path.split('/').pop()}:{citation.start_line}
    </span>
  );
}

export function ChatPanel({ jobId }: { jobId: string }) {
  const { messages, isOpen, isLoading, suggestions, toggleChat, addMessage, setLoading, setSuggestions } = useChatStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load suggestions on open
  useEffect(() => {
    if (isOpen && suggestions.length === 0) {
      api.chat.getSuggestions(jobId).then(data => setSuggestions(data.suggestions || [])).catch(() => {});
    }
  }, [isOpen, jobId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;
    setInput('');

    const userMsg = {
      role: 'user' as const,
      content: question.trim(),
      citations: [],
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setLoading(true);

    try {
      const response = await api.chat.send(jobId, question.trim());
      addMessage({
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        timestamp: new Date().toISOString(),
      });
      if (response.suggested_followups?.length) {
        setSuggestions(response.suggested_followups);
      }
    } catch (e: unknown) {
      addMessage({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${e instanceof Error ? e.message : String(e)}`,
        citations: [],
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0,
      width: 420, height: '70vh', maxHeight: 600,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderBottom: 'none', borderRight: 'none',
      borderTopLeftRadius: 12,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 -4px 30px rgba(0,0,0,0.06)',
      zIndex: 100,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-secondary)', borderTopLeftRadius: 12,
      }}>
        <MessageSquare size={16} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Ask about the codebase</span>
        <button onClick={toggleChat} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
            <MessageSquare size={28} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13, marginBottom: 16 }}>Ask anything about this codebase</p>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: '8px 12px', background: 'var(--bg-card)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12,
                      textAlign: 'left', transition: 'border-color 0.15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--text-primary)')}
                    onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
              background: msg.role === 'user' ? 'var(--text-primary)' : 'var(--bg-secondary)',
              color: msg.role === 'user' ? 'var(--bg-card)' : 'var(--text-primary)',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              {msg.citations.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {msg.citations.map((c, ci) => <CitationChip key={ci} citation={c} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Thinking...
          </div>
        )}

        {/* Suggested follow-ups after last message */}
        {messages.length > 0 && !isLoading && suggestions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {suggestions.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  display: 'block', width: '100%', marginBottom: 4,
                  padding: '6px 10px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
                  textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
          placeholder="Ask about the codebase..."
          disabled={isLoading}
          style={{
            flex: 1, padding: '8px 12px', background: 'var(--bg-primary)',
            border: '1px solid var(--border)', borderRadius: 8,
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--text-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '8px 12px',
            background: input.trim() && !isLoading ? 'var(--text-primary)' : 'var(--bg-secondary)',
            border: 'none', borderRadius: 8,
            color: input.trim() && !isLoading ? 'var(--bg-card)' : 'var(--text-muted)',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          <Send size={16} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
