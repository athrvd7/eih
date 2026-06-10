import { ArrowDown, Cpu, Database, FileCode, GitBranch, MessageSquareText, Pencil, Search } from "lucide-react";

const AGENTS = [
  { name: "INGESTOR", role: "Clone, extract & filter files", icon: GitBranch, parallel: false },
  { name: "CHUNKER", role: "tree-sitter AST chunking", icon: FileCode, parallel: false },
  { name: "EMBEDDER", role: "Gemini embeddings → ChromaDB", icon: Database, parallel: true },
  { name: "GRAPHER", role: "Import/export dependency graph", icon: Cpu, parallel: true },
  { name: "NARRATOR", role: "Guided walkthrough (on demand)", icon: MessageSquareText, parallel: false, lazy: true },
  { name: "SCRIBE", role: "Onboarding documentation (on demand)", icon: Pencil, parallel: false, lazy: true },
  { name: "RETRIEVER", role: "RAG chat per message", icon: Search, parallel: false, lazy: true },
];

export function PipelineSection() {
  return (
    <section className="landing-section" id="how-it-works">
      <div className="landing-section__header">
        <p className="landing-eyebrow">Architecture</p>
        <h2 className="landing-section__title">
          A multi-agent pipeline, <em>orchestrated</em>
        </h2>
        <p className="landing-section__desc">
          Seven specialized agents run sequentially (with parallel embed + graph stages).
          Progress streams live via SSE while you wait.
        </p>
      </div>

      <div className="pipeline-bento">
        {AGENTS.map((agent, i) => (
          <div
            key={agent.name}
            className={`pipeline-bento__card ${agent.lazy ? "" : ""}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div className="bento-card__icon" style={{ width: "36px", height: "36px" }}>
                <agent.icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div>
                <span className="pipeline-bento__name">{agent.name}</span>
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  {agent.parallel && (
                    <span className="pipeline-bento__badge">parallel</span>
                  )}
                  {agent.lazy && (
                    <span className="pipeline-bento__badge pipeline-bento__badge--lazy">lazy</span>
                  )}
                </div>
              </div>
            </div>
            <p className="pipeline-bento__role">{agent.role}</p>
          </div>
        ))}

        <div className="pipeline-bento__card pipeline-bento__card--stat" style={{ animationDelay: "420ms" }}>
          <div className="pipeline-bento__stat">
            <span className="pipeline-bento__stat-value">7</span>
            <span className="pipeline-bento__stat-label">specialized agents</span>
          </div>
          <div className="pipeline-bento__stat">
            <span className="pipeline-bento__stat-value">768</span>
            <span className="pipeline-bento__stat-label">dim embeddings</span>
          </div>
          <div className="pipeline-bento__stat">
            <span className="pipeline-bento__stat-value">SSE</span>
            <span className="pipeline-bento__stat-label">live progress stream</span>
          </div>
        </div>

        <div className="pipeline-bento__card pipeline-bento__card--highlight" style={{ animationDelay: "480ms" }}>
          <p className="pipeline-bento__role" style={{ fontSize: "15px", lineHeight: "1.6" }}>
            <strong style={{ color: "var(--text-primary)" }}>Lazy loading by design.</strong>{" "}
            NARRATOR, SCRIBE, and RETRIEVER activate only when you open walkthrough, docs, or chat —
            saving API quota during ingestion.
          </p>
        </div>
      </div>
    </section>
  );
}
