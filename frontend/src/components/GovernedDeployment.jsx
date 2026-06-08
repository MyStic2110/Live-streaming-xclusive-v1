import React, { useState, useEffect } from "react";
import { Server, Cloud, Layers, Network, ArrowLeft, Check, ChevronRight, Shield, Zap, Cpu, DollarSign, TrendingUp } from "lucide-react";
import { setupPageAEO, cleanupPageAEO } from "../utils/aeo";

const COLORS = {
  bg: "#080c14",
  bgSoft: "rgba(17, 24, 39, 0.7)",
  primary: "#ffffff",
  textMuted: "#9ca3af",
  accent: "#3b82f6",
  accentGlow: "rgba(59, 130, 246, 0.4)",
  success: "#10b981",
  border: "rgba(255, 255, 255, 0.08)",
  cardBg: "rgba(255, 255, 255, 0.02)",
  cardBorderHover: "rgba(59, 130, 246, 0.3)"
};

function GovernedDeployment({ onBack }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [activeTab, setActiveTab] = useState("docker");

  useEffect(() => {
    // Dynamic AEO Setup for SEO Best Practices
    setupPageAEO({
      title: "Governed Deployment | Private AI Swarm Infrastructure",
      description: "Deploy the AI control plane inside your secure VPC or data centre. Supports On-Prem, Private Cloud, Self-Hosted, and Hybrid deployment models.",
      keywords: ["private ai deployment", "on-prem ai", "private cloud ai", "governed deployment", "swarm ai", "swarm agentic lab deployment", "kubernetes ai control plane"],
      url: window.location.href,
      schemaId: "governed-deployment-aeo",
      schemaData: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "Governed Deployment Platform",
        "description": "Deploy the AI control plane, not another model server.",
        "provider": {
          "@type": "Organization",
          "name": "Swarm Agentic Lab",
          "logo": "https://yourdomain.com/logo.jpeg"
        }
      }
    });

    return () => cleanupPageAEO("governed-deployment-aeo");
  }, []);

  const models = [
    {
      id: "on-prem",
      title: "On-Prem",
      icon: <Server size={24} style={{ color: "#3b82f6" }} />,
      desc: "GPU servers in your data centre. Full control, zero external dependencies. Recommended for regulated industries and air-gapped requirements.",
      badge: "Air-Gapped",
      specs: ["Local hardware isolation", "Physical security perimeter", "Zero latency data ingress"]
    },
    {
      id: "private-cloud",
      title: "Private Cloud",
      icon: <Cloud size={24} style={{ color: "#8b5cf6" }} />,
      desc: "AWS, Azure, or GCP — deployed inside your VPC. No data leaves your cloud account. Supports GPU instance types across all major providers.",
      badge: "VPC Enclave",
      specs: ["AWS / GCP / Azure Native", "IAM & Private Link integration", "Dynamic scaling of GPU groups"]
    },
    {
      id: "self-hosted",
      title: "Self-Hosted Private Cloud",
      icon: <Layers size={24} style={{ color: "#ec4899" }} />,
      desc: "VMware, OpenStack, or Proxmox on your existing data centre infrastructure. Swarm Agentic Lab deploys via Docker Compose or Kubernetes.",
      badge: "Hypervisor Native",
      specs: ["Docker Compose & K8s ready", "Enterprise virtualization support", "Multi-tenant resource pools"]
    },
    {
      id: "hybrid",
      title: "Hybrid",
      icon: <Network size={24} style={{ color: "#10b981" }} />,
      desc: "On-prem inference combined with cloud integrations. Run your models on owned hardware while connecting to cloud-based storage or services.",
      badge: "Split-plane",
      specs: ["Edge inference optimization", "Secure cloud gateway tunnels", "Distributed agent orchestrator"]
    }
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage: "radial-gradient(circle at top right, rgba(59, 130, 246, 0.08) 0%, transparent 45%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.04) 0%, transparent 40%)",
        color: COLORS.primary,
        fontFamily: "'Outfit', sans-serif",
        padding: "2rem 5%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "4rem"
      }}
    >
      <style>{`
        .deployment-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2rem;
          width: 100%;
        }
        @media (max-width: 1024px) {
          .deployment-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .deployment-grid {
            grid-template-columns: 1fr;
          }
        }
        .tier-card-wrapper {
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tier-card-image-container {
          position: relative;
          width: 100%;
          height: 180px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }
        .tier-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tier-card-wrapper:hover .tier-card-image {
          transform: scale(1.08);
        }
      `}</style>
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${COLORS.border}`,
          paddingBottom: "1.5rem",
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src="/logo.jpeg"
            alt="Swarm Logo"
            style={{
              height: "42px",
              width: "42px",
              borderRadius: "10px",
              objectFit: "cover",
              boxShadow: "0 4px 20px rgba(59, 130, 246, 0.2)"
            }}
          />
          <div>
            <span style={{ fontSize: "0.65rem", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "3px 10px", borderRadius: "50px", fontWeight: "900", letterSpacing: "1px" }}>
              ENTERPRISE CONTROL PLANE
            </span>
            <div style={{ fontSize: "1.3rem", fontWeight: "900", letterSpacing: "0.5px", marginTop: "4px" }}>
              SWARM <span style={{ color: COLORS.accent }}>SECURE</span>
            </div>
          </div>
        </div>

        <button
          id="btn-back-to-hq"
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0.75rem 1.5rem",
            background: "rgba(255, 255, 255, 0.02)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "12px",
            color: "#f3f4f6",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.border = `1px solid rgba(59, 130, 246, 0.4)`;
            e.currentTarget.style.transform = "translateX(-3px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
            e.currentTarget.style.border = `1px solid ${COLORS.border}`;
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >
          <ArrowLeft size={16} /> Back to Swarm HQ
        </button>
      </header>

      {/* Hero Content */}
      <section
        style={{
          maxWidth: "900px",
          margin: "2rem auto 0",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "linear-gradient(90deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            padding: "6px 16px",
            borderRadius: "99px",
            color: "#60a5fa",
            fontSize: "0.85rem",
            fontWeight: "700",
            letterSpacing: "0.5px",
            boxShadow: "0 4px 30px rgba(59, 130, 246, 0.05)"
          }}
        >
          <Shield size={14} /> SECURITY & ISOLATION
        </div>

        <h1
          style={{
            fontSize: "4.5rem",
            fontWeight: "900",
            lineHeight: "1.05",
            letterSpacing: "-2px",
            margin: "0.5rem 0",
            background: "linear-gradient(to right, #ffffff, #93c5fd, #c084fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          Governed Deployment
        </h1>

        <p
          style={{
            fontSize: "1.8rem",
            fontWeight: "400",
            color: "#e2e8f0",
            maxWidth: "750px",
            lineHeight: "1.3",
            margin: 0
          }}
        >
          Deploy the AI control plane, not another model server.
        </p>

        <p
          style={{
            fontSize: "1.1rem",
            color: COLORS.textMuted,
            maxWidth: "650px",
            lineHeight: "1.7",
            margin: 0
          }}
        >
          In traditional SaaS configurations, your sensitive enterprise context travels across foreign server gateways. Swarm Agentic Lab flips this model: your data remains static, while the AI swarm operates directly within your VPC boundaries.
        </p>
      </section>

      {/* Main Grid of Deployment Models */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem"
        }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "900", letterSpacing: "-0.5px", margin: 0 }}>
            Deployment Models
          </h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
            Swarm does not require public SaaS hosting. All components operate inside your controlled infrastructure.
          </p>
        </div>

        <div className="deployment-grid">
          {models.map(model => {
            const isHovered = hoveredCard === model.id;
            return (
              <div
                id={`card-model-${model.id}`}
                key={model.id}
                onMouseEnter={() => setHoveredCard(model.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: COLORS.cardBg,
                  backdropFilter: "blur(16px)",
                  border: `1px solid ${isHovered ? COLORS.cardBorderHover : COLORS.border}`,
                  borderRadius: "24px",
                  padding: "2.5rem 2rem",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                  boxShadow: isHovered 
                    ? `0 15px 40px -10px ${COLORS.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.05)`
                    : "0 10px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.02)",
                  transform: isHovered ? "translateY(-6px)" : "translateY(0)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    style={{
                      height: "56px",
                      width: "56px",
                      borderRadius: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid ${COLORS.border}`,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
                    }}
                  >
                    {model.icon}
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "800",
                      background: "rgba(255,255,255,0.04)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      color: COLORS.textMuted,
                      border: `1px solid ${COLORS.border}`
                    }}
                  >
                    {model.badge}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <h3 style={{ fontSize: "1.4rem", fontWeight: "800", letterSpacing: "-0.3px", margin: 0, color: isHovered ? "#60a5fa" : "#ffffff", transition: "color 0.2s" }}>
                    {model.title}
                  </h3>
                  <p style={{ fontSize: "0.95rem", lineHeight: "1.6", color: COLORS.textMuted, margin: 0 }}>
                    {model.desc}
                  </p>
                </div>

                <div style={{ height: "1px", background: COLORS.border, margin: "0.5rem 0" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", marginTop: "auto" }}>
                  {model.specs.map((spec, sIdx) => (
                    <div key={sIdx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Check size={14} style={{ color: COLORS.success, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.85rem", color: "#d1d5db" }}>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Matrix / Comparison Table */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "2rem auto 0",
          background: "rgba(255, 255, 255, 0.01)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: "32px",
          padding: "3.5rem 3rem",
          boxSizing: "border-box",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2rem", marginBottom: "3rem", alignItems: "flex-end" }}>
          <div>
            <h3 style={{ fontSize: "1.8rem", fontWeight: "900", letterSpacing: "-0.5px", margin: 0 }}>
              Architecture Matrix
            </h3>
            <p style={{ fontSize: "1rem", color: COLORS.textMuted, margin: "0.5rem 0 0 0" }}>
              How governed deployment compares with standard black-box SaaS APIs.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${COLORS.border}`, padding: "8px 16px", borderRadius: "12px", fontSize: "0.85rem", color: "#60a5fa", fontWeight: "600" }}>
            <Cpu size={14} /> Local Agent Host Protocol
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: "1.2rem 1.5rem", color: "#fff", fontWeight: "800", fontSize: "0.9rem" }}>VECTOR / ANGLE</th>
                <th style={{ padding: "1.2rem 1.5rem", color: "#9ca3af", fontWeight: "800", fontSize: "0.9rem" }}>BLACK-BOX SaaS API</th>
                <th style={{ padding: "1.2rem 1.5rem", color: "#60a5fa", fontWeight: "800", fontSize: "0.9rem" }}>SWARM GOVERNED DEPLOYMENT</th>
              </tr>
            </thead>
            <tbody>
              {[
                { vector: "Data Residency", saas: "Data exits firewall to third-party endpoints", swarm: "100% data residency inside your secure network boundaries" },
                { vector: "Model Isolation", saas: "Shared public tenancy and server models", swarm: "Private instances, dedicated GPUs, air-gapped clusters" },
                { vector: "Latency Control", saas: "Network roundtrips over public internet (unstable P99)", swarm: "Ultra-low local LAN network fabric routing" },
                { vector: "Tool Integrations", saas: "Requires exposing internal APIs to external triggers", swarm: "Direct secure orchestration with databases & internal microservices" },
                { vector: "Compliance & Audit", saas: "Relies on external platform SLAs and trust protocols", swarm: "Complete audit trails and self-sovereign telemetry logging" }
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.01)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "1.5rem", fontWeight: "700", color: "#ffffff", fontSize: "0.95rem" }}>{row.vector}</td>
                  <td style={{ padding: "1.5rem", color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "1.5" }}>{row.saas}</td>
                  <td style={{ padding: "1.5rem", color: "#e2e8f0", fontSize: "0.9rem", lineHeight: "1.5", fontWeight: "500" }}>{row.swarm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hardware Requirements by Tier */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "2rem auto 0",
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem"
        }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "900", letterSpacing: "-0.5px", margin: 0 }}>
            Hardware Requirements by Tier
          </h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
            Three configuration presets optimized for distinct computational workloads, VRAM limits, and concurrent agent throughput.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "2rem",
            width: "100%"
          }}
        >
          {[
            {
              tier: "Tier 1: Developer / Pilot",
              workload: "Testing & prototyping (2-5 concurrent active agents)",
              gpu: "1x NVIDIA RTX 4090 or A10G (24GB VRAM)",
              specs: [
                { label: "CPU", val: "8-Core AMD EPYC / Intel Xeon" },
                { label: "System RAM", val: "32GB System RAM" },
                { label: "Storage", val: "500GB NVMe SSD (Gen 4)" },
                { label: "Deployment", val: "Docker Compose Single Node" }
              ],
              glow: "rgba(59, 130, 246, 0.15)",
              border: "rgba(59, 130, 246, 0.2)",
              image: "/insights/tier1_workstation.png"
            },
            {
              tier: "Tier 2: Production / Enterprise",
              workload: "Medium operational fleet (15-20 concurrent active agents)",
              gpu: "2x - 4x NVIDIA A100 or H100 (80GB VRAM)",
              specs: [
                { label: "CPU", val: "32-Core AMD EPYC / Intel Xeon" },
                { label: "System RAM", val: "256GB System RAM" },
                { label: "Storage", val: "2TB NVMe RAID SSD" },
                { label: "Deployment", val: "Kubernetes / Helm Chart" }
              ],
              glow: "rgba(139, 92, 246, 0.15)",
              border: "rgba(139, 92, 246, 0.2)",
              image: "/insights/tier2_server.png"
            },
            {
              tier: "Tier 3: Hyper-Scale Swarms",
              workload: "Enterprise orchestrations (100+ concurrent active agents)",
              gpu: "8x NVIDIA H100 or H200 Nodes (80GB / 141GB VRAM)",
              specs: [
                { label: "CPU", val: "Dual 64-Core EPYC (128 Cores Total)" },
                { label: "System RAM", val: "512GB - 1TB System RAM" },
                { label: "Storage", val: "8TB High-Performance NVMe Pool" },
                { label: "Deployment", val: "Kubernetes Multi-Node Cluster" }
              ],
              glow: "rgba(236, 72, 153, 0.15)",
              border: "rgba(236, 72, 153, 0.2)",
              image: "/insights/tier3_datacenter.png"
            }
          ].map((tierCard, index) => (
            <div
              key={index}
              className="tier-card-wrapper"
              style={{
                border: `1px solid ${COLORS.border}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.border = `1px solid ${tierCard.border}`;
                e.currentTarget.style.boxShadow = `0 15px 40px -10px ${tierCard.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.border = `1px solid ${COLORS.border}`;
                e.currentTarget.style.boxShadow = `0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.02)`;
              }}
            >
              <div className="tier-card-image-container">
                <img src={tierCard.image} alt={tierCard.tier} className="tier-card-image" />
              </div>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: "900", margin: 0, color: "#ffffff" }}>
                  {tierCard.tier}
                </h3>
                <p style={{ fontSize: "0.85rem", color: COLORS.textMuted, marginTop: "6px", lineHeight: "1.4", minHeight: "2.8rem" }}>
                  {tierCard.workload}
                </p>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "16px",
                  padding: "1.2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem"
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: "800", color: COLORS.textMuted, letterSpacing: "1px" }}>RECOMMENDED GPU</div>
                <div style={{ fontSize: "0.95rem", fontWeight: "800", color: "#60a5fa" }}>{tierCard.gpu}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
                {tierCard.specs.map((spec, sIdx) => (
                  <div key={sIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
                    <span style={{ color: COLORS.textMuted }}>{spec.label}</span>
                    <span style={{ fontWeight: "700", color: "#e2e8f0" }}>{spec.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive Terminal Blueprint & Deployment Guide */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "2rem auto 0",
          background: "rgba(255, 255, 255, 0.01)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: "32px",
          padding: "3.5rem 3rem",
          boxSizing: "border-box",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2rem", marginBottom: "2.5rem", alignItems: "flex-end" }}>
          <div>
            <h3 style={{ fontSize: "1.8rem", fontWeight: "900", letterSpacing: "-0.5px", margin: 0 }}>
              Deployment Blueprints
            </h3>
            <p style={{ fontSize: "1rem", color: COLORS.textMuted, margin: "0.5rem 0 0 0" }}>
              Actual commands and configuration manifests used to spin up the local agent orchestrator framework.
            </p>
          </div>
          
          {/* Tab buttons */}
          <div style={{ display: "flex", gap: "8px", background: "rgba(255, 255, 255, 0.02)", border: `1px solid ${COLORS.border}`, padding: "6px", borderRadius: "14px" }}>
            {[
              { id: "docker", label: "Docker Compose" },
              { id: "helm", label: "Kubernetes (Helm)" },
              { id: "offline", label: "Air-Gapped (VPC)" }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "8px 16px",
                    background: isActive ? "rgba(59, 130, 246, 0.1)" : "transparent",
                    border: "none",
                    borderRadius: "10px",
                    color: isActive ? "#60a5fa" : COLORS.textMuted,
                    fontWeight: "700",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    transition: "all 0.2s"
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Terminal block */}
        <div
          style={{
            background: "#030712",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: "20px",
            fontFamily: "Courier New, Courier, monospace",
            fontSize: "0.9rem",
            color: "#34d399",
            padding: "2rem",
            position: "relative",
            overflowX: "auto",
            boxShadow: "inset 0 1px 15px rgba(0,0,0,0.8)"
          }}
        >
          {/* Top Bar red/yellow/green dots */}
          <div style={{ display: "flex", gap: "6px", position: "absolute", top: "16px", left: "16px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></div>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }}></div>
            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></div>
          </div>
          <div style={{ fontSize: "0.75rem", color: COLORS.textMuted, position: "absolute", top: "14px", left: "50%", transform: "translateX(-50%)" }}>
            {activeTab === "docker" ? "docker-compose.yml" : activeTab === "helm" ? "install.sh" : "bundle.sh"}
          </div>

          <pre style={{ margin: "1rem 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: "1.6" }}>
            {activeTab === "docker" && `# docker-compose.yml for Swarm Agentic Lab Control Plane
version: "3.8"
services:
  swarm-control-plane:
    image: swarmagentic/control-plane:v1.2.0
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - MODEL_ROUTER_URL=http://model-router:5000
      - STATE_MANAGER_REDIS=redis://redis:6379/0
      - TELEMETRY_INGRESS_URL=https://telemetry.swarm.internal
    volumes:
      - swarm-data:/var/lib/swarm

  model-router:
    image: swarmagentic/model-router:v1.2.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

volumes:
  swarm-data:`}

            {activeTab === "helm" && `# Add the Swarm Agentic Lab Helm Repository
helm repo add swarm-agentic https://charts.swarmagentic.lab/
helm repo update

# Configure custom values.yaml for VPC installation
cat <<EOF > values.yaml
global:
  vpcIsolation: true
  gpuInstanceType: "g5.4xlarge"
controlPlane:
  replicaCount: 3
  redis:
    clusterMode: true
telemetry:
  aivyuhAuditEnabled: true
EOF

# Install the Helm Chart into your isolated namespace
helm install swarm-control-plane swarm-agentic/control-plane \\
  --namespace swarm-system \\
  --create-namespace \\
  -f values.yaml`}

            {activeTab === "offline" && `# 1. Download and package the Swarm Control Plane offline bundle
swarm-cli bundle package --version v1.2.0 --output swarm-offline-v1.2.0.tar.gz

# 2. Transfer the tarball to your secure air-gapped environment
scp swarm-offline-v1.2.0.tar.gz secure-node:/tmp/

# 3. Load the images into your local registry (e.g. Harbor or Docker daemon)
ssh secure-node "tar -xzf /tmp/swarm-offline-v1.2.0.tar.gz -C /opt/swarm && /opt/swarm/scripts/load-images.sh"

# 4. Initialize the cluster database and local models
ssh secure-node "/opt/swarm/bin/swarm-admin init --local-weights-path /opt/models/weights"`}
          </pre>
        </div>
      </section>

      {/* Pricing & Budgeting Guidance */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "2rem auto 0",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "2rem"
        }}
      >
        {/* Pricing Philosophy */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.01)",
            backdropFilter: "blur(20px)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "28px",
            padding: "3rem 2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ height: "48px", width: "48px", borderRadius: "12px", background: "rgba(59, 130, 246, 0.1)", border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "center", alignItems: "center", color: "#60a5fa" }}>
              <DollarSign size={20} />
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#60a5fa", letterSpacing: "1px" }}>LICENSING STRUCTURE</span>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "900", margin: "2px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>Pricing Philosophy</h3>
            </div>
          </div>
          
          <h4 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#ffffff", margin: "0.5rem 0 0 0" }}>
            Why pricing starts with scope, not seats.
          </h4>
          <p style={{ fontSize: "0.95rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
            Swarm Agentic Lab rejects public per-user licensing and token-only billing models. Because governed AI deployments depend heavily on your unique infrastructure profile, GPU provisioning, concurrent traffic patterns, memory partitions, compliance frameworks, validation layers, and SLA guarantees, we tailormake every installation scope. The architectural foundation remains consistent, while the final investment is optimized directly for your specific operating environment.
          </p>
        </div>

        {/* Budgeting Guidance */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.01)",
            backdropFilter: "blur(20px)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: "28px",
            padding: "3rem 2.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            boxSizing: "border-box"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ height: "48px", width: "48px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.1)", border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "center", alignItems: "center", color: "#34d399" }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "#34d399", letterSpacing: "1px" }}>ENGAGEMENT PATHWAY</span>
              <h3 style={{ fontSize: "1.5rem", fontWeight: "900", margin: "2px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>Budgeting Guidance</h3>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", marginTop: "0.5rem" }}>
            <p style={{ fontSize: "0.95rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
              Most enterprise integrations begin with a readiness diagnostic or a proof-of-concept pilot before transitioning to annual platform subscriptions.
            </p>
            
            <div style={{ display: "flex", gap: "12px", background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.15)", padding: "1rem", borderRadius: "12px" }}>
              <span style={{ color: "#f87171", fontSize: "1.2rem", lineHeight: "1" }}>⚠️</span>
              <p style={{ fontSize: "0.85rem", lineHeight: "1.5", color: "#f87171", margin: 0, fontWeight: "500" }}>
                Infrastructure spend (dedicated GPU clusters, cloud storage hosts, VPC networking interfaces) remains completely separate and is borne directly by the customer in their cloud accounts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section
        style={{
          maxWidth: "1200px",
          width: "100%",
          margin: "0 auto 4rem",
          background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.03) 100%)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: "32px",
          padding: "4rem",
          textAlign: "center",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          boxShadow: "0 10px 40px rgba(59, 130, 246, 0.05)"
        }}
      >
        <h3 style={{ fontSize: "2.2rem", fontWeight: "900", letterSpacing: "-0.5px", margin: 0 }}>
          Ready to Deploy Secure AI?
        </h3>
        <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "550px", margin: 0, lineHeight: "1.6" }}>
          Contact our architecture engineers to discuss VPC boundaries, security posture models, or Docker/Kubernetes deployment blueprints.
        </p>
        <a
          id="btn-cta-enterprise-deployment"
          href="https://wa.me/919791388549"
          target="_blank"
          rel="noreferrer"
          style={{
            marginTop: "1rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "1.1rem 2.5rem",
            background: COLORS.accent,
            color: "white",
            textDecoration: "none",
            borderRadius: "16px",
            fontWeight: "900",
            fontSize: "1rem",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#2563eb";
            e.currentTarget.style.transform = "scale(1.03)";
            e.currentTarget.style.boxShadow = `0 10px 25px ${COLORS.accentGlow}`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = COLORS.accent;
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          Request VPC Installation Architecture <ChevronRight size={18} />
        </a>
      </section>

      {/* Disclaimer */}
      <p
        style={{
          fontSize: "0.75rem",
          color: COLORS.textMuted,
          textAlign: "center",
          maxWidth: "750px",
          margin: "0 auto 3rem",
          lineHeight: "1.6",
          opacity: 0.7
        }}
      >
        Disclaimer: This estimate is for initial planning purposes only. Actual hardware requirements depend on model selection, query complexity, ingestion volume, and concurrency patterns. Final specifications should be confirmed during a deployment sizing session with the team.
      </p>
    </div>
  );
}

export default GovernedDeployment;
