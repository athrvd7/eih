import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="landing-nav__inner">
        <Link to="/" className="landing-nav__brand">
          <span className="landing-nav__logo">
            <Zap size={18} strokeWidth={2.25} />
          </span>
          <span className="landing-nav__wordmark">
            EIH
            <span className="landing-nav__wordmark-sub">Engineering Intelligence Hub</span>
          </span>
        </Link>
        <nav className="landing-nav__links" aria-label="Primary">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/analyze" className="landing-nav__cta">
            Analyze a repo
          </Link>
        </nav>
      </div>
    </header>
  );
}
