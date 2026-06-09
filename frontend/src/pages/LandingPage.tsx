import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LandingNav } from "../components/landing/LandingNav";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { PipelineSection } from "../components/landing/PipelineSection";

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__mesh" />
      </div>

      <LandingNav />

      <main>
        <section className="hero">
          <div className="hero__inner">
            <p className="hero__eyebrow landing-reveal">Engineering Intelligence Hub</p>

            <h1 className="hero__display landing-reveal landing-reveal--1">
              <span className="hero__line">Understand</span>
              <span className="hero__line hero__line--accent">any codebase</span>
            </h1>

            <p className="hero__lede landing-reveal landing-reveal--2">
              Dependency graphs, guided walkthroughs, onboarding docs, and grounded chat —
              built from your source.
            </p>

            <Link to="/analyze" className="hero__cta landing-reveal landing-reveal--3">
              <span>Get started</span>
              <ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <FeaturesSection />
        <PipelineSection />
      </main>

      <footer className="landing-footer">
        <p>Engineering Intelligence Hub — built for developers onboarding to unfamiliar codebases.</p>
      </footer>
    </div>
  );
}
