import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Database, FileText, Mail, Cloud,
  MessageSquare, Folder, Link, Rss,
  BookOpen, Package, Zap, Server, Box,
  Settings, X, ChevronRight, ChevronLeft, ChevronDown,
  CheckCircle, AlertCircle, Info, Bot
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// Inline Custom SVG components for brand icons that are missing in older lucide-react versions
const Github = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const Slack = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="3" height="8" x="13" y="2" rx="1.5" />
    <path d="M19 8.5a1.5 1.5 0 1 1-3 0V7a1.5 1.5 0 1 1 3 0Z" />
    <rect width="3" height="8" x="8" y="14" rx="1.5" />
    <path d="M5 15.5A1.5 1.5 0 1 1 8 17v-1.5a1.5 1.5 0 1 1-3 0Z" />
    <rect width="8" height="3" x="2" y="13" rx="1.5" />
    <path d="M8.5 19a1.5 1.5 0 1 1 0-3H10a1.5 1.5 0 1 1 0 3Z" />
    <rect width="8" height="3" x="14" y="8" rx="1.5" />
    <path d="M15.5 5a1.5 1.5 0 1 1 0 3H14a1.5 1.5 0 1 1 0-3Z" />
  </svg>
);

const Youtube = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <polygon points="10 15 15 12 10 9" />
  </svg>
);

const Trello = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <rect width="3" height="9" x="7" y="7" rx="1" />
    <rect width="3" height="5" x="14" y="7" rx="1" />
  </svg>
);

const Chrome = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <line x1="12" x2="22" y1="8" y2="8" />
    <line x1="12" x2="3.35" y1="16" y2="16" />
    <line x1="12" x2="5.65" y1="2" y2="13" />
  </svg>
);

const Twitter = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const Figma = ({ size = 16, color = "currentColor", ...props }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
    <path d="M12 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 1 1 7 0z" />
    <path d="M5 18.5A3.5 3.5 0 0 1 8.5 15H12v3.5a3.5 3.5 0 1 1-7 0z" />
    <path d="M12 15h3.5a3.5 3.5 0 1 1 0 7H12v-7z" />
  </svg>
);


// ─── 22 Data Source Connectors ──────────────────────────────────────────────
const DATA_SOURCES = [
  { id: "web-crawl",   label: "Web Crawl",        icon: Globe,         color: "#3b82f6", available: true  },
  { id: "postgresql",  label: "PostgreSQL",        icon: Database,      color: "#336791", available: false },
  { id: "mysql",       label: "MySQL",             icon: Database,      color: "#e48e00", available: false },
  { id: "notion",      label: "Notion",            icon: FileText,      color: "#000000", available: false },
  { id: "github",      label: "GitHub Code",       icon: Github,        color: "#24292e", available: true  },
  { id: "confluence",  label: "Confluence",        icon: BookOpen,      color: "#0052cc", available: false },
  { id: "slack",       label: "Slack",             icon: Slack,         color: "#4a154b", available: false },
  { id: "gdrive",      label: "Google Drive",      icon: Folder,        color: "#34a853", available: false },
  { id: "gmail",       label: "Gmail",             icon: Mail,          color: "#ea4335", available: false },
  { id: "s3",          label: "AWS S3",            icon: Cloud,         color: "#ff9900", available: false },
  { id: "youtube",     label: "YouTube",           icon: Youtube,       color: "#ff0000", available: false },
  { id: "jira",        label: "Jira",              icon: Trello,        color: "#0052cc", available: false },
  { id: "discord",     label: "Discord",           icon: MessageSquare, color: "#5865f2", available: false },
  { id: "rss",         label: "RSS / Atom Feed",   icon: Rss,           color: "#f97316", available: false },
  { id: "confluence2", label: "SharePoint",        icon: Package,       color: "#0078d4", available: false },
  { id: "webhook",     label: "Custom Webhook",    icon: Link,          color: "#8b5cf6", available: false },
  { id: "n8n",         label: "n8n Workflow",      icon: Zap,           color: "#ea4335", available: false },
  { id: "sftp",        label: "SFTP / FTP",        icon: Server,        color: "#64748b", available: false },
  { id: "chrome-ext",  label: "Browser Extension", icon: Chrome,        color: "#4285f4", available: false },
  { id: "twitter",     label: "X / Twitter",       icon: Twitter,       color: "#000000", available: false },
  { id: "figma",       label: "Figma Docs",        icon: Figma,         color: "#f24e1e", available: false },
  { id: "docker-vol",  label: "Docker Volumes",    icon: Box,           color: "#2496ed", available: false },
];

