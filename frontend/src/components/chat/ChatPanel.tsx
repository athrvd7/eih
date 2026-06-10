import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, MessageSquare, Loader2, Minus, GripHorizontal } from 'lucide-react';
import { useChatStore } from '../../stores/useChatStore';
import { useUIStore } from '../../stores/useUIStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { api } from '../../services/api';
import type { Citation } from '../../types';

function CitationChip({ citation }: { citation: Citation }) {
  const handleClick = () => {
    // Highlight the cited file in the graph
    const { graph, setFocusedDependencies, selectNode } = useGraphStore.getState();
    if (!graph) return;
    const nodeId = graph.nodes.find(n => n.id === citation.file_path)?.id;
    if (nodeId) {
      selectNode(nodeId);
      setFocusedDependencies(nodeId);
    }
  };

  return (
    <span
      onClick={handleClick}
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

export function ChatDrawer({ jobId }: { jobId: string }) {
  const { messages, isLoading, suggestions, addMessage, setLoading, setSuggestions } = useChatStore();
  const { chatDrawerOpen, chatDrawerHeight, setChatDrawerOpen, setChatDrawerHeight } = useUIStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Load suggestions on open
  useEffect(() => {
    if (chatDrawerOpen && suggestions.length === 0) {
      api.chat.getSuggestions(jobId).then(data => setSuggestions(data.suggestions || [])).catch(() => {});
    }
  }, [chatDrawerOpen, jobId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Listen for questions from the Ask tab
  useEffect(() => {
    const handleAsk = (e: CustomEvent) => {
      const question = e.detail?.question;
      if (question) {
        setChatDrawerOpen(true);
        setTimeout(() => sendMessage(question), 100);
      }
    };
    window.addEventListener('chat:ask', handleAsk as EventListener);
    return () => window.removeEventListener('chat:ask', handleAsk as EventListener);
  }, [setChatDrawerOpen]);

  const sendMessage = useCallback(async (question: string) => {
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
  }, [jobId, isLoading, addMessage, setLoading, setSuggestions]);

  // Drag to resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = chatDrawerHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartY.current - e.clientY;
      setChatDrawerHeight(dragStartHeight.current + delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [chatDrawerHeight, setChatDrawerHeight]);

  if (!chatDrawerOpen) {
    return (
      <button
        onClick={() => setChatDrawerOpen(true)}
        style={{
          position: 'fixed', bottom: 16, right: 16,
          padding: '10px 16px', background: 'var(--text-primary)',
          border: 'none', borderRadius: 10,
          color: 'var(--bg-card)', cursor: 'pointer',
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 50, transition: 'all 0.15s',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-light)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'var(--text-primary)')}
      >
        <MessageSquare size={16} /> Ask about the codebase
      </button>
    );
  }

  return (
    <div style={{
      height: chatDrawerHeight,
      minHeight: 150,
      maxHeight: 600,
      background: 'var(--bg-card)',
      borderTop: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute', top: -3, left: 0, right: 0,
          height: 6, cursor: 'row-resize', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 32, height: 3, borderRadius: 2,
          background: 'var(--border)',
        }} />
      </div>

      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <MessageSquare size={14} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          Ask about the codebase
        </span>
        {messages.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {messages.length} messages
          </span>
        )}
        <button
          onClick={() => setChatDrawerOpen(false)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: 4,
          }}
        >
          <Minus size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px 0' }}>
            <MessageSquare size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p style={{ fontSize: 12, marginBottom: 12 }}>Ask anything about this codebase</p>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: '6px 10px', background: 'var(--bg-card)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11,
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
            marginBottom: 12,
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '2px 10px 10px 10px',
              background: msg.role === 'user' ? 'var(--text-primary)' : 'var(--bg-secondary)',
              color: msg.role === 'user' ? 'var(--bg-card)' : 'var(--text-primary)',
              fontSize: 12, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
              {msg.citations.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {msg.citations.map((c, ci) => <CitationChip key={ci} citation={c} />)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            Thinking...
          </div>
        )}

        {messages.length > 0 && !isLoading && suggestions.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {suggestions.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                style={{
                  display: 'block', width: '100%', marginBottom: 3,
                  padding: '5px 8px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11,
                  textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(input))}
          placeholder="Ask about the codebase..."
          disabled={isLoading}
          style={{
            flex: 1, padding: '7px 10px', background: 'var(--bg-primary)',
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--text-primary)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '7px 10px',
            background: input.trim() && !isLoading ? 'var(--text-primary)' : 'var(--bg-secondary)',
            border: 'none', borderRadius: 6,
            color: input.trim() && !isLoading ? 'var(--bg-card)' : 'var(--text-muted)',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          <Send size={14} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
