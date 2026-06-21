import React, { useState, useEffect, useCallback, useContext, createContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Heart, GitCommit, GitBranch, Code2,
  RefreshCw, ExternalLink, Clock, FileCode2, Plus, Minus
} from "lucide-react";

// ─── Config ──────────────────────────────────────────────────────────────────
const REPO_OWNER = "MyStic2110";
const REPO_NAME  = "Live-streaming-xclusive-v1";
const PER_PAGE   = 30;
const API_BASE   = import.meta.env.VITE_API_URL || "";

// ─── Likes Context — shared across all cards ─────────────────────────────────
const LikesContext = createContext({ counts: {}, likedByMe: new Set(), toggle: () => {} });

// ─── Type detection ──────────────────────────────────────────────────────────
const COMMIT_TYPES = {
  feat:     { label: "FEATURE",   emoji: "🚀", color: "#6366f1", glow: "rgba(99,102,241,0.25)" },
  fix:      { label: "BUG FIX",   emoji: "🐛", color: "#ef4444", glow: "rgba(239,68,68,0.25)"  },
  refactor: { label: "REFACTOR",  emoji: "🔧", color: "#f59e0b", glow: "rgba(245,158,11,0.25)" },
  chore:    { label: "CHORE",     emoji: "🔩", color: "#64748b", glow: "rgba(100,116,139,0.2)" },
  docs:     { label: "DOCS",      emoji: "📝", color: "#06b6d4", glow: "rgba(6,182,212,0.25)"  },
  style:    { label: "STYLE",     emoji: "🎨", color: "#ec4899", glow: "rgba(236,72,153,0.25)" },
  test:     { label: "TEST",      emoji: "🧪", color: "#10b981", glow: "rgba(16,185,129,0.25)" },
  perf:     { label: "PERF",      emoji: "⚡", color: "#a855f7", glow: "rgba(168,85,247,0.25)" },
  ci:       { label: "CI/CD",     emoji: "🤖", color: "#14b8a6", glow: "rgba(20,184,166,0.25)" },
  build:    { label: "BUILD",     emoji: "📦", color: "#f97316", glow: "rgba(249,115,22,0.25)" },
  revert:   { label: "REVERT",    emoji: "⏪", color: "#94a3b8", glow: "rgba(148,163,184,0.2)" },
  other:    { label: "UPDATE",    emoji: "✨", color: "#3b82f6", glow: "rgba(59,130,246,0.25)" },
};

function detectType(message) {
  const m = message.toLowerCase();
  for (const key of Object.keys(COMMIT_TYPES)) {
    if (key !== "other" && (m.startsWith(key + ":") || m.startsWith(key + "("))) return key;
  }
  if (m.includes("fix") || m.includes("bug") || m.includes("patch")) return "fix";
  if (m.includes("refactor") || m.includes("clean"))  return "refactor";
  if (m.includes("feat") || m.includes("add") || m.includes("new"))  return "feat";
  if (m.includes("doc"))   return "docs";
  if (m.includes("style") || m.includes("design") || m.includes("ui")) return "style";
  if (m.includes("perf")  || m.includes("optim")) return "perf";
  if (m.includes("chore") || m.includes("bump"))  return "chore";
  return "other";
}

function parseHashtags(message) {
  const scopeMatch = message.match(/\(([^)]+)\)/);
  const tags = [];
  if (scopeMatch) tags.push(scopeMatch[1]);
  const agents = ["shoppe","lina","nova","astra","seva","martech","octane","devops","bi","rehearsal","aivyuh","webrtc","playwright","livekit","react","python","frontend","backend","agent"];
  const lower = message.toLowerCase();
  agents.forEach(a => { if (lower.includes(a) && !tags.includes(a)) tags.push(a); });
  return [...new Set(tags)].slice(0, 4);
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff/86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" });
}

function shortSha(sha) { return sha?.slice(0, 7) || ""; }

