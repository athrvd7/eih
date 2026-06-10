import { Network, Route, FileText, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Network,
    title: "Dependency graph",
    description:
      "Interactive file-level graph built from import analysis. Click any node for context and AI summaries.",
    meta: "Visual exploration",
    large: true,
  },
  {
    icon: Route,
    title: "Guided walkthrough",
    description:
      "An ordered tour from entry points through core services — generated lazily when you need it.",
    meta: "On demand",
    large: false,
  },
  {
    icon: FileText,
    title: "Onboarding docs",
    description:
      "Purpose, tech stack, architecture, and setup guide tailored to the repo — editable and exportable.",
    meta: "Auto-generated",
    large: false,
  },
  {
    icon: MessageSquare,
    title: "RAG chat",
    description:
      "Ask questions grounded in your codebase with inline citations linking back to source lines.",
    meta: "Grounded AI",
    large: true,
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

      <div className="bento-grid bento-grid--features">
        {FEATURES.map((feature, i) => (
          <article
            key={feature.title}
            className={`bento-card ${feature.large ? "bento-card--large" : ""}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="bento-card__icon">
              <feature.icon size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h3 className="bento-card__title">{feature.title}</h3>
            <p className="bento-card__desc">{feature.description}</p>
            <span className="bento-card__meta">{feature.meta}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
