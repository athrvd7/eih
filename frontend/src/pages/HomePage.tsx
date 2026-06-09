import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Upload, Loader2, ArrowRight, Zap } from "lucide-react";
import { api } from "../services/api";
import { useJobStore } from "../stores/useJobStore";

const QUICK_START_REPOS = [
  { owner: "fastapi", repo: "fastapi", desc: "Modern Python web framework" },
  {
    owner: "tiangolo",
    repo: "full-stack-fastapi-template",
    desc: "Full-stack template",
  },
  { owner: "pallets", repo: "flask", desc: "Lightweight Python web framework" },
  { owner: "django", repo: "django", desc: "High-level Python web framework" },
];

export function HomePage() {
  const navigate = useNavigate();
  const { setJobId } = useJobStore();
  const [githubUrl, setGithubUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitGithubUrl = async (url: string) => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.ingest.fromGithub(url.trim());
      setJobId(res.job_id);
      navigate(`/workspace/${res.job_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start ingestion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a ZIP file");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.ingest.fromUpload(file);
      setJobId(res.job_id);
      navigate(`/workspace/${res.job_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
      }}
    >
      {/* Logo + Title */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            background: "var(--accent-bg)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <Zap size={24} style={{ color: "var(--text-primary)" }} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 40,
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 12,
            letterSpacing: "-0.5px",
          }}
        >
          Engineering <span style={{ fontStyle: "italic", fontWeight: 400 }}>Intelligence</span> Hub
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            maxWidth: 500,
            lineHeight: 1.6,
            margin: "0 auto",
          }}
        >
          Understand any codebase instantly. Get interactive dependency graphs, guided walkthroughs, and onboarding documentation.
        </p>
      </div>

      {/* Main input card */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.03)",
          marginBottom: 24,
        }}
      >
        {/* GitHub URL */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: 10,
            }}
          >
            <GitBranch size={14} style={{ color: "var(--accent-blue)" }} /> GitHub Repository URL
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => {
                setGithubUrl(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submitGithubUrl(githubUrl)}
              placeholder="https://github.com/owner/repository"
              style={{
                flex: 1,
                padding: "12px 14px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                outline: "none",
                transition: "all 0.15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--text-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              onClick={() => submitGithubUrl(githubUrl)}
              disabled={isLoading || !githubUrl.trim()}
              style={{
                padding: "12px 20px",
                background:
                  githubUrl.trim() && !isLoading ? "var(--text-primary)" : "var(--bg-secondary)",
                border: "none",
                borderRadius: 8,
                color: githubUrl.trim() && !isLoading ? "var(--bg-card)" : "var(--text-muted)",
                cursor: githubUrl.trim() && !isLoading ? "pointer" : "default",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease",
              }}
            >
              {isLoading ? (
                <Loader2
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <ArrowRight size={16} />
              )}
              {isLoading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>or upload</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* ZIP Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${isDragging ? "var(--text-primary)" : "var(--border)"}`,
            borderRadius: 8,
            padding: "24px 16px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: isDragging ? "var(--bg-secondary)" : "transparent",
          }}
          onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--text-primary)")}
          onMouseOut={(e) =>
            (e.currentTarget.style.borderColor = isDragging
              ? "var(--text-primary)"
              : "var(--border)")
          }
        >
          <Upload size={20} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            Drop a ZIP file or <span style={{ color: "var(--accent-blue)", fontWeight: 500 }}>browse</span>
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Max 100MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={(e) =>
              e.target.files?.[0] && handleFileUpload(e.target.files[0])
            }
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "var(--accent-bg)",
              border: "1px solid var(--error)",
              borderRadius: 8,
              color: "var(--error)",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Quick start */}
      <div style={{ width: "100%", maxWidth: 560 }}>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginBottom: 12,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          Quick start
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {QUICK_START_REPOS.map((r) => (
            <button
              key={r.repo}
              onClick={() => {
                const url = `https://github.com/${r.owner}/${r.repo}`;
                setGithubUrl(url);
                submitGithubUrl(url);
              }}
              disabled={isLoading}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "var(--text-primary)";
                e.currentTarget.style.background = "var(--bg-secondary)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--bg-card)";
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 2,
                }}
              >
                {r.owner}/{r.repo}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
