import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Sparkles, Shield, Activity, RefreshCw, Calendar, 
  User, Tag, ChevronRight, Clock, Eye, Share2, List, ExternalLink,
  Volume2, VolumeX
} from "lucide-react";
import LegalModal from "./LegalModal";
import { setupPageAEO, cleanupPageAEO } from "../utils/aeo";

const COLORS = {
  primary: "#111827",
  accent: "#3b82f6",
  textMuted: "#6b7280",
  bgLight: "#ffffff",
  bgSoft: "#f9fafb",
  border: "#e5e7eb",
  white: "#ffffff"
};

const API = import.meta.env.VITE_API_URL || "";

const parseInlineMarkdown = (text) => {
  if (!text) return "";
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ fontWeight: "900", color: COLORS.accent }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} style={{ fontStyle: "italic", opacity: 0.9 }}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
};

// --- ELITE AGENT-READY POST SCHEMA ---
const INITIAL_POSTS = [];


const BlogSection = ({ onBack, externalPosts = [] }) => {
  const [posts, setPosts] = useState([...externalPosts, ...INITIAL_POSTS]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [legalModalType, setLegalModalType] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [subscribedNewsletter, setSubscribedNewsletter] = useState(false);
  const [showReelModal, setShowReelModal] = useState(false);
  const [dismissReelPreview, setDismissReelPreview] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [isReelMuted, setIsReelMuted] = useState(true);
  
  // --- PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 3;

  // Reset page when post count changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [posts.length]);

  // Reset reel modal states on selectedPost transitions
  React.useEffect(() => {
    setShowReelModal(false);
    setDismissReelPreview(false);
    setVideoError(false);
    setIsReelMuted(true);
    if (selectedPost) {
      setVideoSrc(`/reels/${selectedPost.slug}_face_reel.mp4`);
    }
  }, [selectedPost]);



  // Sync external posts and fetch persistent ones from backend
  React.useEffect(() => {
    const fetchPersistentInsights = async () => {
      try {
        const response = await fetch(`${API}/insights`);
        const persistentPosts = await response.json();
        
        // Merge strategy: Persistent (Backend) + Live (props) + Static (Hardcoded)
        // Ensure no duplicates by slug
        const allPosts = [...externalPosts, ...persistentPosts, ...INITIAL_POSTS];
        const uniquePosts = Array.from(new Map(allPosts.map(p => [p.slug, p])).values());
        
        setPosts(uniquePosts);
      } catch (err) {
        console.error("[BLOG] Failed to sync persistent insights:", err);
        setPosts([...externalPosts, ...INITIAL_POSTS]);
      }
    };

    fetchPersistentInsights();
  }, [externalPosts]);

  const getCategoryIcon = (category) => {
    switch (category) {
      case "Intelligence": return <Sparkles size={16} />;
      case "Security": return <Shield size={16} />;
      case "Operations": return <Activity size={16} />;
      case "Update": return <RefreshCw size={16} />;
      default: return <Tag size={16} />;
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // --- DYNAMIC SEO INJECTION ---
  React.useEffect(() => {
    if (selectedPost) {
      const schemas = [];

      // Add BlogPosting schema
      schemas.push({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": selectedPost.title,
        "description": selectedPost.metadata?.seoDesc || selectedPost.subtitle,
        "image": `https://yourdomain.com${selectedPost.featuredImage}`,
        "author": {
          "@type": "Person",
          "name": selectedPost.author?.name || "Astra AI",
          "jobTitle": selectedPost.author?.role || "Autonomous Agent"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Swarm Agentic Lab",
          "logo": {
            "@type": "ImageObject",
            "url": "https://yourdomain.com/favicon.svg"
          }
        },
        "datePublished": selectedPost.date,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": `https://yourdomain.com/blog/${selectedPost.slug}`
        }
      });

      // Add FAQ schema if available
      if (selectedPost.aeoSchema && selectedPost.aeoSchema.questions) {
        schemas.push({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": selectedPost.aeoSchema.questions.map(q => ({
            "@type": "Question",
            "name": q.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": q.answer
            }
          }))
        });
      }

      setupPageAEO({
        title: selectedPost.metadata?.seoTitle || selectedPost.title,
        description: selectedPost.metadata?.seoDesc || selectedPost.subtitle,
        keywords: selectedPost.metadata?.keywords || [],
        url: `https://yourdomain.com${selectedPost.metadata?.canonicalUrl || "/blog/" + selectedPost.slug}`,
        imageUrl: `https://yourdomain.com${selectedPost.featuredImage}`,
        schemaId: 'blog-aeo',
        schemaData: schemas
      });

    } else {
      setupPageAEO({
        title: "Swarm Agentic Lab | Insights & Engineering",
        description: "Enterprise autonomous AI and Swarm Intelligence.",
        schemaId: 'blog-aeo',
        schemaData: null
      });
      cleanupPageAEO('blog-aeo');
    }

    return () => {
      cleanupPageAEO('blog-aeo');
    };
  }, [selectedPost]);

  if (selectedPost) {
    return (
      <div style={{ background: COLORS.bgLight, minHeight: "100vh", fontFamily: "'Outfit', sans-serif" }}>
        <nav style={{ 
          padding: "1.5rem 5%", background: "rgba(255,255,255,0.8)", 
          backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`,
          position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <button 
            onClick={() => setSelectedPost(null)}
            style={{ 
              background: "none", border: "none", color: COLORS.primary, 
              fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
              fontSize: "0.9rem", letterSpacing: "1px"
            }}
          >
            <ArrowLeft size={18} /> BACK TO INSIGHTS
          </button>
          <div style={{ fontSize: "1rem", fontWeight: "800", color: COLORS.accent }}>
            {selectedPost.slug}
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
          </div>
        </nav>

        <article style={{ maxWidth: "1200px", margin: "0 auto", padding: "6rem 5%", display: "grid", gridTemplateColumns: "1fr 300px", gap: "4rem" }}>
          <div>
            {selectedPost.featuredImage ? (
              <div style={{ 
                width: "100%", height: "500px", borderRadius: "40px", 
                overflow: "hidden", marginBottom: "4rem", boxShadow: "0 40px 80px rgba(0,0,0,0.1)"
              }}>
                <img src={selectedPost.featuredImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={selectedPost.imageAlt} />
              </div>
            ) : (
              <div style={{
                width: "100%", height: "500px", borderRadius: "40px",
                marginBottom: "4rem", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                color: "white", boxShadow: "0 40px 80px rgba(0,0,0,0.1)"
              }}>
                <Sparkles size={48} color="#60a5fa" style={{ marginBottom: "1rem" }} />
                <div style={{ fontSize: "1.2rem", fontWeight: "800", opacity: 0.7 }}>Cortex Swarm Insight</div>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "2rem" }}>
              {selectedPost.metadata?.tags?.map(tag => (
                <span key={tag} style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.accent, background: `${COLORS.accent}11`, padding: "4px 12px", borderRadius: "99px", letterSpacing: "1px" }}>
                  #{tag.toUpperCase()}
                </span>
              ))}
            </div>

            <h1 style={{ fontSize: "4.5rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "-3px", lineHeight: 0.95, marginBottom: "1.5rem" }}>
              {selectedPost.title}
            </h1>
            <p style={{ fontSize: "1.75rem", color: COLORS.textMuted, marginBottom: "3rem", fontWeight: "400", lineHeight: 1.3 }}>
              {selectedPost.subtitle}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginBottom: "4rem", paddingBottom: "2.5rem", borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <img src={selectedPost.author?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=astra"} style={{ width: "56px", height: "56px", borderRadius: "50%", background: COLORS.bgSoft, border: `1px solid ${COLORS.border}` }} alt={selectedPost.author?.name || "Astra AI"} />
                <div>
                  <div style={{ fontWeight: "900", color: COLORS.primary, fontSize: "1.1rem" }}>{selectedPost.author?.name || "Astra AI"}</div>
                  <div style={{ fontSize: "0.85rem", color: COLORS.accent, fontWeight: "700" }}>{selectedPost.author?.role || "Autonomous Growth Agent"}</div>
                </div>
              </div>
              <div style={{ height: "30px", width: "1px", background: COLORS.border }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>PUBLISHED</div>
                <div style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.primary }}>{formatDate(selectedPost.date)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>READ TIME</div>
                <div style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.primary }}>{selectedPost.readTime || "2 min read"}</div>
              </div>
            </div>

            <div className="prose" style={{ fontSize: "1.35rem", lineHeight: 1.8, color: COLORS.primary, opacity: 0.9 }}>
              {(() => {
                const lines = selectedPost.content.split('\n');
                const blocks = [];
                let currentQuoteBlock = null;

                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  if (line.startsWith('> ')) {
                    if (!currentQuoteBlock) {
                      currentQuoteBlock = { type: 'quote', lines: [] };
                      blocks.push(currentQuoteBlock);
                    }
                    currentQuoteBlock.lines.push(line.slice(2).trim());
                  } else {
                    currentQuoteBlock = null;
                    blocks.push({ type: 'line', text: line, index: i });
                  }
                }

                return blocks.map((block, i) => {
                  if (block.type === 'quote') {
                    return (
                      <motion.div 
                        key={`quote-${i}`}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{ 
                          margin: "2.5rem 0", 
                          padding: "2rem", 
                          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", 
                          border: `1px solid rgba(59, 130, 246, 0.15)`, 
                          borderLeft: `5px solid ${COLORS.accent}`, 
                          borderRadius: "16px",
                          boxShadow: "0 10px 30px rgba(59, 130, 246, 0.05)",
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "1.5px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                          ⚙️ TECHNICAL ARCHITECTURE & STRATEGY
                        </div>
                        {block.lines.map((qLine, qIdx) => {
                          if (qLine.startsWith('- ')) {
                            return (
                              <div key={qIdx} style={{ display: "flex", gap: "10px", marginBottom: "0.6rem", paddingLeft: "0.5rem" }}>
                                <span style={{ color: COLORS.accent, fontWeight: "900" }}>•</span>
                                <span style={{ flex: 1, fontSize: "1.2rem", color: COLORS.primary }}>{parseInlineMarkdown(qLine.slice(2).trim())}</span>
                              </div>
                            );
                          }
                          return <p key={qIdx} style={{ margin: "0 0 1rem 0", fontSize: "1.2rem", lineHeight: 1.6, color: COLORS.primary }}>{parseInlineMarkdown(qLine)}</p>;
                        })}
                      </motion.div>
                    );
                  }

                  const line = block.text;
                  const idx = block.index;

                  if (line.includes('[Key Point]')) {
                    let cleanText = line
                      .replace(/-\s*\*\*\[Key Point\]\*\*:\s*/gi, '')
                      .replace(/\*\*\[Key Point\]\*\*:\s*/gi, '')
                      .replace(/\[Key Point\]:\s*/gi, '')
                      .replace(/-\s*\[Key Point\]:\s*/gi, '')
                      .replace(/-\s*\*\*\[Key Point\]\*\*:\s*/gi, '')
                      .trim();
                    
                    cleanText = cleanText.replace(/^[:\-\s\*\s]+/, '');

                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        style={{ 
                          margin: "2.5rem 0", 
                          padding: "1.5rem 2rem", 
                          background: "linear-gradient(90deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.01) 100%)", 
                          borderLeft: `4px solid ${COLORS.accent}`, 
                          borderRadius: "0 16px 16px 0",
                          boxShadow: "0 4px 20px rgba(59,130,246,0.03)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "1.5px" }}>
                          <Sparkles size={14} /> KEY INSIGHT
                        </div>
                        <p style={{ margin: 0, fontSize: "1.25rem", lineHeight: "1.6", fontWeight: "500", color: COLORS.primary }}>
                          {parseInlineMarkdown(cleanText)}
                        </p>
                      </motion.div>
                    );
                  }

                  if (line.startsWith('## ')) {
                    return <h2 key={idx} style={{ fontSize: "2.5rem", fontWeight: "900", marginTop: "4rem", marginBottom: "1.5rem", letterSpacing: "-1px" }}>{parseInlineMarkdown(line.replace('## ', '').trim())}</h2>;
                  }
                  if (line.startsWith('### ')) {
                    return <h3 key={idx} style={{ fontSize: "1.8rem", fontWeight: "800", marginTop: "3rem", marginBottom: "1rem", color: COLORS.accent }}>{parseInlineMarkdown(line.replace('### ', '').trim())}</h3>;
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <div key={idx} style={{ display: "flex", gap: "10px", marginBottom: "1rem", paddingLeft: "1rem" }}>
                        <span style={{ color: COLORS.accent, fontWeight: "900" }}>•</span>
                        <span style={{ flex: 1 }}>{parseInlineMarkdown(line.slice(2).trim())}</span>
                      </div>
                    );
                  }
                  if (line.trim() === "") return <div key={idx} style={{ height: "1rem" }} />;
                  return <p key={idx} style={{ marginBottom: "2rem" }}>{parseInlineMarkdown(line)}</p>;
                });
              })()}
            </div>

            {/* CTA Section */}
            {selectedPost.cta && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                style={{ 
                  marginTop: "6rem", padding: "4rem", background: COLORS.primary, 
                  borderRadius: "40px", color: "white", textAlign: "center",
                  boxShadow: `0 30px 60px ${COLORS.primary}44`
                }}
              >
                <h3 style={{ fontSize: "2.5rem", fontWeight: "900", marginBottom: "1rem" }}>{selectedPost.cta.title}</h3>
                <p style={{ fontSize: "1.2rem", opacity: 0.8, marginBottom: "2.5rem", maxWidth: "500px", margin: "0 auto 2.5rem" }}>{selectedPost.cta.description}</p>
                <a 
                  href={selectedPost.cta.buttonUrl} 
                  style={{ 
                    padding: "1.2rem 3rem", background: COLORS.accent, color: "white", 
                    textDecoration: "none", borderRadius: "16px", fontWeight: "900", 
                    display: "inline-flex", alignItems: "center", gap: "10px",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                >
                  {selectedPost.cta.buttonText} <ChevronRight size={20}/>
                </a>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <aside>
            <div style={{ position: "sticky", top: "120px", display: "grid", gap: "3rem" }}>
              {/* Table of Contents */}
              <div style={{ padding: "2rem", background: COLORS.bgSoft, borderRadius: "24px", border: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem", color: COLORS.primary, fontWeight: "900", fontSize: "0.9rem", letterSpacing: "1px" }}>
                  <List size={18}/> TABLE OF CONTENTS
                </div>
                <div style={{ display: "grid", gap: "12px" }}>
                  {selectedPost.tableOfContents?.map((item, i) => (
                    <div key={i} style={{ fontSize: "0.95rem", color: COLORS.textMuted, cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = COLORS.accent} onMouseLeave={(e) => e.target.style.color = COLORS.textMuted}>
                      {item.replace(/\*\*/g, '').trim()}
                    </div>
                  ))}
                </div>
              </div>

              {/* SEO Tags / Metadata (Agent Helper) */}

              {/* SEO Tags / Metadata (Agent Helper) */}
              <div style={{ padding: "1.5rem", background: COLORS.primary, borderRadius: "24px", color: "white" }}>
                 <div style={{ fontSize: "0.7rem", fontWeight: "900", opacity: 0.6, letterSpacing: "1px", marginBottom: "1rem" }}>AGENT METADATA</div>
                 <div style={{ fontSize: "0.8rem", display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px" }}><span style={{ opacity: 0.5 }}>CANONICAL:</span> {selectedPost.metadata?.canonicalUrl || `/blog/${selectedPost.slug}`}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ opacity: 0.5 }}>KEYWORDS:</span>
                      {selectedPost.metadata?.keywords?.slice(0, 3).map(k => (
                        <span key={k} style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px" }}>{k}</span>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          </aside>
        </article>

        {/* --- FLOATING VIDEO REEL PREVIEW BUBBLE --- */}
        {!dismissReelPreview && !showReelModal && !videoError && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            style={{
              position: "fixed",
              bottom: "2.5rem",
              right: "2.5rem",
              width: "160px",
              height: "284px",
              borderRadius: "24px",
              overflow: "hidden",
              boxShadow: "0 25px 60px rgba(59, 130, 246, 0.4)",
              border: `2px solid ${COLORS.accent}`,
              background: COLORS.primary,
              cursor: videoSrc.includes('_face_reel') ? "default" : "pointer",
              zIndex: 1000,
            }}
            onClick={() => {
              if (!videoSrc.includes('_face_reel')) {
                setShowReelModal(true);
              }
            }}
          >
            {/* Miniature Video Auto-Player */}
            <video
              src={videoSrc}
              muted={!videoSrc.includes('_face_reel')}
              autoPlay
              loop
              playsInline
              onError={() => {
                if (videoSrc.includes('_face_reel')) {
                  setVideoSrc(`/reels/${selectedPost.slug}_reel.mp4`);
                } else {
                  setVideoError(true);
                }
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            {/* Pulse Glow Overlay */}
            <div style={{
              position: "absolute",
              inset: 0,
              boxShadow: "inset 0 0 20px rgba(59, 130, 246, 0.5)",
              pointerEvents: "none"
            }} />
            {/* Floating Visual Badge */}
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(0deg, rgba(17,24,39,0.95) 0%, transparent 100%)",
              padding: "10px",
              color: "white",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "2px"
            }}>
              <div style={{ fontSize: "0.65rem", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>30s Summary</div>
            </div>
            {/* Dismiss Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDismissReelPreview(true);
              }}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                background: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.8rem",
                zIndex: 1001
              }}
            >
              ×
            </button>
          </motion.div>
        )}

        {/* --- FULLSCREEN VERTICAL SMARTPHONE CINEMA MODAL --- */}
        <AnimatePresence>
          {showReelModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(17, 24, 39, 0.95)",
                backdropFilter: "blur(20px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
              }}
              onClick={() => setShowReelModal(false)}
            >
              {/* Close Label */}
              <button
                onClick={() => setShowReelModal(false)}
                style={{
                  position: "absolute",
                  top: "2rem",
                  right: "2rem",
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontWeight: "900",
                  letterSpacing: "2px"
                }}
              >
                CLOSE [X]
              </button>

              {/* Vertical Bezel Simulator */}
              <motion.div
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                style={{
                  position: "relative",
                  width: "414px",
                  height: "736px",
                  borderRadius: "44px",
                  border: "12px solid #374151",
                  background: COLORS.primary,
                  boxShadow: "0 50px 100px rgba(0,0,0,0.8), 0 0 80px rgba(59, 130, 246, 0.25)",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Simulator Status Bar */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "30px",
                  background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)",
                  zIndex: 2005,
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0 2rem",
                  alignItems: "center",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "0.7rem",
                }}>
                  <span>12:00</span>
                  <div style={{ width: "90px", height: "15px", background: "#374151", borderRadius: "0 0 12px 12px" }}></div>
                  <span>100%</span>
                </div>

                {/* Unmuted Cinema Video */}
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <video
                    src={videoSrc}
                    autoPlay
                    controls
                    loop
                    playsInline
                    muted={isReelMuted}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {/* Floating Sound Toggle Badge */}
                  <button
                    onClick={() => setIsReelMuted(!isReelMuted)}
                    style={{
                      position: "absolute",
                      bottom: "80px",
                      right: "20px",
                      background: "rgba(17, 24, 39, 0.75)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "50%",
                      width: "48px",
                      height: "48px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      cursor: "pointer",
                      boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                      zIndex: 2010,
                      transition: "transform 0.2s"
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  >
                    {isReelMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  {/* Tap to Unmute Pulsing Overlay */}
                  {isReelMuted && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: [0.6, 1, 0.6], scale: 1 }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      onClick={() => setIsReelMuted(false)}
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "rgba(17, 24, 39, 0.85)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        padding: "12px 24px",
                        borderRadius: "99px",
                        color: "white",
                        fontWeight: "900",
                        fontSize: "0.85rem",
                        letterSpacing: "1px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                        cursor: "pointer",
                        zIndex: 2010
                      }}
                    >
                      <VolumeX size={16} color="#3b82f6" /> TAP TO UNMUTE
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- DERIVED PAGINATION MATH ---
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);

  return (
    <div style={{ background: COLORS.bgLight, minHeight: "100vh", padding: "0", fontFamily: "'Outfit', sans-serif" }}>
      <nav style={{ 
        padding: "1.5rem 5%", background: "rgba(255,255,255,0.8)", 
        backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <button 
          onClick={onBack}
          style={{ 
            background: "none", border: "none", color: COLORS.primary, 
            fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
            fontSize: "0.9rem", letterSpacing: "1px"
          }}
        >
          <ArrowLeft size={18} /> BACK TO FLEET
        </button>
        <div style={{ fontSize: "1.2rem", fontWeight: "900", letterSpacing: "2px", color: COLORS.primary }}>
          SWARM <span style={{ color: COLORS.accent }}>INSIGHTS</span>
        </div>
        <div style={{ width: "100px" }}></div>
      </nav>

      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "6rem 5%" }}>
        <header style={{ textAlign: "center", marginBottom: "6rem" }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ 
              display: "inline-block", padding: "6px 16px", background: `${COLORS.accent}11`, 
              color: COLORS.accent, borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", 
              marginBottom: "1.5rem", letterSpacing: "2px" 
            }}
          >
            THE INTELLIGENCE FEED
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: "5rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "-4px", lineHeight: 0.85 }}
          >
            Autonomous<br/> Insights <span style={{ color: COLORS.accent }}>Fleet.</span>
          </motion.h1>
        </header>

        <div style={{ display: "grid", gap: "5rem" }}>
          <AnimatePresence mode="wait">
            {currentPosts.map((post, idx) => (
              <motion.article 
                key={post.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.15, type: "spring", damping: 25 }}
                style={{ cursor: "pointer" }}
                onClick={() => setSelectedPost(post)}
              >
                <div style={{ 
                  width: "100%", height: "480px", borderRadius: "40px", 
                  overflow: "hidden", position: "relative",
                  boxShadow: post.featured ? `0 40px 80px ${COLORS.accent}11` : "0 30px 60px rgba(0,0,0,0.08)",
                  border: post.featured ? `1px solid ${COLORS.accent}22` : "none"
                }}>
                  {post.featuredImage ? (
                    <img src={post.featuredImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={post.title} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "white", position: "relative" }}>
                      <div style={{ position: "absolute", top: "-50%", left: "-10%", width: "50%", height: "200%", background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)" }}></div>
                      <Sparkles size={64} color="#60a5fa" style={{ marginBottom: "1.5rem", position: "relative", zIndex: 10 }} />
                      <div style={{ fontSize: "1.5rem", fontWeight: "900", letterSpacing: "1px", position: "relative", zIndex: 10, opacity: 0.8 }}>Cortex Swarm Insight</div>
                    </div>
                  )}
                  <div style={{ 
                    position: "absolute", top: "2rem", left: "2rem", 
                    background: "white", padding: "8px 18px", borderRadius: "99px",
                    display: "flex", alignItems: "center", gap: "10px", 
                    fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
                  }}>
                    {getCategoryIcon(post.category)} {(post.category || "Insight").toUpperCase()}
                  </div>
                  {post.featured && (
                    <div style={{ position: "absolute", bottom: "2rem", right: "2rem", background: COLORS.accent, color: "white", padding: "6px 16px", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "900", letterSpacing: "1px" }}>
                      FEATURED
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "2.5rem", padding: "0 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1rem", fontSize: "0.8rem", fontWeight: "800", color: COLORS.textMuted, letterSpacing: "1px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={14} color={COLORS.accent}/> {(post.readTime || "2 min read").toUpperCase()}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><User size={14}/> {(post.author?.name || "Astra AI").toUpperCase()}</div>
                  </div>
                  <h2 style={{ fontSize: "3.2rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem", letterSpacing: "-2px", lineHeight: 1 }}>{post.title}</h2>
                  <p style={{ fontSize: "1.35rem", color: COLORS.textMuted, lineHeight: 1.5, marginBottom: "2rem", maxWidth: "800px" }}>{post.subtitle}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: COLORS.accent, fontWeight: "900", fontSize: "0.95rem", letterSpacing: "1px" }}>
                    LAUNCH PROTOCOL <ChevronRight size={20} />
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        {/* --- PREMIUM DYNAMIC PAGINATION --- */}
        {totalPages > 1 && (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            gap: "10px", 
            marginTop: "6rem",
            padding: "2rem 0",
            borderTop: `1px solid ${COLORS.border}`
          }}>
            <button
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              disabled={currentPage === 1}
              style={{
                background: "none",
                border: `1px solid ${currentPage === 1 ? COLORS.border : COLORS.primary}`,
                color: currentPage === 1 ? COLORS.textMuted : COLORS.primary,
                padding: "10px 20px",
                borderRadius: "12px",
                fontWeight: "800",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                opacity: currentPage === 1 ? 0.4 : 1,
                fontSize: "0.85rem",
                letterSpacing: "1px"
              }}
            >
              PREVIOUS
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setCurrentPage(pageNum);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      border: `1px solid ${isActive ? COLORS.accent : COLORS.border}`,
                      background: isActive ? COLORS.accent : "none",
                      color: isActive ? COLORS.white : COLORS.primary,
                      fontWeight: "900",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: isActive ? `0 10px 20px ${COLORS.accent}33` : "none"
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              disabled={currentPage === totalPages}
              style={{
                background: "none",
                border: `1px solid ${currentPage === totalPages ? COLORS.border : COLORS.primary}`,
                color: currentPage === totalPages ? COLORS.textMuted : COLORS.primary,
                padding: "10px 20px",
                borderRadius: "12px",
                fontWeight: "800",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                opacity: currentPage === totalPages ? 0.4 : 1,
                fontSize: "0.85rem",
                letterSpacing: "1px"
              }}
            >
              NEXT
            </button>
          </div>
        )}
      </main>

      <footer style={{ padding: "10rem 5% 5rem", background: COLORS.bgSoft, borderTop: `1px solid ${COLORS.border}`, marginTop: "10rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: "900", letterSpacing: "4px", color: COLORS.primary, marginBottom: "1.5rem" }}>SWARM COMMAND</div>
          <div style={{ display: "flex", justifyContent: "center", gap: "3rem", marginBottom: "3rem", fontSize: "0.9rem", fontWeight: "700", color: COLORS.textMuted }}>
            <span>NETWORK</span>
            <span>PROTOCOLS</span>
            <span>INTELLIGENCE</span>
          </div>

          {/* Newsletter Signup Form */}
          <div style={{ maxWidth: "450px", margin: "0 auto 3rem auto", padding: "1.75rem", background: "#ffffff", borderRadius: "16px", border: `1px solid ${COLORS.border}`, boxShadow: "0 10px 30px rgba(0, 0, 0, 0.02)" }}>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Newsletter
            </h4>
            <p style={{ color: COLORS.textMuted, fontSize: "0.85rem", lineHeight: "1.5", marginBottom: "1.25rem" }}>
              Join our newsletter for exclusive updates and tech premium insights.
            </p>
            {!subscribedNewsletter ? (
              <div style={{ display: "flex", gap: "8px" }}>
                <input 
                  type="email" 
                  placeholder="Your email" 
                  value={newsletterEmail}
                  onChange={e => setNewsletterEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: `1px solid ${COLORS.border}`,
                    fontSize: "0.85rem",
                    outline: "none",
                    fontFamily: "'Outfit', sans-serif"
                  }}
                />
                <button
                  onClick={() => {
                    if (newsletterEmail.includes("@")) {
                      setSubscribedNewsletter(true);
                      alert("Successfully subscribed to our newsletter!");
                    } else {
                      alert("Please enter a valid email address.");
                    }
                  }}
                  style={{
                    padding: "10px 20px",
                    background: COLORS.accent,
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "800",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={e => e.target.style.background = "#2563eb"}
                  onMouseLeave={e => e.target.style.background = COLORS.accent}
                >
                  Join
                </button>
              </div>
            ) : (
              <div style={{ color: COLORS.success, fontWeight: "800", fontSize: "0.85rem", background: "rgba(16, 185, 129, 0.08)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                ✓ SUBSCRIBED WITH {newsletterEmail.toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", marginBottom: "3rem", fontSize: "0.8rem", color: COLORS.textMuted, fontWeight: "600" }}>
            <span 
              onClick={() => setLegalModalType("privacy")}
              style={{ cursor: "pointer", transition: "color 0.2s" }} 
              onMouseEnter={e => e.target.style.color = COLORS.accent} 
              onMouseLeave={e => e.target.style.color = COLORS.textMuted}
            >
              PRIVACY POLICY
            </span>
            <span 
              onClick={() => setLegalModalType("terms")}
              style={{ cursor: "pointer", transition: "color 0.2s" }} 
              onMouseEnter={e => e.target.style.color = COLORS.accent} 
              onMouseLeave={e => e.target.style.color = COLORS.textMuted}
            >
              TERMS & CONDITIONS
            </span>
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: "0.8rem", letterSpacing: "1px", opacity: 0.6 }}>© 2026 SWARM COMMAND · ALL RIGHTS RESERVED · MADE IN INDIA 🇮🇳</div>
      </footer>

      {/* --- LEGAL MODAL --- */}
      <AnimatePresence>
        {legalModalType && (
          <LegalModal 
            type={legalModalType} 
            onClose={() => setLegalModalType(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BlogSection;
