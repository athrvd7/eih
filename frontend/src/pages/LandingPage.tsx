import { Link } from "react-router-dom";
import { ArrowUpRight, Play, Zap } from "lucide-react";
import { LandingNav } from "../components/landing/LandingNav";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { PipelineSection } from "../components/landing/PipelineSection";

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__hero-bg" aria-hidden="true" />
      <div className="landing__grid" aria-hidden="true" />

      <LandingNav />

      <main>
        <section className="hero">
          <div className="hero__inner">
            <p className="hero__eyebrow landing-reveal">
              <Zap size={14} strokeWidth={1.5} aria-hidden="true" />
              <span>Engineering Intelligence Hub</span>
            </p>

            <h1 className="hero__title landing-reveal landing-reveal--1">
              Understand
            </h1>

            <svg
              className="hero__wavy landing-reveal landing-reveal--2"
              viewBox="0 0 280 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 6C2 6 8 2 14 6C20 10 26 2 32 6C38 10 44 2 50 6C56 10 62 2 68 6C74 10 80 2 86 6C92 10 98 2 104 6C110 10 116 2 122 6C128 10 134 2 140 6C146 10 152 2 158 6C164 10 170 2 176 6C182 10 188 2 194 6C200 10 206 2 212 6C218 10 224 2 230 6C236 10 242 2 248 6C254 10 260 2 266 6C272 10 278 2 278 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <div className="hero__subtitle-line landing-reveal landing-reveal--3">
              <span className="hero__for">any</span>
              <span className="hero__creators-wrap">
                <span className="hero__creators">CODEBASE</span>
                <span className="hero__tooltip">AI-powered</span>
              </span>
            </div>

            <p className="hero__lede landing-reveal landing-reveal--4">
              Dependency graphs, guided walkthroughs, onboarding docs, and grounded chat —
              built from your source.
            </p>

            <div className="hero__buttons landing-reveal landing-reveal--5">
              <Link to="/analyze" className="hero__btn-primary">
                <span>Get started</span>
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
              <a href="#features" className="hero__btn-secondary">
                <span>Explore features</span>
                <Play size={14} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <div className="landing-content">
          <FeaturesSection />
          <PipelineSection />

          <footer className="landing-footer">
            <p>EIH — built for developers onboarding to unfamiliar codebases.</p>
          </footer>
        </div>
      </main>
    </div>
  );
}