// ─── Like Heart Button — reads from shared context ───────────────────────────
function HeartButton({ commitSha }) {
  const { counts, likedByMe, toggle } = useContext(LikesContext);
  const [burst, setBurst] = useState(false);
  const [loading, setLoading] = useState(false);

  const liked = likedByMe.has(commitSha);
  const count = counts[commitSha] ?? 0;

  const handleClick = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const wasLiked = liked;
    await toggle(commitSha);
    if (!wasLiked) { setBurst(true); setTimeout(() => setBurst(false), 600); }
    setLoading(false);
  };

  return (
    <button onClick={handleClick} disabled={loading} style={{
      background: "none", border: "none", cursor: loading ? "default" : "pointer",
      display: "flex", alignItems: "center", gap: 5,
      color: liked ? "#ef4444" : "#64748b",
      fontSize: "0.78rem", fontWeight: "700",
      position: "relative", padding: "4px 8px",
      borderRadius: 20, transition: "background 0.2s, color 0.2s",
      opacity: loading ? 0.6 : 1,
    }}
      onMouseEnter={e => !loading && (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
      onMouseLeave={e => e.currentTarget.style.background = "none"}
    >
      <motion.span
        animate={burst ? { scale: [1, 1.6, 0.9, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{ display: "flex" }}
      >
        <Heart size={15} fill={liked ? "#ef4444" : "none"} strokeWidth={2} />
      </motion.span>
      {count}
      {burst && (
        <AnimatePresence>
          {["❤️","💕","💖"].map((h, i) => (
            <motion.span key={i}
              initial={{ opacity: 1, y: 0, x: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -30 - i * 10, x: (i - 1) * 20, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              style={{ position: "absolute", top: -5, left: "50%", fontSize: "1rem", pointerEvents: "none" }}
            >{h}</motion.span>
          ))}
        </AnimatePresence>
      )}
    </button>
  );
}

// ─── Commit Card ──────────────────────────────────────────────────────────────
function CommitCard({ commit, index }) {
  const { sha, commit: c, html_url, stats } = commit;
  const type      = detectType(c.message);
  const meta      = COMMIT_TYPES[type];
  const tags      = parseHashtags(c.message);
  const lines     = c.message.split("\n");
  const title     = lines[0].replace(/^(feat|fix|refactor|chore|docs|style|test|perf|ci|build|revert)(\([^)]+\))?:\s*/i, "");
  const body      = lines.slice(1).filter(l => l.trim()).join(" ").slice(0, 180);
  const authorName= c.author.name;
  const avatar    = `https://github.com/${authorName}.png?size=48`;
  const date      = c.author.date;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.04, ease: "easeOut" }}
      style={{
        background: "#ffffff",
        border: `1.5px solid #cbd5e1`,
        borderRadius: 20,
        boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 10px 15px -3px rgba(0, 0, 0, 0.03)`,
        overflow: "hidden",
        transition: "box-shadow 0.3s, transform 0.2s",
        cursor: "default",
      }}
      whileHover={{
        boxShadow: `0 10px 30px ${meta.color}15, 0 4px 6px -1px rgba(0,0,0,0.02)`,
        y: -3,
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${meta.color}, ${meta.color}55, transparent)` }} />

      <div style={{ padding: "1.25rem 1.5rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.9rem" }}>
          <img src={avatar} alt={authorName} onError={e => { e.target.style.display = "none"; }}
            style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${meta.color}55`, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: "800", color: "#0f172a", lineHeight: 1.2 }}>{authorName}</div>
            <div style={{ fontSize: "0.65rem", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={10} />{timeAgo(date)}
            </div>
          </div>
          <span style={{
            fontSize: "0.6rem", fontWeight: "900", letterSpacing: "1.5px",
            padding: "3px 10px", borderRadius: 99,
            background: `${meta.color}10`, color: meta.color,
            border: `1px solid ${meta.color}30`,
            display: "flex", alignItems: "center", gap: 4, flexShrink: 0
          }}>
            <span>{meta.emoji}</span>{meta.label}
          </span>
        </div>

        <p style={{ fontSize: "0.95rem", fontWeight: "800", color: "#0f172a", margin: "0 0 0.5rem 0", lineHeight: 1.4, letterSpacing: "-0.01em" }}>
          {title || c.message.slice(0, 80)}
        </p>

        {body && (
          <p style={{ fontSize: "0.78rem", color: "#475569", margin: "0 0 0.9rem 0", lineHeight: 1.55, borderLeft: `2px solid ${meta.color}40`, paddingLeft: 10 }}>
            {body}{body.length >= 180 ? "…" : ""}
          </p>
        )}

        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "0.9rem" }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: "0.65rem", fontWeight: "700", color: meta.color, padding: "2px 8px", borderRadius: 99, background: `${meta.color}10` }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #cbd5e1", paddingTop: "0.75rem", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <a href={html_url} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", fontWeight: "900", letterSpacing: "1px", color: "#64748b", textDecoration: "none", background: "rgba(0,0,0,0.02)", border: "1px solid #cbd5e1", padding: "3px 8px", borderRadius: 8, fontFamily: "monospace", transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = meta.color}
              onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
            >
              <GitCommit size={10} />{shortSha(sha)}<ExternalLink size={9} />
            </a>
            {stats && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: "#64748b" }}><FileCode2 size={10} />{stats.total} files</span>}
            {stats && <>
              <span style={{ fontSize: "0.65rem", color: "#10b981", display: "flex", alignItems: "center", gap: 2 }}><Plus size={9} />{stats.additions}</span>
              <span style={{ fontSize: "0.65rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 2 }}><Minus size={9} />{stats.deletions}</span>
            </>}
          </div>
          <HeartButton commitSha={sha} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Timeline connector ───────────────────────────────────────────────────────
function TimelineDot({ color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 28, paddingTop: 22 }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, width: 2, background: "rgba(15,23,42,0.06)", marginTop: 6, minHeight: 40 }} />
    </div>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({ label, emoji, color, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 14px", borderRadius: 99, cursor: "pointer",
      fontSize: "0.72rem", fontWeight: "800", letterSpacing: "0.5px",
      background: active ? `${color}15` : "rgba(0,0,0,0.02)",
      color: active ? color : "#64748b",
      border: active ? `1px solid ${color}35` : "1px solid #cbd5e1",
      transition: "all 0.2s", display: "flex", alignItems: "center", gap: 5,
      fontFamily: "inherit"
    }}>
      <span>{emoji}</span>{label}
      <span style={{ background: active ? `${color}25` : "rgba(0,0,0,0.04)", padding: "1px 6px", borderRadius: 99, fontSize: "0.6rem" }}>{count}</span>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChangelogPage({ onBack }) {
  const [commits, setCommits]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Real likes state ──────────────────────────────────────────────────────
  const [likeCounts, setLikeCounts] = useState({});   // { sha: number }
  const [likedByMe, setLikedByMe]   = useState(new Set()); // Set of sha strings

  // Load real like data from backend
  useEffect(() => {
    fetch(`${API_BASE}/api/changelog/likes`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setLikeCounts(data.counts || {});
          setLikedByMe(new Set(data.likedByMe || []));
        }
      })
      .catch(() => {}); // graceful — likes just show 0 if backend is offline
  }, []);

  // Toggle like — optimistic UI + API call
  const toggleLike = useCallback(async (sha) => {
    const currentlyLiked = likedByMe.has(sha);
    const currentCount   = likeCounts[sha] ?? 0;

    // Optimistic update
    setLikedByMe(prev => {
      const next = new Set(prev);
      currentlyLiked ? next.delete(sha) : next.add(sha);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [sha]: currentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/changelog/likes/${sha}/toggle`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        // Sync with real server count
        setLikeCounts(prev => ({ ...prev, [sha]: data.count }));
        setLikedByMe(prev => {
          const next = new Set(prev);
          data.liked ? next.add(sha) : next.delete(sha);
          return next;
        });
      }
    } catch {
      // Rollback optimistic update if API failed
      setLikedByMe(prev => {
        const next = new Set(prev);
        currentlyLiked ? next.add(sha) : next.delete(sha);
        return next;
      });
      setLikeCounts(prev => ({ ...prev, [sha]: currentCount }));
    }
  }, [likedByMe, likeCounts]);

  const likesCtx = { counts: likeCounts, likedByMe, toggle: toggleLike };

  const fetchCommits = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=${PER_PAGE}&page=${pageNum}`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      if (data.length < PER_PAGE) setHasMore(false);
      setCommits(prev => append ? [...prev, ...data] : data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchCommits(1); }, [fetchCommits]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchCommits(next, true);
  };

  const typeCounts = {};
  commits.forEach(c => {
    const t = detectType(c.commit.message);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const filtered = filter === "all" ? commits : commits.filter(c => detectType(c.commit.message) === filter);

  const BG     = "#f8fafc";
  const BORDER = "#cbd5e1";

  return (
    <LikesContext.Provider value={likesCtx}>
    <div style={{
      minHeight: "100vh", background: BG, color: "#0f172a",
      fontFamily: "'Outfit', sans-serif",
      backgroundImage: `radial-gradient(circle at 10% 20%, rgba(59,130,246,0.04) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(16,185,129,0.02) 0%, transparent 40%)`,
    }}>
      {/* ── Ambient blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "5%", left: "10%",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: "15%", right: "5%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      {/* ── Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "1.25rem 2rem", display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{
            background: "rgba(0,0,0,0.03)", border: `1px solid ${BORDER}`,
            color: "#64748b", cursor: "pointer", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", fontSize: "0.8rem", fontWeight: "700",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = "#0f172a"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = "#64748b"; }}
          >
            <ArrowLeft size={14} /> BACK
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <GitBranch size={18} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "900", letterSpacing: "-0.02em", color: "#0f172a" }}>
                  SWARM LAB <span style={{ color: "#6366f1" }}>CHANGELOG</span>
                </h1>
                <div style={{ fontSize: "0.65rem", color: "#64748b", letterSpacing: "1px" }}>
                  {REPO_OWNER}/{REPO_NAME} · {commits.length} commits loaded
                </div>
              </div>
            </div>
          </div>

          <a
            href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/commits`}
            target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: "0.75rem", fontWeight: "700",
              color: "#64748b", textDecoration: "none",
              padding: "7px 12px", borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: "rgba(0,0,0,0.02)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#0f172a"; e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = BORDER; }}
          >
            <Code2 size={14} />
            GitHub
          </a>
        </div>

        {/* ── Filter pills */}
        <div style={{
          maxWidth: 880, margin: "0 auto", padding: "0 2rem 1rem",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        }}>
          <FilterPill
            label="ALL" emoji="🌐" color="#6366f1"
            active={filter === "all"} count={commits.length}
            onClick={() => setFilter("all")}
          />
          {Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7)
            .map(([type, count]) => {
              const m = COMMIT_TYPES[type];
              return (
                <FilterPill
                  key={type}
                  label={m.label} emoji={m.emoji} color={m.color}
                  active={filter === type} count={count}
                  onClick={() => setFilter(filter === type ? "all" : type)}
                />
              );
            })}
        </div>
      </div>

      {/* ── Main feed */}
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "2.5rem 2rem 6rem", position: "relative", zIndex: 1 }}>

        {/* Hero badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: "2.5rem", flexWrap: "wrap",
          }}
        >
          <div style={{
            padding: "6px 16px", borderRadius: 99,
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)",
            fontSize: "0.7rem", fontWeight: "900", color: "#6366f1", letterSpacing: "1.5px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <motion.span
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >⚡</motion.span>
            LIVE COMMIT FEED
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
            Auto-synced from GitHub · {filtered.length} commits {filter !== "all" ? `(${COMMIT_TYPES[filter]?.label})` : ""}
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gap: 20 }}>
            {[...Array(5)].map((_, i) => (
              <motion.div key={i}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                style={{
                  height: 140, borderRadius: 20,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            textAlign: "center", padding: "4rem 2rem",
            background: "rgba(239,68,68,0.03)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 20,
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "#ef4444", fontWeight: "700", marginBottom: 8 }}>GitHub API Error</div>
            <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>{error}</div>
            <button onClick={() => fetchCommits(1)} style={{
              padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)", color: "#ef4444",
              cursor: "pointer", fontWeight: "700", fontSize: "0.8rem",
              display: "flex", alignItems: "center", gap: 6, margin: "0 auto",
            }}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Commit timeline */}
        {!loading && !error && (
          <div style={{ display: "grid", gap: 0 }}>
            {filtered.map((commit, i) => {
              const type = detectType(commit.commit.message);
              const color = COMMIT_TYPES[type]?.color || "#6366f1";
              return (
                <div key={commit.sha} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <TimelineDot color={color} />
                  <div style={{ flex: 1, paddingBottom: 20, paddingTop: 16 }}>
                    <CommitCard commit={commit} index={i} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "5rem 2rem", color: "#64748b" }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔍</div>
            <div style={{ fontWeight: "800", marginBottom: 8 }}>No commits found for this filter</div>
            <button onClick={() => setFilter("all")} style={{
              padding: "8px 20px", borderRadius: 10, border: "1px solid rgba(99,102,241,0.2)",
              background: "rgba(99,102,241,0.05)", color: "#6366f1",
              cursor: "pointer", fontWeight: "700", fontSize: "0.8rem",
            }}>Show all commits</button>
          </div>
        )}

        {/* Load more */}
        {!loading && !error && hasMore && filtered.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
            <button onClick={loadMore} disabled={loadingMore} style={{
              padding: "12px 36px", borderRadius: 99,
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)",
              color: "#6366f1", cursor: loadingMore ? "default" : "pointer",
              fontWeight: "800", fontSize: "0.85rem", letterSpacing: "0.5px",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 0.2s", opacity: loadingMore ? 0.6 : 1,
              fontFamily: "inherit"
            }}
              onMouseEnter={e => !loadingMore && (e.currentTarget.style.background = "rgba(99,102,241,0.15)")}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(99,102,241,0.08)"}
            >
              {loadingMore
                ? <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={15} /></motion.span> Loading...</>
                : <><Plus size={15} /> Load More Commits</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
    </LikesContext.Provider>
  );
}
