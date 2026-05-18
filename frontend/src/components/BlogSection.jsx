import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Sparkles, Shield, Activity, RefreshCw, Calendar, 
  User, Tag, ChevronRight, Clock, Eye, Share2, List, ExternalLink 
} from "lucide-react";

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

// --- ELITE AGENT-READY POST SCHEMA ---
const INITIAL_POSTS = [];

const BlogSection = ({ onBack, externalPosts = [] }) => {
  const [posts, setPosts] = useState([...externalPosts, ...INITIAL_POSTS]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showReelModal, setShowReelModal] = useState(false);
  const [dismissReelPreview, setDismissReelPreview] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Reset reel modal states on selectedPost transitions
  React.useEffect(() => {
    setShowReelModal(false);
    setDismissReelPreview(false);
    setVideoError(false);
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
      // Set Document Title
      document.title = selectedPost.metadata.seoTitle || selectedPost.title;

      // Helper to set/update meta tags
      const setMetaTag = (name, content) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = name;
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      setMetaTag('description', selectedPost.metadata.seoDesc);
      setMetaTag('keywords', selectedPost.metadata.keywords.join(', '));
      
      // --- SOCIAL META (OpenGraph / Twitter) ---
      const setOGTag = (property, content) => {
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      setOGTag('og:title', selectedPost.title);
      setOGTag('og:description', selectedPost.metadata.seoDesc);
      setOGTag('og:image', `https://yourdomain.com${selectedPost.featuredImage}`);
      setOGTag('og:type', 'article');
      setOGTag('og:url', `https://yourdomain.com/blog/${selectedPost.slug}`);

      setMetaTag('twitter:card', 'summary_large_image');
      setMetaTag('twitter:title', selectedPost.title);
      setMetaTag('twitter:description', selectedPost.metadata.seoDesc);
      setMetaTag('twitter:image', `https://yourdomain.com${selectedPost.featuredImage}`);

      // --- JSON-LD SCHEMA.ORG AUTOMATION ---
      const schemaData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": selectedPost.title,
        "description": selectedPost.metadata.seoDesc,
        "image": `https://yourdomain.com${selectedPost.featuredImage}`,
        "author": {
          "@type": "Person",
          "name": selectedPost.author.name,
          "jobTitle": selectedPost.author.role
        },
        "publisher": {
          "@type": "Organization",
          "name": "Cortex Swarm",
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
      };

      let schemaScript = document.getElementById('astra-schema');
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'astra-schema';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.text = JSON.stringify(schemaData);

      // Handle Canonical URL
      let canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `https://yourdomain.com${selectedPost.metadata.canonicalUrl}`;

    } else {
      // Revert to default when closing the post
      document.title = "Cortex Swarm | Future-Gen Intelligence";
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.content = "Enterprise autonomous AI and Swarm Intelligence.";

      // Cleanup Schema
      const script = document.getElementById('astra-schema');
      if (script) script.remove();
    }
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
            <div style={{ 
              width: "100%", height: "500px", borderRadius: "40px", 
              overflow: "hidden", marginBottom: "4rem", boxShadow: "0 40px 80px rgba(0,0,0,0.1)"
            }}>
              <img src={selectedPost.featuredImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={selectedPost.imageAlt} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "2rem" }}>
              {selectedPost.metadata.tags.map(tag => (
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
                <img src={selectedPost.author.avatar} style={{ width: "56px", height: "56px", borderRadius: "50%", background: COLORS.bgSoft, border: `1px solid ${COLORS.border}` }} alt={selectedPost.author.name} />
                <div>
                  <div style={{ fontWeight: "900", color: COLORS.primary, fontSize: "1.1rem" }}>{selectedPost.author.name}</div>
                  <div style={{ fontSize: "0.85rem", color: COLORS.accent, fontWeight: "700" }}>{selectedPost.author.role}</div>
                </div>
              </div>
              <div style={{ height: "30px", width: "1px", background: COLORS.border }}></div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>PUBLISHED</div>
                <div style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.primary }}>{formatDate(selectedPost.date)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>READ TIME</div>
                <div style={{ fontSize: "1rem", fontWeight: "700", color: COLORS.primary }}>{selectedPost.readTime}</div>
              </div>
            </div>

            <div className="prose" style={{ fontSize: "1.35rem", lineHeight: 1.8, color: COLORS.primary, opacity: 0.9 }}>
              {selectedPost.content.split('\n').map((line, i) => {
                // --- ELITE KEY POINT CALLOUT PARSING ---
                if (line.includes('[Key Point]')) {
                  let cleanText = line
                    .replace(/-\s*\*\*\[Key Point\]\*\*:\s*/gi, '')
                    .replace(/\*\*\[Key Point\]\*\*:\s*/gi, '')
                    .replace(/\[Key Point\]:\s*/gi, '')
                    .replace(/-\s*\[Key Point\]:\s*/gi, '')
                    .replace(/-\s*\*\*\[Key Point\]\*\*:\s*/gi, '')
                    .trim();
                  
                  // Clean up potential starting brackets or extra colons/dashes
                  cleanText = cleanText.replace(/^[:\-\s\*\s]+/, '');

                  const parts = cleanText.split('**');

                  return (
                    <motion.div 
                      key={i}
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
                        {parts.map((part, idx) => (
                          <span key={idx} style={idx % 2 === 1 ? { fontWeight: "800", color: COLORS.accent } : {}}>
                            {part}
                          </span>
                        ))}
                      </p>
                    </motion.div>
                  );
                }

                if (line.startsWith('## ')) {
                  return <h2 key={i} style={{ fontSize: "2.5rem", fontWeight: "900", marginTop: "4rem", marginBottom: "1.5rem", letterSpacing: "-1px" }}>{line.replace('## ', '')}</h2>;
                }
                if (line.startsWith('### ')) {
                  return <h3 key={i} style={{ fontSize: "1.8rem", fontWeight: "800", marginTop: "3rem", marginBottom: "1rem", color: COLORS.accent }}>{line.replace('### ', '')}</h3>;
                }
                if (line.startsWith('- **') || line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={i} style={{ marginBottom: "1.5rem" }}>
                      {parts.map((part, idx) => (
                        <span key={idx} style={idx % 2 === 1 ? { fontWeight: "900", color: COLORS.accent } : {}}>
                          {part}
                        </span>
                      ))}
                    </p>
                  );
                }
                if (line.trim() === "") return <div key={i} style={{ height: "1rem" }} />;
                return <p key={i} style={{ marginBottom: "2rem" }}>{line}</p>;
              })}
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
                  {selectedPost.tableOfContents.map((item, i) => (
                    <div key={i} style={{ fontSize: "0.95rem", color: COLORS.textMuted, cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = COLORS.accent} onMouseLeave={(e) => e.target.style.color = COLORS.textMuted}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* SEO Tags / Metadata (Agent Helper) */}

              {/* SEO Tags / Metadata (Agent Helper) */}
              <div style={{ padding: "1.5rem", background: COLORS.primary, borderRadius: "24px", color: "white" }}>
                 <div style={{ fontSize: "0.7rem", fontWeight: "900", opacity: 0.6, letterSpacing: "1px", marginBottom: "1rem" }}>AGENT METADATA</div>
                 <div style={{ fontSize: "0.8rem", display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px" }}><span style={{ opacity: 0.5 }}>CANONICAL:</span> {selectedPost.metadata.canonicalUrl}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ opacity: 0.5 }}>KEYWORDS:</span>
                      {selectedPost.metadata.keywords.slice(0, 3).map(k => (
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
              cursor: "pointer",
              zIndex: 1000,
            }}
            onClick={() => setShowReelModal(true)}
          >
            {/* Miniature Video Auto-Player */}
            <video
              src={`/reels/${selectedPost.slug}_reel.mp4`}
              muted
              autoPlay
              loop
              playsInline
              onError={() => setVideoError(true)}
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
              <div style={{ fontSize: "0.6rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "1.5px" }}>NEXUS REEL</div>
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
                <video
                  src={`/reels/${selectedPost.slug}_reel.mp4`}
                  autoPlay
                  controls
                  loop
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

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
          <AnimatePresence>
            {posts.map((post, idx) => (
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
                  <img src={post.featuredImage} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={post.title} />
                  <div style={{ 
                    position: "absolute", top: "2rem", left: "2rem", 
                    background: "white", padding: "8px 18px", borderRadius: "99px",
                    display: "flex", alignItems: "center", gap: "10px", 
                    fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary,
                    boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
                  }}>
                    {getCategoryIcon(post.category)} {post.category.toUpperCase()}
                  </div>
                  {post.featured && (
                    <div style={{ position: "absolute", bottom: "2rem", right: "2rem", background: COLORS.accent, color: "white", padding: "6px 16px", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "900", letterSpacing: "1px" }}>
                      FEATURED
                    </div>
                  )}
                </div>

                <div style={{ marginTop: "2.5rem", padding: "0 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1rem", fontSize: "0.8rem", fontWeight: "800", color: COLORS.textMuted, letterSpacing: "1px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={14} color={COLORS.accent}/> {post.readTime.toUpperCase()}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><User size={14}/> {post.author.name.toUpperCase()}</div>
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
      </main>

      <footer style={{ padding: "10rem 5% 5rem", background: COLORS.bgSoft, borderTop: `1px solid ${COLORS.border}`, marginTop: "10rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: "900", letterSpacing: "4px", color: COLORS.primary, marginBottom: "1.5rem" }}>SWARM COMMAND</div>
          <div style={{ display: "flex", justifyContent: "center", gap: "3rem", marginBottom: "4rem", fontSize: "0.9rem", fontWeight: "700", color: COLORS.textMuted }}>
            <span>NETWORK</span>
            <span>PROTOCOLS</span>
            <span>INTELLIGENCE</span>
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: "0.8rem", letterSpacing: "1px", opacity: 0.6 }}>© 2026 NEXUS OPERATING SYSTEM · ELITE AGENTIC EDITION</div>
      </footer>
    </div>
  );
};

export default BlogSection;