// ─── Web Crawl Configuration Wizard ─────────────────────────────────────────
const SITE_TEMPLATES = {
  docs:  { label: "Documentation Site", include: "/docs/",      mainCss: "article, .content, .documentation", excludeCss: ".sidebar, .navigation, .toc" },
  blog:  { label: "Blog Platform",      include: "/blog/",      mainCss: ".post-content, article, .entry-content", excludeCss: ".related-posts, .comments, .author-bio" },
  forum: { label: "Forum / Community",  include: "/forum/",     mainCss: ".topic-content, .post-body, .thread-content", excludeCss: ".user-info, .reaction-buttons, .signature" },
};

function WebCrawlWizard({ onClose, onBack }) {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState({
    status: "idle",
    last_crawled_at: null,
    last_error: null,
    pages_crawled: 0
  });
  const [triggering, setTriggering] = useState(false);

  const [form, setForm] = useState({
    startUrl: "",
    sitemapEnabled: true,
    customSitemap: "",
    includePattern: "",
    excludePattern: "",
    jsRendering: false,
    proxyEnabled: false,
    extractPdfs: false,
    mainCss: "",
    excludeCss: "",
    template: null,
  });

  // Load existing config on mount
  useEffect(() => {
    axios.get(`${API}/api/crawler/config`)
      .then(res => {
        if (res.data && res.data.startUrl) {
          setForm({
            startUrl: res.data.startUrl || "",
            sitemapEnabled: res.data.sitemapEnabled !== false,
            customSitemap: res.data.customSitemap || "",
            includePattern: res.data.includePattern || "",
            excludePattern: res.data.excludePattern || "",
            jsRendering: !!res.data.jsRendering,
            proxyEnabled: !!res.data.proxyEnabled,
            extractPdfs: !!res.data.extractPdfs,
            mainCss: res.data.mainCss || "",
            excludeCss: res.data.excludeCss || "",
            template: res.data.template || null
          });
          setSaved(true);
        }
      })
      .catch(err => console.warn("Could not load crawler config:", err.message));
  }, []);

  // Poll status when saved screen is visible
  useEffect(() => {
    if (!saved) return;

    const fetchStatus = () => {
      axios.get(`${API}/api/crawler/status`)
        .then(res => {
          if (res.data) {
            setCrawlStatus(res.data);
          }
        })
        .catch(err => console.warn("Failed to fetch crawler status:", err.message));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [saved]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const applyTemplate = (tplKey) => {
    const t = SITE_TEMPLATES[tplKey];
    setForm(f => ({ ...f, template: tplKey, includePattern: t.include, mainCss: t.mainCss, excludeCss: t.excludeCss }));
  };

  const handleSave = async () => {
    try {
      await axios.post(`${API}/api/crawler/config`, form);
      setSaved(true);
    } catch (err) {
      alert("Failed to save crawler configuration: " + err.message);
    }
  };

  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      await axios.post(`${API}/api/crawler/run`);
      setCrawlStatus(s => ({ ...s, status: "crawling", last_error: null }));
    } catch (err) {
      alert("Failed to trigger crawler: " + err.message);
    } finally {
      setTriggering(false);
    }
  };

  if (saved) {
    const statusColors = {
      idle: "#64748b",
      crawling: "#3b82f6",
      completed: "#10b981",
      error: "#ef4444"
    };

    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <CheckCircle size={32} color="#10b981" />
        </div>
        <h3 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", marginBottom: "0.5rem" }}>Crawler Configured!</h3>
        <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Configuration saved successfully. You can trigger the crawler manually below.
        </p>

        {/* Crawling Status Dashboard */}
        <div style={{
          background: "#f8fafc",
          border: "1.5px solid #e2e8f0",
          borderRadius: 14,
          padding: "1.25rem 1.5rem",
          textAlign: "left",
          marginBottom: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Crawling Agent Status</span>
            <span style={{
              fontWeight: 800, fontSize: "0.75rem", color: statusColors[crawlStatus.status] || "#64748b",
              background: `${statusColors[crawlStatus.status]}12`, padding: "4px 10px", borderRadius: 99, textTransform: "uppercase"
            }}>
              ● {crawlStatus.status}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#64748b" }}>Pages Crawled:</span>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{crawlStatus.pages_crawled || 0} pages</span>
          </div>

          {crawlStatus.last_crawled_at && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "#64748b" }}>Last Crawled:</span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{new Date(crawlStatus.last_crawled_at).toLocaleTimeString()}</span>
            </div>
          )}

          {crawlStatus.last_error && (
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 10, fontSize: "0.8rem", color: "#ef4444" }}>
              <strong>Error:</strong> {crawlStatus.last_error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={handleManualTrigger}
            disabled={triggering || crawlStatus.status === "crawling"}
            style={{
              padding: "12px 24px",
              background: crawlStatus.status === "crawling" ? "#cbd5e1" : "#8b5cf6",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              cursor: crawlStatus.status === "crawling" ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Zap size={14} />
            {crawlStatus.status === "crawling" ? "Crawling..." : "Trigger Crawl Now"}
          </button>
          
          <button
            onClick={() => setSaved(false)}
            style={{
              padding: "12px 24px",
              background: "#fff",
              color: "#475569",
              border: "1.5px solid #cbd5e1",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Edit Configuration
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "#fff",
              color: "#64748b",
              border: "1.5px solid #cbd5e1",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: "2rem" }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: step >= s ? "#3b82f6" : "#e2e8f0", transition: "background 0.3s" }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <Globe size={18} color="#3b82f6" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>Step 1 — Define Crawl Scope</h3>
          </div>

          {/* Template picker */}
          <label style={labelStyle}>Quick Template</label>
          <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {Object.entries(SITE_TEMPLATES).map(([k, t]) => (
              <button key={k} onClick={() => applyTemplate(k)} style={{
                padding: "6px 14px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                background: form.template === k ? "#3b82f6" : "transparent",
                color: form.template === k ? "#fff" : "#475569",
                border: `1.5px solid ${form.template === k ? "#3b82f6" : "#cbd5e1"}`
              }}>{t.label}</button>
            ))}
          </div>

          <label style={labelStyle}>Start URL *</label>
          <input style={inputStyle} placeholder="https://docs.example.com" value={form.startUrl} onChange={e => set("startUrl", e.target.value)} />
          <p style={hintStyle}>Can also upload a .txt file with one URL per line for bulk crawling.</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
            <div>
              <label style={labelStyle}>Include Pattern</label>
              <input style={inputStyle} placeholder="/docs/ or regex" value={form.includePattern} onChange={e => set("includePattern", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Exclude Pattern</label>
              <input style={inputStyle} placeholder="/admin/ or /private/" value={form.excludePattern} onChange={e => set("excludePattern", e.target.value)} />
            </div>
          </div>
          <p style={hintStyle}>Patterns can be literal substrings or interpreted as Regex for advanced matching.</p>

          <label style={labelStyle}>Sitemap</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Toggle value={form.sitemapEnabled} onChange={v => set("sitemapEnabled", v)} label="Auto-discover /sitemap.xml &amp; robots.txt" />
          </div>
          {form.sitemapEnabled && (
            <input style={{ ...inputStyle, marginTop: 0 }} placeholder="Custom sitemap URL (optional)" value={form.customSitemap} onChange={e => set("customSitemap", e.target.value)} />
          )}

          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
            <label style={{ ...labelStyle, marginBottom: "1rem" }}>Advanced Options</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Toggle value={form.jsRendering} onChange={v => set("jsRendering", v)} label="JavaScript Rendering" warn="Dramatically increases crawl time — only enable if site requires JS to load content." />
              <Toggle value={form.proxyEnabled} onChange={v => set("proxyEnabled", v)} label="Use Proxy" hint="Enable if target site blocks or rate-limits crawlers." />
              <Toggle value={form.extractPdfs} onChange={v => set("extractPdfs", v)} label="Extract Linked PDFs" hint="Auto-download and extract text from linked PDF files." />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <FileText size={18} color="#3b82f6" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>Step 2 — Content Parsing (CSS Selectors)</h3>
          </div>

          <div style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: "1.5rem", display: "flex", gap: 10 }}>
            <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.6 }}>
              Target containers that <strong>only</strong> contain the main content to avoid polluting the knowledge base with headers and footers. Use Crawl Preview and Content Parse Preview before saving.
            </p>
          </div>

          <label style={labelStyle}>Main Content Selector *</label>
          <input style={inputStyle} placeholder="article, .content, .documentation" value={form.mainCss} onChange={e => set("mainCss", e.target.value)} />
          <p style={hintStyle}>Multiple selectors separated by commas. Start general, then refine.</p>

          <label style={labelStyle}>Selectors to Exclude</label>
          <input style={inputStyle} placeholder=".sidebar, .navigation, .footer, .toc" value={form.excludeCss} onChange={e => set("excludeCss", e.target.value)} />
          <p style={hintStyle}>Any error messages or junk text? Add their CSS classes here.</p>

          {/* Troubleshoot tips */}
          <div style={{ marginTop: "1.5rem" }}>
            <label style={labelStyle}>Troubleshooting Guide</label>
            {[
              { issue: "No pages found",              fix: "Check start URL & include patterns. Try enabling Proxy or JS Rendering." },
              { issue: "Too many pages crawled",       fix: "Narrow include patterns to be more specific paths." },
              { issue: "Empty content after parsing",  fix: "CSS selector likely too specific. Try a more general selector." },
              { issue: "Missing content sections",     fix: "Add multiple selectors separated by commas." },
              { issue: "Error messages in content",    fix: "Add those element classes to the exclusion list." },
              { issue: "Crawl taking too long",        fix: "Narrow URL scope & disable JS rendering if not strictly needed." },
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" }}>
                <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 3 }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a" }}>{t.issue}: </span>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{t.fix}</span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "1.5rem" }}>
            ⟳ Once saved, the crawler automatically re-crawls and syncs changes <strong>daily</strong>.
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #f1f5f9" }}>
        <button onClick={step === 1 ? onBack : () => setStep(1)} style={{ padding: "9px 20px", background: "transparent", border: "1.5px solid #e2e8f0", borderRadius: 10, fontWeight: 700, color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={16} /> {step === 1 ? "Back to Sources" : "Back"}
        </button>
        {step === 1 ? (
          <button onClick={() => setStep(2)} disabled={!form.startUrl} style={{ padding: "9px 24px", background: form.startUrl ? "#3b82f6" : "#e2e8f0", color: form.startUrl ? "#fff" : "#94a3b8", border: "none", borderRadius: 10, fontWeight: 800, cursor: form.startUrl ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSave} style={{ padding: "9px 24px", background: "#10b981", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle size={16} /> Save & Start Crawl
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Toggle component ────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, hint, warn }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <button onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 99, border: "none", cursor: "pointer", position: "relative", flexShrink: 0, marginTop: 2,
        background: value ? "#3b82f6" : "#e2e8f0", transition: "background 0.2s"
      }}>
        <span style={{ position: "absolute", top: 3, left: value ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </button>
      <div>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }} dangerouslySetInnerHTML={{ __html: label }} />
        {hint && <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>{hint}</p>}
        {warn && value && <p style={{ margin: 0, fontSize: "0.75rem", color: "#f59e0b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={12} /> {warn}</p>}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: "0.78rem", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: "0.88rem", color: "#0f172a", outline: "none", marginBottom: 4, boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s" };
const hintStyle = { margin: "0 0 16px", fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.5 };

// ─── GitHub Code Configuration Wizard ───────────────────────────────────────
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const buildHierarchy = (flatTree, selectedFileTypes) => {
  const root = { name: "root", path: "", type: "tree", children: [], filesCount: 0 };
  
  const filteredTree = flatTree.filter(node => {
    if (node.type === "tree") return true;
    return selectedFileTypes.some(ext => node.path.toLowerCase().endsWith(ext.toLowerCase()));
  });

  filteredTree.forEach(node => {
    const parts = node.path.split("/");
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");
      
      let child = current.children.find(c => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isLast ? node.type : "tree",
          children: [],
          size: isLast ? node.size : undefined,
          filesCount: 0
        };
        current.children.push(child);
      }
      current = child;
    }
  });

  const sortAndCount = (node) => {
    if (node.type === "blob") {
      node.filesCount = 1;
      return 1;
    }
    let total = 0;
    node.children = node.children.filter(child => {
      const count = sortAndCount(child);
      return count > 0;
    });
    node.children.forEach(child => {
      total += child.filesCount;
    });
    node.filesCount = total;
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "tree" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return total;
  };

  sortAndCount(root);
  return root;
};

function FileTreeNode({ node, expandedPaths, toggleExpand, checkedPaths, toggleNode }) {
  const isExpanded = expandedPaths.includes(node.path);
  const isFolder = node.type === "tree";
  const checked = checkedPaths.includes(node.path);

  const isPartiallyChecked = !checked && isFolder && node.children.some(c => {
    return checkedPaths.includes(c.path) || (c.type === "tree" && checkedPaths.some(p => p.startsWith(c.path + "/")));
  });

  return (
    <div style={{ marginLeft: node.path ? 16 : 0, marginTop: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
        {isFolder ? (
          <button
            onClick={() => toggleExpand(node.path)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              color: "#64748b"
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div style={{ width: 16 }} />
        )}

        <input
          type="checkbox"
          checked={checked}
          ref={el => {
            if (el) el.indeterminate = isPartiallyChecked;
          }}
          onChange={(e) => toggleNode(node, e.target.checked)}
          style={{
            cursor: "pointer",
            width: 15,
            height: 15,
            borderRadius: 4,
            accentColor: "#24292e"
          }}
        />

        {isFolder ? (
          <Folder size={15} style={{ color: "#3b82f6", flexShrink: 0 }} />
        ) : (
          <FileText size={15} style={{ color: "#64748b", flexShrink: 0 }} />
        )}

        <span style={{ fontSize: "0.85rem", fontWeight: isFolder ? 700 : 500, color: "#334155" }}>
          {node.name}
        </span>

        {isFolder && (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "auto" }}>
            {node.filesCount} included
          </span>
        )}
        {!isFolder && node.size !== undefined && (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginLeft: "auto" }}>
            {formatBytes(node.size)}
          </span>
        )}
      </div>

      {isFolder && isExpanded && node.children.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          checkedPaths={checkedPaths}
          toggleNode={toggleNode}
        />
      ))}
    </div>
  );
}

function GithubCodeWizard({ onClose, onBack }) {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [ingestStatus, setIngestStatus] = useState({
    status: "idle",
    last_crawled_at: null,
    last_error: null,
    pages_crawled: 0
  });
  const [triggering, setTriggering] = useState(false);

  const [form, setForm] = useState({
    owner: "",
    name: "",
    token: "",
    branchOrTag: "main",
    fileTypes: [".js", ".jsx", ".py", ".html"],
    directories: []
  });

  const [rawTree, setRawTree] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState(null);
  const [expandedPaths, setExpandedPaths] = useState([""]);

  // Load existing config on mount
  useEffect(() => {
    axios.get(`${API}/api/github/config`)
      .then(res => {
        if (res.data && res.data.owner) {
          const config = {
            owner: res.data.owner || "",
            name: res.data.name || "",
            token: res.data.token || "",
            branchOrTag: res.data.branchOrTag || "main",
            fileTypes: res.data.fileTypes || [".js", ".jsx", ".py", ".html"],
            directories: res.data.directories || []
          };
          setForm(config);
          setSaved(true);
          
          setLoadingTree(true);
          axios.get(`${API}/api/github/tree`, {
            params: {
              owner: config.owner,
              name: config.name,
              token: config.token,
              branchOrTag: config.branchOrTag
            }
          })
          .then(treeRes => {
            if (treeRes.data && treeRes.data.tree) {
              setRawTree(treeRes.data.tree);
            }
          })
          .catch(e => console.warn("Failed to pre-fetch tree:", e.message))
          .finally(() => setLoadingTree(false));
        }
      })
      .catch(err => console.warn("Could not load github config:", err.message));
  }, []);

  // Poll status when saved screen is visible
  useEffect(() => {
    if (!saved) return;

    const fetchStatus = () => {
      axios.get(`${API}/api/github/status`)
        .then(res => {
          if (res.data) {
            setIngestStatus(res.data);
          }
        })
        .catch(err => console.warn("Failed to fetch github status:", err.message));
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [saved]);

  // Handle default selection when raw tree is loaded
  useEffect(() => {
    if (rawTree.length > 0 && form.directories.length === 0) {
      const allPaths = rawTree.map(n => n.path);
      setForm(f => ({ ...f, directories: ["", ...allPaths] }));
    }
  }, [rawTree]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const toggleFileType = (ext) => {
    setForm(f => {
      const types = f.fileTypes.includes(ext)
        ? f.fileTypes.filter(x => x !== ext)
        : [...f.fileTypes, ext];
      return { ...f, fileTypes: types };
    });
  };

  const handleNext = async () => {
    setStep(2);
    setLoadingTree(true);
    setTreeError(null);
    try {
      const res = await axios.get(`${API}/api/github/tree`, {
        params: {
          owner: form.owner,
          name: form.name,
          token: form.token,
          branchOrTag: form.branchOrTag
        }
      });
      if (res.data && res.data.tree) {
        setRawTree(res.data.tree);
      } else {
        throw new Error("No repository tree returned");
      }
    } catch (err) {
      setTreeError(err.message || "Failed to load repository tree");
    } finally {
      setLoadingTree(false);
    }
  };

  const toggleExpand = (path) => {
    setExpandedPaths(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleToggleNode = (node, select) => {
    const pathsToUpdate = [];
    const collectPaths = (n) => {
      pathsToUpdate.push(n.path);
      n.children.forEach(collectPaths);
    };
    collectPaths(node);

    setForm(f => {
      let nextDirs = [...f.directories];
      if (select) {
        pathsToUpdate.forEach(p => {
          if (!nextDirs.includes(p)) nextDirs.push(p);
        });
      } else {
        nextDirs = nextDirs.filter(p => !pathsToUpdate.includes(p));
        const parts = node.path.split("/");
        for (let i = 0; i < parts.length; i++) {
          const ancestorPath = parts.slice(0, i).join("/");
          nextDirs = nextDirs.filter(p => p !== ancestorPath);
        }
      }
      return { ...f, directories: nextDirs };
    });
  };

  const handleSave = async () => {
    try {
      await axios.post(`${API}/api/github/config`, form);
      setSaved(true);
    } catch (err) {
      alert("Failed to save configuration: " + err.message);
    }
  };

  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      await axios.post(`${API}/api/github/run`);
      setIngestStatus(s => ({ ...s, status: "crawling", last_error: null }));
    } catch (err) {
      alert("Failed to trigger ingestion: " + err.message);
    } finally {
      setTriggering(false);
    }
  };

  const hierarchicalTree = React.useMemo(() => {
    const root = buildHierarchy(rawTree, form.fileTypes);
    root.name = form.name ? `${form.owner}/${form.name}` : "repository";
    return root;
  }, [rawTree, form.fileTypes, form.owner, form.name]);

  const totalMatchingFiles = React.useMemo(() => {
    const selectedDirs = form.directories;
    const filteredBlobPaths = rawTree
      .filter(node => node.type === "blob")
      .filter(node => form.fileTypes.some(ext => node.path.toLowerCase().endsWith(ext.toLowerCase())));
      
    if (selectedDirs.length === 0 || selectedDirs.includes("") || selectedDirs.includes("/")) {
      return filteredBlobPaths.length;
    }
    
    const matched = filteredBlobPaths.filter(node => {
      return selectedDirs.some(dir => node.path === dir || node.path.startsWith(dir + "/"));
    });
    return matched.length;
  }, [rawTree, form.fileTypes, form.directories]);

  if (saved) {
    const statusColors = {
      idle: "#64748b",
      crawling: "#3b82f6",
      completed: "#10b981",
      error: "#ef4444"
    };

    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
          <CheckCircle size={32} color="#10b981" />
        </div>
        <h3 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", marginBottom: "0.5rem" }}>Repository Connected!</h3>
        <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          GitHub repository configuration saved. Trigger manual code ingestion below.
        </p>

        <div style={{
          background: "#f8fafc",
          border: "1.5px solid #e2e8f0",
          borderRadius: 14,
          padding: "1.25rem 1.5rem",
          textAlign: "left",
          marginBottom: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Ingestion Status</span>
            <span style={{
              fontWeight: 800, fontSize: "0.75rem", color: statusColors[ingestStatus.status] || "#64748b",
              background: `${statusColors[ingestStatus.status]}12`, padding: "4px 10px", borderRadius: 99, textTransform: "uppercase"
            }}>
              ● {ingestStatus.status}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
            <span style={{ color: "#64748b" }}>Files Ingested:</span>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>{ingestStatus.pages_crawled || 0} files</span>
          </div>

          {ingestStatus.last_crawled_at && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "#64748b" }}>Last Ingested:</span>
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{new Date(ingestStatus.last_crawled_at).toLocaleTimeString()}</span>
            </div>
          )}

          {ingestStatus.last_error && (
            <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 8, padding: 10, fontSize: "0.8rem", color: "#ef4444" }}>
              <strong>Error:</strong> {ingestStatus.last_error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={handleManualTrigger}
            disabled={triggering || ingestStatus.status === "crawling"}
            style={{
              padding: "12px 24px",
              background: ingestStatus.status === "crawling" ? "#cbd5e1" : "#24292e",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              cursor: ingestStatus.status === "crawling" ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <Zap size={14} color="#f59e0b" />
            {ingestStatus.status === "crawling" ? "Ingesting..." : "Trigger Ingestion Now"}
          </button>
          
          <button
            onClick={() => setSaved(false)}
            style={{
              padding: "12px 24px",
              background: "#fff",
              color: "#475569",
              border: "1.5px solid #cbd5e1",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Edit Configuration
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "12px 24px",
              background: "#fff",
              color: "#64748b",
              border: "1.5px solid #cbd5e1",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const supportedFileTypes = [
    { ext: ".js", label: "JavaScript (.js)" },
    { ext: ".jsx", label: "React (.jsx)" },
    { ext: ".py", label: "Python (.py)" },
    { ext: ".html", label: "HTML (.html)" },
    { ext: ".css", label: "CSS (.css)" },
    { ext: ".md", label: "Markdown (.md)" }
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: "2rem" }}>
        {[1, 2].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: step >= s ? "#24292e" : "#e2e8f0", transition: "background 0.3s" }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <Github size={18} color="#24292e" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>Step 1 — Connect Repository</h3>
          </div>

          <label style={labelStyle}>Repository Owner *</label>
          <input style={inputStyle} placeholder="e.g. facebook" value={form.owner} onChange={e => set("owner", e.target.value)} />
          <p style={hintStyle}>The username or organization name that owns the GitHub repository.</p>

          <label style={labelStyle}>Repository Name *</label>
          <input style={inputStyle} placeholder="e.g. react" value={form.name} onChange={e => set("name", e.target.value)} />
          <p style={hintStyle}>The exact name of the repository on GitHub.</p>

          <label style={labelStyle}>Personal Access Token (Private Repositories)</label>
          <input type="password" style={inputStyle} placeholder="ghp_xxxxxxxxxxxx" value={form.token} onChange={e => set("token", e.target.value)} />
          <p style={hintStyle}>Required only for private repositories. Must have Contents: read-only access.</p>

          <label style={labelStyle}>Branch or Tag</label>
          <input style={inputStyle} placeholder="main" value={form.branchOrTag} onChange={e => set("branchOrTag", e.target.value)} />
          <p style={hintStyle}>Specify a branch or tag (e.g. release/2.0) to pin. Defaults to the default branch.</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <Settings size={18} color="#24292e" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>Step 2 — Configure File Selection</h3>
          </div>

          <label style={labelStyle}>File Types *</label>
          <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {supportedFileTypes.map(t => {
              const isSelected = form.fileTypes.includes(t.ext);
              return (
                <button
                  key={t.ext}
                  onClick={() => toggleFileType(t.ext)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 99,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: isSelected ? "#24292e" : "transparent",
                    color: isSelected ? "#fff" : "#475569",
                    border: `1.5px solid ${isSelected ? "#24292e" : "#cbd5e1"}`
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <label style={labelStyle}>Select directories to track</label>
          <p style={hintStyle}>Limit tracking to specific folders. Files added or removed will be synced accordingly. Preview matching files below.</p>

          {loadingTree ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid rgba(0,0,0,0.1)", borderTopColor: "#24292e", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "0.5rem" }} />
              <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Fetching repository file tree...</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : treeError ? (
            <div style={{ padding: "1.25rem", background: "rgba(239,68,68,0.05)", border: "1.5px solid rgba(239,68,68,0.15)", borderRadius: 12, color: "#ef4444", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
              <strong>Error loading repository tree:</strong> {treeError}
            </div>
          ) : (
            <div style={{
              maxHeight: 320,
              overflowY: "auto",
              background: "#f8fafc",
              border: "1.5px solid #e2e8f0",
              borderRadius: 14,
              padding: "1rem",
              marginBottom: "1.5rem"
            }}>
              <FileTreeNode
                node={hierarchicalTree}
                expandedPaths={expandedPaths}
                toggleExpand={toggleExpand}
                checkedPaths={form.directories}
                toggleNode={handleToggleNode}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "#64748b", fontWeight: 700 }}>
            <span>{totalMatchingFiles} files matching</span>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}> node_modules and .git excluded automatically </span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #f1f5f9" }}>
        <button onClick={step === 1 ? onBack : () => setStep(1)} style={{ padding: "9px 20px", background: "transparent", border: "1.5px solid #e2e8f0", borderRadius: 10, fontWeight: 700, color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={16} /> {step === 1 ? "Back to Sources" : "Back"}
        </button>
        {step === 1 ? (
          <button
            onClick={handleNext}
            disabled={!form.owner || !form.name}
            style={{
              padding: "9px 24px",
              background: (form.owner && form.name) ? "#24292e" : "#e2e8f0",
              color: (form.owner && form.name) ? "#fff" : "#94a3b8",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              cursor: (form.owner && form.name) ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s"
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={form.fileTypes.length === 0}
            style={{
              padding: "9px 24px",
              background: form.fileTypes.length > 0 ? "#10b981" : "#cbd5e1",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              cursor: form.fileTypes.length > 0 ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <CheckCircle size={16} /> Save &amp; Start Ingestion
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function SwarmCopilotPanel({ isOpen, onClose }) {
  const [activeSource, setActiveSource] = useState(null);
  const [crawlerConnected, setCrawlerConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setActiveSource(null);
      // Fetch crawler config to check connection status
      axios.get(`${API}/api/crawler/config`)
        .then(res => {
          setCrawlerConnected(!!(res.data && res.data.startUrl));
        })
        .catch(e => console.warn(e.message));

      // Fetch github config to check connection status
      axios.get(`${API}/api/github/config`)
        .then(res => {
          setGithubConnected(!!(res.data && res.data.owner));
        })
        .catch(e => console.warn(e.message));
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)", zIndex: 1000 }}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 560,
              background: "#fff", zIndex: 1001, boxShadow: "-20px 0 60px rgba(0,0,0,0.12)",
              display: "flex", flexDirection: "column", overflow: "hidden"
            }}
          >
            {/* Drawer header */}
            <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: activeSource ? `${activeSource.color}15` : "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeSource ? <activeSource.icon size={20} color={activeSource.color} /> : <Bot size={20} color="#8b5cf6" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#0f172a" }}>
                  {activeSource ? `${activeSource.label} Connector` : "Swarm Copilot Setup"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  {activeSource ? (activeSource.id === "web-crawl" ? "Web Crawling Configuration Expert" : "GitHub Code Integration Expert") : "Configure knowledge base data sources"}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }}>
              {!activeSource ? (
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "1.25rem" }}>
                    Select Data Source — {DATA_SOURCES.length} connectors
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {DATA_SOURCES.map(source => {
                      const Icon = source.icon;
                      const isConnected = 
                        (source.id === "web-crawl" && crawlerConnected) || 
                        (source.id === "github" && githubConnected);
                      return (
                        <motion.div
                          key={source.id}
                          whileHover={source.available ? { scale: 1.02 } : {}}
                          onClick={() => {
                            if (source.available) setActiveSource(source);
                          }}
                          style={{
                            background: "#fff",
                            border: `1.5px solid ${source.available ? (isConnected ? "#10b981" : source.color + "40") : "#e2e8f0"}`,
                            borderRadius: 12,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: source.available ? "pointer" : "default",
                            opacity: source.available ? 1 : 0.55,
                            transition: "all 0.2s",
                            position: "relative",
                            overflow: "hidden"
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${isConnected ? "#10b981" : source.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon size={16} color={isConnected ? "#10b981" : source.color} strokeWidth={1.75} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: source.available ? "#0f172a" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{source.label}</div>
                            <div style={{ fontSize: "0.65rem", fontWeight: 700, color: source.available ? (isConnected ? "#10b981" : source.color) : "#cbd5e1", marginTop: 2, letterSpacing: "0.3px" }}>
                              {source.available ? (isConnected ? "CONNECTED" : "AVAILABLE") : "COMING SOON"}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : activeSource.id === "web-crawl" ? (
                <WebCrawlWizard onClose={onClose} onBack={() => setActiveSource(null)} />
              ) : (
                <GithubCodeWizard onClose={onClose} onBack={() => setActiveSource(null)} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
