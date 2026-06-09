import { Network, Route, FileText, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Network,
    title: "Dependency graph",
    description:
      "Interactive file-level graph built from import analysis. Click any node for context and AI summaries.",
    accent: "var(--node-component)",
  },
  {
    icon: Route,
    title: "Guided walkthrough",
    description:
      "An ordered tour from entry points through core services — generated lazily when you need it.",
    accent: "var(--node-entry)",
  },
  {
    icon: FileText,
    title: "Onboarding docs",
    description:
      "Purpose, tech stack, architecture, and setup guide tailored to the repo — editable and exportable.",
    accent: "var(--node-config)",
  },
  {
    icon: MessageSquare,
    title: "RAG chat",
    description:
      "Ask questions grounded in your codebase with inline citations linking back to source lines.",
    accent: "var(--accent-blue)",
  },
];

export function FeaturesSection() {
  return (
    <section className="landing-section" id="features">
      <div className="landing-section__header">
        <p className="landing-eyebrow">What you get</p>
        <h2 className="landing-section__title">
          Four lenses on <em>one</em> codebase
        </h2>
        <p className="landing-section__desc">
          EIH ingests source files, chunks them with tree-sitter, embeds into ChromaDB, and
          maps dependencies — then surfaces everything through a single workspace.
        </p>
      </div>

      <div className="features-grid">
        {FEATURES.map((feature, i) => (
          <article
            key={feature.title}
            className="feature-card"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div
              className="feature-card__icon"
              style={{ color: feature.accent, borderColor: feature.accent }}
            >
              <feature.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="feature-card__title">{feature.title}</h3>
            <p className="feature-card__desc">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
