import React, { useState, useMemo, useEffect, useRef } from 'react';
import './TopologyGraph.css';

/**
 * Premium Interactive SVG-based Topology Graph
 * Visualizes agent node hierarchies, external microservices, and live data telemetry flows.
 * Supports a focused, dedicated view when inspecting a single agent.
 */
export default function TopologyGraph({ agents, onSelect, services = {}, activeFlows = {}, hallucinationResults = {}, loopStatuses = {} }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  // Zoom and Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Physics & Interaction References
  const svgRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const draggedNodeRef = useRef(null);
  const transformRef = useRef(transform);
  const dragDistanceRef = useRef(0);

  const [nodePositions, setNodePositions] = useState({});
  const [isDraggingNode, setIsDraggingNode] = useState(false);

  const isSingle = agents.length === 1;

  // Sync transformRef with transform state
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Coordinate helper mapping client pixels to SVG viewBox space (900x480)
  const getSVGCoords = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Scale container client pixels back to SVG coordinates (0-900, 0-480)
    const viewBoxX = (mouseX / rect.width) * 900;
    const viewBoxY = (mouseY / rect.height) * 480;
    
    return { x: viewBoxX, y: viewBoxY };
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.canvas-controls')) return;

    // Check if clicking a graph node
    const clickedNodeElement = e.target.closest('.graph-node');
    if (clickedNodeElement) {
      const nodeId = clickedNodeElement.dataset.id;
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (node && node.isConnected) {
        setIsDraggingNode(true);
        draggedNodeRef.current = nodeId;
        dragDistanceRef.current = 0;
        
        // Reset velocity
        node.vx = 0;
        node.vy = 0;
        
        // Disable canvas pan dragging
        setIsDragging(false);
        return;
      }
    }

    // Canvas panning
    if (e.target.tagName === 'svg' || e.target.id === 'graph-bg') {
      setIsDragging(true);
      const { x: svgMouseX, y: svgMouseY } = getSVGCoords(e);
      setDragStart({ x: svgMouseX - transform.x, y: svgMouseY - transform.y });
    }
  };

  const handleMouseMove = (e) => {
    if (draggedNodeRef.current) {
      // Direct drag manipulation
      const { x: svgMouseX, y: svgMouseY } = getSVGCoords(e);
      const currentTransform = transformRef.current;
      
      const svgX = (svgMouseX - currentTransform.x) / currentTransform.scale;
      const svgY = (svgMouseY - currentTransform.y) / currentTransform.scale;
      
      const node = nodesRef.current.find(n => n.id === draggedNodeRef.current);
      if (node) {
        node.x = svgX;
        node.y = svgY;
        node.vx = 0;
        node.vy = 0;
      }
      
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      return;
    }

    if (isDragging) {
      const { x: svgMouseX, y: svgMouseY } = getSVGCoords(e);
      setTransform(prev => ({
        ...prev,
        x: svgMouseX - dragStart.x,
        y: svgMouseY - dragStart.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsDraggingNode(false);
    draggedNodeRef.current = null;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const nextScale = e.deltaY < 0 ? transform.scale * zoomFactor : transform.scale / zoomFactor;
    const boundedScale = Math.min(Math.max(nextScale, 0.4), 3.0);
    
    const { x: svgMouseX, y: svgMouseY } = getSVGCoords(e);
    
    const svgX = (svgMouseX - transform.x) / transform.scale;
    const svgY = (svgMouseY - transform.y) / transform.scale;
    
    setTransform({
      x: svgMouseX - svgX * boundedScale,
      y: svgMouseY - svgY * boundedScale,
      scale: boundedScale
    });
  };

  const handleZoomIn = () => {
    setTransform(prev => {
      const nextScale = Math.min(prev.scale * 1.2, 3.0);
      return {
        x: 450 - (450 - prev.x) * (nextScale / prev.scale),
        y: 240 - (240 - prev.y) * (nextScale / prev.scale),
        scale: nextScale
      };
    });
  };

  const handleZoomOut = () => {
    setTransform(prev => {
      const nextScale = Math.max(prev.scale / 1.2, 0.4);
      return {
        x: 450 - (450 - prev.x) * (nextScale / prev.scale),
        y: 240 - (240 - prev.y) * (nextScale / prev.scale),
        scale: nextScale
      };
    });
  };

  const handleResetTransform = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  // Group and arrange nodes & external microservices dynamically based on density
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    // 2. Microservice destinations (Organized in Top and Bottom rows to prevent overlapping)
    const servicesList = [
      { id: 'mem0_service', name: 'Mem0 Memory', x: 80, y: 50, type: 'service', status: services.mem0 ? 'online' : 'offline', desc: 'Semantic Memory Sidecar Engine (Port 8770)' },
      { id: 'qdrant_service', name: 'Qdrant Vector', x: 300, y: 50, type: 'service', status: services.qdrant ? 'online' : 'offline', desc: 'Vector store for Agent long-term memory (Port 6333)' },
      { id: 'loop_engineering_service', name: 'Loop Engineer', x: 450, y: 155, type: 'service', status: 'online', desc: 'Iterative retrieval evaluator: searches until evidence is sufficient to answer the query' },
      { id: 'llm_gateway_service', name: 'OpenRouter LLM', x: 600, y: 50, type: 'service', status: 'online', desc: 'Enterprise OpenRouter LLM API gateway' },
      { id: 'searxng_service', name: 'SearxNG Search', x: 820, y: 50, type: 'service', status: services.searxng ? 'online' : 'offline', desc: 'Privacy-respecting meta-search engine API (Port 8081)' },
      
      { id: 'livekit_service', name: 'LiveKit Voice', x: 80, y: 430, type: 'service', status: services.livekit ? 'online' : 'offline', desc: 'Real-time WebRTC audio & speech streaming server (Port 7880)' },
      { id: 'db_service', name: 'PostgreSQL DB', x: 300, y: 430, type: 'service', status: services.db ? 'online' : 'offline', desc: 'Main transactional Swarm database (Port 5433)' },
      { id: 'redis_service', name: 'Redis Pub/Sub', x: 600, y: 430, type: 'service', status: services.redis ? 'online' : 'offline', desc: 'Redis event broker & telemetry stream (Port 6379)' },
      { id: 'securelytix_service', name: 'Securelytix SDK', x: 820, y: 430, type: 'service', status: services.securelytix ? 'online' : 'offline', desc: 'Vulnerability scanners & compliance pipelines (Port 8080)' }
    ];

    if (isSingle) {
      // --- FOCUSED SINGLE AGENT VIEW LAYOUT ---
      const agent = agents[0];
      const id = agent.id.toLowerCase();

      // Center the single agent node in the canvas
      const agentNode = {
        id,
        name: agent.name,
        type: 'agent',
        status: agent.status || 'offline',
        x: 450,
        y: 240,
        agentData: agent
      };

      nodes.push(agentNode, ...servicesList);

      // --- DYNAMIC service wiring from agent.services (returned by /api/agents) ---
      const agentServices = agent.agentData?.services || agent.services || [];
      
      // For Swarm Copilot: route through Loop Engineering node
      const isCopilot = id.includes('copilot');
      if (isCopilot) {
        // Agent -> Loop Engineer (always wired for copilot)
        links.push({ from: id, to: 'loop_engineering_service', isServiceLink: true });
        // Loop Engineer -> mem0, searxng, llm_gateway (the retrieval chain)
        links.push({ from: 'loop_engineering_service', to: 'mem0_service', isServiceLink: true });
        links.push({ from: 'loop_engineering_service', to: 'searxng_service', isServiceLink: true });
        links.push({ from: 'loop_engineering_service', to: 'llm_gateway_service', isServiceLink: true });
        links.push({ from: 'mem0_service', to: 'qdrant_service', isServiceLink: true });
        // Wire remaining agent-specific services directly
        agentServices.filter(svcId => !['mem0_service','searxng_service','llm_gateway_service'].includes(svcId)).forEach(svcId => {
          links.push({ from: id, to: svcId, isServiceLink: true });
        });
      } else {
        agentServices.forEach(svcId => {
          links.push({ from: id, to: svcId, isServiceLink: true });
        });
        // If mem0 is connected, auto-add the mem0 -> qdrant cascade link
        if (agentServices.includes('mem0_service')) {
          links.push({ from: 'mem0_service', to: 'qdrant_service', isServiceLink: true });
        }
      }

    } else {
      // --- GENERAL CLUSTER VIEW LAYOUT ---
      const hubs = [
        { id: 'infra_hub', name: 'Security & Telemetry', x: 220, y: 120, type: 'hub', status: 'online', desc: 'System compliance guards and performance tracers' },
        { id: 'support_hub', name: 'Core Assistance', x: 450, y: 120, type: 'hub', status: 'online', desc: 'Conversation memory and general agents' },
        { id: 'special_hub', name: 'Task Specialists', x: 680, y: 120, type: 'hub', status: 'online', desc: 'Custom business logic and analysis modules' }
      ];

      nodes.push(...hubs, ...servicesList);

      let infraCount = 0;
      let supportCount = 0;
      let specialCount = 0;

      agents.forEach(agent => {
        const id = agent.id.toLowerCase();
        let parentHub = 'support_hub';
        let x = 450;
        let y = 270;

        if (id.includes('devops') || id.includes('octane') || id.includes('nist') || id.includes('aivyuh')) {
          parentHub = 'infra_hub';
          x = 90 + infraCount * 140;
          infraCount++;
        } else if (id.includes('copilot') || id.includes('lina') || id.includes('nova') || id.includes('seva')) {
          parentHub = 'support_hub';
          x = 350 + supportCount * 140;
          supportCount++;
        } else {
          parentHub = 'special_hub';
          x = 610 + specialCount * 140;
          specialCount++;
        }

        nodes.push({
          id,
          name: agent.name,
          type: 'agent',
          status: agent.status || 'offline',
          x,
          y,
          agentData: agent
        });

        links.push({ from: parentHub, to: id });

        // --- DYNAMIC service wiring from agent.services ---
        const agentServices = agent.services || [];
        agentServices.forEach(svcId => {
          links.push({ from: id, to: svcId, isServiceLink: true });
        });
        if (agentServices.includes('mem0_service')) {
          links.push({ from: 'mem0_service', to: 'qdrant_service', isServiceLink: true });
        }
      });
    }

    // Determine connection status for services to dim unconnected ones
    nodes.forEach(node => {
      if (node.type === 'service') {
        node.isConnected = links.some(link => link.from === node.id || link.to === node.id);
      } else {
        node.isConnected = true;
      }
    });

    return { nodes, links };
  }, [agents, services, isSingle]);


  // Synchronize dynamic elements whenever topology structure changes
  useEffect(() => {
    const nextNodes = graphData.nodes.map(n => {
      const existing = nodesRef.current.find(ex => ex.id === n.id);
      if (existing) {
        return {
          ...n,
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          targetX: n.x,
          targetY: n.y
        };
      } else {
        return {
          ...n,
          x: n.x + (Math.random() * 60 - 30),
          y: n.y + (Math.random() * 60 - 30),
          vx: 0,
          vy: 0,
          targetX: n.x,
          targetY: n.y
        };
      }
    });

    nodesRef.current = nextNodes;
    linksRef.current = graphData.links;

    // Prefill coordinates state to avoid a blank frame flash
    const initialPositions = {};
    nextNodes.forEach(n => {
      initialPositions[n.id] = { x: n.x, y: n.y };
    });
    setNodePositions(initialPositions);
  }, [graphData]);

  // Main physics loop updating positions at 60fps
  useEffect(() => {
    let animId;
    const tick = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      if (!nodes || nodes.length === 0) return;

      const width = 900;
      const height = 480;
      const cx = width / 2;
      const cy = height / 2;

      // 1. Repel force: push overlapping nodes apart using an ellipse collision boundary
      // since cards are wider horizontally (120-150px) than vertically (40-50px)
      const kRepel = 4.0;
      const rx = 190; // horizontal repel radius
      const ry = 100; // vertical repel radius
      for (let i = 0; i < nodes.length; i++) {
        const u = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const v = nodes[j];
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          
          // normalized distance in ellipse space
          const distSq = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + 0.01;
          const distNorm = Math.sqrt(distSq);
          if (distNorm < 1.0) {
            // Push apart along the actual vector, proportional to overlap
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const overlap = 1.0 - distNorm;
            const f = overlap * 0.12 * kRepel;
            const fx = (dx / dist) * f * 100;
            const fy = (dy / dist) * f * 100;
            
            u.vx -= fx;
            u.vy -= fy;
            v.vx += fx;
            v.vy += fy;
          }
        }
      }

      // 2. Spring force: pull connected nodes closer
      const kLink = 0.02;
      const restLength = isSingle ? 210 : 160;
      links.forEach(link => {
        // Skip service connections to keep them perfectly aligned to their grid columns/rows
        if (link.isServiceLink) return;

        const u = nodes.find(n => n.id === link.from);
        const v = nodes.find(n => n.id === link.to);
        if (u && v) {
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (dist - restLength) * kLink;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          
          u.vx += fx;
          u.vy += fy;
          v.vx -= fx;
          v.vy -= fy;
        }
      });

      // 3. Category structured alignment (soft gravity towards targets)
      const kAnchor = 0.06;
      nodes.forEach(node => {
        if (node.id === draggedNodeRef.current) return;
        
        const isMainAgent = isSingle && node.type === 'agent';
        const strength = isMainAgent ? 0.25 : kAnchor;
        
        node.vx += (node.targetX - node.x) * strength;
        node.vy += (node.targetY - node.y) * strength;
      });

      // 4. Premium floating micro-drift effect
      const time = Date.now() * 0.001;
      nodes.forEach((node, idx) => {
        if (node.id === draggedNodeRef.current) return;
        node.vx += Math.sin(time + idx) * 0.04;
        node.vy += Math.cos(time * 0.8 + idx) * 0.04;
      });

      // 5. Integrate velocity, damp, and keep bounded
      const damping = 0.75;
      nodes.forEach(node => {
        if (node.id === draggedNodeRef.current) {
          node.vx = 0;
          node.vy = 0;
          return;
        }

        node.x += node.vx;
        node.y += node.vy;

        node.vx *= damping;
        node.vy *= damping;

        node.x = Math.max(80, Math.min(width - 80, node.x));
        node.y = Math.max(35, Math.min(height - 35, node.y));
      });

      // Update positions state
      const positions = {};
      nodes.forEach(n => {
        positions[n.id] = { x: n.x, y: n.y };
      });
      setNodePositions(positions);
    };

    const loop = () => {
      tick();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSingle]);


  const handleNodeClick = (node) => {
    // Prevent selection if user is dragging
    if (dragDistanceRef.current > 5) return;

    if (node.type === 'agent' && node.agentData && onSelect) {
      setHoveredNode(null);
      setIsResizing(true);
      onSelect(node.agentData);
      setTimeout(() => {
        setIsResizing(false);
      }, 400);
    }
  };

  return (
    <div className="topology-graph-container">
      {hoveredNode && (
        <div className="topology-info-overlay">
          <div className="hover-card" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
            <div className="hover-card-title">
              <span className={`status-dot ${hoveredNode.status}`}></span>
              <strong>{hoveredNode.name}</strong>
            </div>
            <div className="hover-card-desc">{hoveredNode.desc || hoveredNode.agentData?.business_function || 'Active agent worker'}</div>
            {hoveredNode.agentData && (
              <div className="hover-card-details">
                <div><span>Autonomy:</span> {hoveredNode.agentData.autonomy || 'Medium'}</div>
                <div><span>Risk Tier:</span> {hoveredNode.agentData.risk_tier || 'Low'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <svg 
        ref={svgRef}
        viewBox="0 0 900 480" 
        className={`topology-svg ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : (isDraggingNode ? 'grabbing' : 'grab') }}
      >
        <defs>
          {/* Glowing Filters */}
          <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-indigo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Grid pattern background */}
          <pattern 
            id="graph-grid" 
            width="40" 
            height="40" 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Background Grid */}
        <rect id="graph-bg" width="100%" height="100%" fill="url(#graph-grid)" />

        {/* Outer transform group applying zoom and pan */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Links / Connections */}
          <g className="links-group">
            {graphData.links.map((link, index) => {
              const fromNode = graphData.nodes.find(n => n.id === link.from);
              const toNode = graphData.nodes.find(n => n.id === link.to);

              if (!fromNode || !toNode) return null;

              const fromPos = nodePositions[link.from] || { x: fromNode.x, y: fromNode.y };
              const toPos = nodePositions[link.to] || { x: toNode.x, y: toNode.y };

              const isHovered = hoveredNode && (hoveredNode.id === link.from || hoveredNode.id === link.to);

              // Handle both new metadata-object format and legacy boolean
              const flowKey = `${link.from}->${link.to}`;
              const flowData = activeFlows[flowKey];
              const flowMeta = flowData && typeof flowData === 'object' ? flowData : null;
              const isFlowing = (flowMeta?.active) || (flowData === true) ||
                (toNode.type === 'agent' && toNode.status === 'online' && !link.isServiceLink);

              // Bezier midpoint (t=0.5 on cubic bezier)
              const controlY = (fromPos.y + toPos.y) / 2;
              const pathD = `M ${fromPos.x} ${fromPos.y} C ${fromPos.x} ${controlY}, ${toPos.x} ${controlY}, ${toPos.x} ${toPos.y}`;

              // Midpoint of bezier at t=0.5
              const mx = 0.125 * fromPos.x + 0.375 * fromPos.x + 0.375 * toPos.x + 0.125 * toPos.x;
              const my = 0.125 * fromPos.y + 0.375 * controlY + 0.375 * controlY + 0.125 * toPos.y;

              return (
                <g key={`link-${index}`}>
                  <path d={pathD} className="connection-line-bg" />
                  <path
                    d={pathD}
                    className={`connection-line ${isHovered ? 'highlighted' : ''} ${isFlowing ? 'active-flow' : ''} ${link.isServiceLink ? 'service-link-path' : ''}`}
                  />
                  {/* Floating packet badge — shown only when glow is active and we have metadata */}
                  {isFlowing && flowMeta?.active && flowMeta?.run_id && (
                    <foreignObject
                      x={mx - 68}
                      y={my - 28}
                      width={136}
                      height={52}
                      style={{ overflow: 'visible', pointerEvents: 'none' }}
                    >
                      <div className="flow-packet-badge">
                        <span className="flow-packet-id">#{flowMeta.run_id}</span>
                        <span className="flow-packet-event">{flowMeta.direction} {flowMeta.event}</span>
                        <span className="flow-packet-label">{flowMeta.label}</span>
                        <span className="flow-packet-ts">{flowMeta.ts}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes-group">
            {graphData.nodes.map(node => {
              const pos = nodePositions[node.id] || { x: node.x, y: node.y };
              const isOnline = node.status === 'online';
              const isRoot = node.type === 'root';
              const isHub = node.type === 'hub';
              const isService = node.type === 'service';
              const isAgent = node.type === 'agent';
              const isConnected = node.isConnected;

              const width = isRoot ? 130 : isAgent ? 150 : 120;
              const height = isRoot ? 44 : isAgent ? 50 : 40;
              const rx = 6;

              let nodeClass = 'graph-node';
              if (isRoot) nodeClass += ' root-node';
              else if (isHub) nodeClass += ' hub-node';
              else if (isAgent) nodeClass += ' agent-node';
              else if (isService) {
                nodeClass += ' service-node';
                if (!node.isConnected) {
                  nodeClass += ' unconnected';
                }
              }

              return (
                <g
                  key={node.id}
                  data-id={node.id}
                  transform={`translate(${pos.x - width / 2}, ${pos.y - height / 2})`}
                  className={`${nodeClass} ${hoveredNode?.id === node.id ? 'hovered' : ''}`}
                  onMouseEnter={isConnected ? () => setHoveredNode(node) : undefined}
                  onMouseLeave={isConnected ? () => setHoveredNode(null) : undefined}
                  onClick={() => handleNodeClick(node)}
                  style={{ cursor: (isAgent && isConnected) ? 'pointer' : (isConnected ? 'grab' : 'default') }}
                >
                  {/* Glow Filter for Active Card */}
                  {isOnline && isConnected && (
                    <rect
                      width={width}
                      height={height}
                      rx={rx}
                      fill="none"
                      stroke={isRoot ? "#3b82f6" : isAgent ? "#10b981" : "#818cf8"}
                      strokeWidth="3"
                      filter="url(#glow-indigo)"
                      style={{ opacity: 0.3 }}
                    />
                  )}

                  {/* Main Card Rect */}
                  <rect
                      width={width}
                      height={height}
                      rx={rx}
                      className={`node-card ${node.status}`}
                      stroke={!isConnected ? "rgba(255,255,255,0.03)" : isOnline ? (isRoot ? "#3b82f6" : isAgent ? "#10b981" : "#818cf8") : "#ef4444"}
                      strokeWidth="1.5"
                  />

                  {/* Tiny status indicator dot */}
                  {isConnected && (
                    <circle
                      cx={12}
                      cy={height / 2}
                      r={3.5}
                      fill={isOnline ? "#10b981" : "#ef4444"}
                      className={isOnline ? "status-dot-pulse" : ""}
                    />
                  )}

                  {/* Node Details inside card */}
                  <g transform={`translate(${isConnected ? 24 : 14}, 0)`}>
                    {/* Category text */}
                    <text
                      x={0}
                      y={14}
                      className="node-category-text"
                    >
                      {isRoot ? 'ROUTER' : isAgent ? 'AGENT' : 'SERVICE'}
                    </text>

                    {/* Name text */}
                    <text
                      x={0}
                      y={isService ? 27 : 29}
                      className="node-main-label"
                    >
                      {node.name}
                    </text>

                    {/* Metric Subtext for services */}
                    {isService && isConnected && (() => {
                      // Derive live score badges from real-time socket data
                      const latestLoopRun = Object.values(loopStatuses).sort((a,b) => (b.timestamp||0)-(a.timestamp||0))[0];
                      const latestHallucinationRun = Object.values(hallucinationResults).sort((a,b) => new Date(b.evaluated_at||0) - new Date(a.evaluated_at||0))[0];

                      let metricText = '';
                      let metricColor = '#9ca3af';

                      if (node.id === 'loop_engineering_service' && latestLoopRun && latestLoopRun.evidenceScore !== undefined) {
                        const pct = Math.round(latestLoopRun.evidenceScore * 100);
                        metricText = `Evidence: ${pct}%`;
                        metricColor = pct >= 90 ? '#10b981' : pct >= 60 ? '#fbbf24' : '#f87171';
                      } else if (node.id === 'llm_gateway_service' && latestHallucinationRun) {
                        const acc = Math.round((1 - latestHallucinationRun.score) * 100);
                        metricText = `Acc: ${acc}%`;
                        metricColor = acc >= 90 ? '#10b981' : acc >= 70 ? '#fbbf24' : '#f87171';
                      } else {
                        metricText = (
                          node.id === 'db_service' ? 'Port 5433' :
                          node.id === 'qdrant_service' ? 'Port 6333' :
                          node.id === 'mem0_service' ? 'Port 8770' :
                          node.id === 'redis_service' ? 'Port 6379' :
                          node.id === 'searxng_service' ? 'Port 8081' :
                          node.id === 'livekit_service' ? 'Port 7880' :
                          node.id === 'securelytix_service' ? 'Port 8080' : ''
                        );
                      }

                      return metricText ? (
                        <text x={0} y={36} className="node-sub-metric" fill={metricColor} style={{ fontWeight: metricText.startsWith('Evidence') || metricText.startsWith('Acc') ? 700 : 400 }}>
                          {metricText}
                        </text>
                      ) : null;
                    })()}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Canvas Zoom/Pan Controls */}
      <div className="canvas-controls">
        <button onClick={handleZoomIn} title="Zoom In">+</button>
        <button onClick={handleZoomOut} title="Zoom Out">−</button>
        <button onClick={handleResetTransform} title="Reset View">⟲</button>
      </div>
    </div>
  );
}
