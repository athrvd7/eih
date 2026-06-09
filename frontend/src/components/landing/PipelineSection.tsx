import { ArrowDown } from "lucide-react";

const AGENTS = [
  { name: "INGESTOR", role: "Clone, extract & filter files", parallel: false },
  { name: "CHUNKER", role: "tree-sitter AST chunking", parallel: false },
  { name: "EMBEDDER", role: "Gemini embeddings → ChromaDB", parallel: true },
  { name: "GRAPHER", role: "Import/export dependency graph", parallel: true },
  { name: "NARRATOR", role: "Guided walkthrough (on demand)", parallel: false, lazy: true },
  { name: "SCRIBE", role: "Onboarding documentation (on demand)", parallel: false, lazy: true },
  { name: "RETRIEVER", role: "RAG chat per message", parallel: false, lazy: true },
];

export function PipelineSection() {
  return (
    <section className="landing-section landing-section--pipeline" id="how-it-works">
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

      <div className="pipeline">
        <div className="pipeline__track">
          {AGENTS.map((agent, i) => (
            <div key={agent.name} className="pipeline__step" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`pipeline__card${agent.lazy ? " pipeline__card--lazy" : ""}`}>
                <div className="pipeline__card-top">
                  <span className="pipeline__name">{agent.name}</span>
                  {agent.parallel && <span className="pipeline__badge">parallel</span>}
                  {agent.lazy && <span className="pipeline__badge pipeline__badge--lazy">lazy</span>}
                </div>
                <p className="pipeline__role">{agent.role}</p>
              </div>
              {i < AGENTS.length - 1 && (
                <div className="pipeline__connector" aria-hidden="true">
                  <ArrowDown size={14} />
                </div>
              )}
            </div>
          ))}
        </div>

        <aside className="pipeline__aside">
          <div className="pipeline__stat">
            <span className="pipeline__stat-value">7</span>
            <span className="pipeline__stat-label">specialized agents</span>
          </div>
          <div className="pipeline__stat">
            <span className="pipeline__stat-value">768</span>
            <span className="pipeline__stat-label">dim embeddings</span>
          </div>
          <div className="pipeline__stat">
            <span className="pipeline__stat-value">SSE</span>
            <span className="pipeline__stat-label">live progress stream</span>
          </div>
          <p className="pipeline__note">
            NARRATOR, SCRIBE, and RETRIEVER activate only when you open walkthrough, docs, or chat —
            saving API quota during ingestion.
          </p>
        </aside>
      </div>
    </section>
  );
}
