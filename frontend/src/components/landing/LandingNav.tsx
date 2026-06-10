import { Link } from "react-router-dom";
import { ArrowUpRight, Zap } from "lucide-react";

export function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="landing-nav__inner">
        <Link to="/" className="landing-nav__logo">
          <Zap size={18} strokeWidth={2.25} />
        </Link>

        <nav className="landing-nav__center" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>

        <div className="landing-nav__right">
          <Link to="/analyze" className="landing-nav__cta">
            <span>Get started</span>
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
