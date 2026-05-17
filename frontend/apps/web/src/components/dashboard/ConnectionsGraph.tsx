"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import {
  Database,
  ShoppingCart,
  Cloud,
  Server,
  GitBranch,
  Bug,
  Globe,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionData, AlertData } from "@/lib/api";

export interface GraphActionProposal {
  event_type: "graph_action_proposal";
  action: string;
  connection_id: string;
  label: string;
  message: string;
}

const serviceIcons: Record<string, LucideIcon> = {
  supabase: Database,
  shopify: ShoppingCart,
  aws: Cloud,
  github: GitBranch,
  postgresql: Database,
  sentry: Bug,
  vercel: Globe,
  vercel_deployment: Globe,
  generic_mcp: Server,
  hostinger: Globe,
  netlify: Globe,
  railway: Server,
  "fly.io": Cloud,
  github_pages: GitBranch,
  cloudflare_pages: Globe,
};

type Tone = "indigo" | "teal" | "green" | "red" | "amber" | "muted" | "purple";

const serviceTone: Record<string, Tone> = {
  supabase: "green",
  shopify: "teal",
  aws: "amber",
  github: "indigo",
  postgresql: "green",
  sentry: "red",
  vercel: "muted",
  vercel_deployment: "muted",
  generic_mcp: "muted",
  hostinger: "purple",
  netlify: "teal",
  railway: "purple",
  "fly.io": "indigo",
  github_pages: "indigo",
  cloudflare_pages: "amber",
};

const toneVar: Record<Tone, string> = {
  indigo: "hsl(var(--primary))",
  teal:   "hsl(var(--brand-accent))",
  green:  "hsl(var(--risk-low))",
  red:    "hsl(var(--risk-critical))",
  amber:  "hsl(var(--risk-high))",
  muted:  "hsl(var(--muted-foreground))",
  purple: "hsl(272 72% 47%)",
};

// ── Node + Link types compatible with d3-force ──
interface GNode extends SimulationNodeDatum {
  id: string;
  kind: "center" | "platform" | "deployment" | "service" | "alert";
  label: string;
  type: string;
  tone: Tone;
  status: string;
  Icon: LucideIcon;
  radius: number;
  alertCount?: number;
  url?: string;
  parentId?: string;
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode;
  target: string | GNode;
  distance?: number;
  strength?: number;
}

function statusOk(status: string): boolean {
  return status === "connected";
}
function statusWarn(status: string): boolean {
  return status === "requires_attention" || status === "error" || status === "open";
}

interface ConnectionsGraphProps {
  connections: ConnectionData[];
  alerts?: AlertData[];
  pendingGraphAction?: GraphActionProposal | null;
  onConfirmGraphAction?: () => void;
  onCancelGraphAction?: () => void;
  onAddConnection?: () => void;
  userInitials?: string;
}

const CENTER_ID = "__center__";

export function ConnectionsGraph({
  connections,
  alerts = [],
  pendingGraphAction,
  onConfirmGraphAction,
  onCancelGraphAction,
  onAddConnection,
  userInitials = "U",
}: ConnectionsGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<Simulation<GNode, GLink> | null>(null);

  const [dims, setDims] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [, setTick] = useState(0);
  const nodesRef = useRef<GNode[]>([]);
  const linksRef = useRef<GLink[]>([]);

  const draggingRef = useRef<{ nodeId: string; offX: number; offY: number } | null>(null);
  const panDragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build/refresh simulation when connections change
  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return;

    const cx = dims.w / 2;
    const cy = dims.h / 2;

    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));

    const allNodes: GNode[] = [];
    const allLinks: GLink[] = [];

    const centerNode: GNode = {
      id: CENTER_ID,
      kind: "center",
      label: "Tu cuenta",
      type: "user",
      tone: "indigo",
      status: "connected",
      Icon: Server,
      radius: 32,
      x: prev.get(CENTER_ID)?.x ?? cx,
      y: prev.get(CENTER_ID)?.y ?? cy,
      fx: cx,
      fy: cy,
    };
    allNodes.push(centerNode);

    const platformNodesMap = new Map<string, GNode>();
    const deploymentNodesMap = new Map<string, GNode>();
    const serviceNodesMap = new Map<string, GNode>();

    // Pass 1: Build regular services & platforms
    connections.forEach((c) => {
      const old = prev.get(c.id);
      if (c.service_type === "vercel_deployment") {
        const meta = (c.connection_config?.meta as any) || {};
        const platName = meta.platform || "vercel";
        const platId = `platform-${platName}`;
        
        let platNode = platformNodesMap.get(platId);
        if (!platNode) {
          const oldPlat = prev.get(platId);
          platNode = {
            id: platId,
            kind: "platform",
            label: platName.charAt(0).toUpperCase() + platName.slice(1),
            type: "platform",
            tone: "indigo",
            status: "connected",
            Icon: serviceIcons[platName] || Cloud,
            radius: 28,
            alertCount: 0,
            x: oldPlat?.x ?? cx + Math.cos(Math.random() * Math.PI * 2) * 200,
            y: oldPlat?.y ?? cy + Math.sin(Math.random() * Math.PI * 2) * 200,
            vx: oldPlat?.vx ?? 0,
            vy: oldPlat?.vy ?? 0,
          };
          platformNodesMap.set(platId, platNode);
          allNodes.push(platNode);
          allLinks.push({ source: CENTER_ID, target: platId, distance: 200, strength: 0.6 });
        }

        const depNode: GNode = {
          id: c.id,
          kind: "deployment",
          label: c.service_name || meta.site_name || "Deployment",
          type: "deployment",
          tone: "muted",
          status: c.status,
          Icon: Globe,
          radius: 20,
          alertCount: 0,
          url: meta.url,
          parentId: platId,
          x: old?.x ?? (platNode.x ?? cx) + 20,
          y: old?.y ?? (platNode.y ?? cy) + 20,
          vx: old?.vx ?? 0,
          vy: old?.vy ?? 0,
        };
        deploymentNodesMap.set(c.id, depNode);
        allNodes.push(depNode);
        allLinks.push({ source: platId, target: c.id, distance: 150, strength: 0.7 });
      } else {
        const svcNode: GNode = {
          id: c.id,
          kind: "service",
          label: c.service_name || c.service_type,
          type: c.service_type,
          tone: serviceTone[c.service_type] || "muted",
          status: c.status,
          Icon: serviceIcons[c.service_type] || Server,
          radius: 22,
          alertCount: 0,
          x: old?.x ?? cx + Math.cos(Math.random() * Math.PI * 2) * 160,
          y: old?.y ?? cy + Math.sin(Math.random() * Math.PI * 2) * 160,
          vx: old?.vx ?? 0,
          vy: old?.vy ?? 0,
        };
        serviceNodesMap.set(c.id, svcNode);
        allNodes.push(svcNode);
        allLinks.push({ source: CENTER_ID, target: c.id, distance: 160, strength: 0.6 });
      }
    });

    // Pass 2: Connect deployments to services
    connections.forEach((c) => {
      if (c.service_type === "vercel_deployment") {
        const meta = (c.connection_config?.meta as any) || {};
        const connectedServices: string[] = meta.connected_services || [];
        connectedServices.forEach(svcId => {
          if (serviceNodesMap.has(svcId)) {
            allLinks.push({ source: c.id, target: svcId, distance: 120, strength: 0.3 });
          }
        });
      }
    });

    // Pass 3: Attach alerts
    alerts.forEach(alert => {
      if (alert.connection_id && alert.status !== "resolved" && alert.status !== "dismissed") {
        const parentId = alert.connection_id;
        const parentNode = deploymentNodesMap.get(parentId) || serviceNodesMap.get(parentId);
        if (parentNode) {
          parentNode.alertCount = (parentNode.alertCount || 0) + 1;
          
          const alertNodeId = `alert-${alert.id}`;
          const oldAlert = prev.get(alertNodeId);
          const alertNode: GNode = {
            id: alertNodeId,
            kind: "alert",
            label: alert.title,
            type: "alert",
            tone: alert.severity === "critical" ? "red" : alert.severity === "high" ? "amber" : "muted",
            status: "open",
            Icon: AlertTriangle,
            radius: 10,
            parentId: parentId,
            x: oldAlert?.x ?? (parentNode.x ?? cx) + 10,
            y: oldAlert?.y ?? (parentNode.y ?? cy) + 10,
            vx: oldAlert?.vx ?? 0,
            vy: oldAlert?.vx ?? 0,
          };
          allNodes.push(alertNode);
          allLinks.push({ source: parentId, target: alertNodeId, distance: 60, strength: 1.0 });
        }
      }
    });

    nodesRef.current = allNodes;
    linksRef.current = allLinks;

    simulationRef.current?.stop();

    const sim = forceSimulation<GNode, GLink>(allNodes)
      .force(
        "link",
        forceLink<GNode, GLink>(allLinks)
          .id((d) => d.id)
          .distance((d) => d.distance || 150)
          .strength((d) => d.strength || 0.6)
      )
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(cx, cy).strength(0.04))
      .force("collide", forceCollide<GNode>().radius((d) => d.radius + 14))
      .alphaDecay(0.04)
      .velocityDecay(0.45)
      .on("tick", () => setTick((t) => t + 1));

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [connections, alerts, dims.w, dims.h]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const cx = dims.w / 2;
      const cy = dims.h / 2;
      const x = (localX - cx - pan.x) / zoom + cx;
      const y = (localY - cy - pan.y) / zoom + cy;
      return { x, y };
    },
    [dims, pan, zoom]
  );

  const onNodeMouseDown = (e: React.MouseEvent, node: GNode) => {
    if (node.kind === "center") return;
    e.stopPropagation();
    const sim = simulationRef.current;
    if (!sim) return;
    const world = clientToWorld(e.clientX, e.clientY);
    draggingRef.current = {
      nodeId: node.id,
      offX: (node.x ?? 0) - world.x,
      offY: (node.y ?? 0) - world.y,
    };
    node.fx = node.x;
    node.fy = node.y;
    sim.alphaTarget(0.3).restart();
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    panDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = draggingRef.current;
      if (drag) {
        const node = nodesRef.current.find((n) => n.id === drag.nodeId);
        if (node) {
          const world = clientToWorld(e.clientX, e.clientY);
          node.fx = world.x + drag.offX;
          node.fy = world.y + drag.offY;
        }
        return;
      }
      const p = panDragRef.current;
      if (p) {
        setPan({
          x: p.panX + (e.clientX - p.x),
          y: p.panY + (e.clientY - p.y),
        });
      }
    };
    const onMouseUp = () => {
      const drag = draggingRef.current;
      if (drag) {
        const node = nodesRef.current.find((n) => n.id === drag.nodeId);
        if (node) {
          node.fx = null;
          node.fy = null;
        }
        simulationRef.current?.alphaTarget(0);
      }
      draggingRef.current = null;
      panDragRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [clientToWorld]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedId(null);
    simulationRef.current?.alpha(0.5).restart();
  };

  const nodes = nodesRef.current;
  const renderableNodes = nodes.filter((n) => n.kind !== "center");
  const centerNode = nodes.find((n) => n.kind === "center");
  const selectedNode = selectedId
    ? renderableNodes.find((n) => n.id === selectedId)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 px-5 border-b border-border bg-card/95 backdrop-blur-md flex-shrink-0 z-20">
        <div>
          <h2 className="text-[13.5px] font-semibold tracking-tight leading-none">
            Mapa de conexiones
          </h2>
          <p className="text-[10.5px] text-muted-foreground mt-1">
            {connections.length}{" "}
            {connections.length === 1
              ? "servicio conectado"
              : "servicios conectados"}
          </p>
        </div>
        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}
            className="size-[28px] rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            title="Acercar"
          >
            <ZoomIn className="size-[13px]" strokeWidth={1.7} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z / 1.2, 0.4))}
            className="size-[28px] rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            title="Alejar"
          >
            <ZoomOut className="size-[13px]" strokeWidth={1.7} />
          </button>
          <button
            onClick={resetView}
            className="size-[28px] rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            title="Centrar vista"
          >
            <Maximize2 className="size-[13px]" strokeWidth={1.7} />
          </button>
        </div>

        {onAddConnection && (
          <button
            onClick={onAddConnection}
            className="flex items-center gap-1.5 h-[28px] px-3 rounded-md bg-primary text-white text-[12px] font-semibold hover:opacity-90 transition-opacity shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            <Plus className="size-[13px]" strokeWidth={2.2} />
            Agregar
          </button>
        )}
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-background select-none z-0"
        onMouseDown={onCanvasMouseDown}
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border) / 0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          cursor: panDragRef.current ? "grabbing" : "grab",
        }}
      >
        {renderableNodes.length === 0 && !centerNode ? null : connections.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="size-14 rounded-xl border border-dashed border-border flex items-center justify-center">
              <Server className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold">Sin conexiones todavía</h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                Conectá un servicio para empezar a verlo aquí.
              </p>
            </div>
            {onAddConnection && (
              <button
                onClick={onAddConnection}
                className="mt-2 flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="size-[13px]" strokeWidth={2.2} />
                Conectar servicio
              </button>
            )}
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={dims.w}
            height={dims.h}
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center",
            }}
          >
            <defs>
              <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </radialGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Center glow */}
            {centerNode && (
              <circle
                cx={centerNode.x}
                cy={centerNode.y}
                r={120}
                fill="url(#centerGrad)"
              />
            )}

            {/* Edges */}
            {linksRef.current.map((link, idx) => {
              const s = typeof link.source === 'string' ? nodes.find(n => n.id === link.source) : link.source;
              const t = typeof link.target === 'string' ? nodes.find(n => n.id === link.target) : link.target;
              if (!s || !t) return null;
              
              const isActive = hoverId === s.id || hoverId === t.id || selectedId === s.id || selectedId === t.id;
              
              let stroke = "hsl(var(--border))";
              let strokeWidth = 1;
              let strokeOpacity = 0.5;
              let strokeDasharray = undefined;

              if (t.kind === "alert") {
                stroke = t.tone === "red" ? toneVar.red : t.tone === "amber" ? toneVar.amber : stroke;
                strokeWidth = 1.5;
                strokeOpacity = 0.7;
                strokeDasharray = "4 2";
              } else if (isActive) {
                stroke = toneVar[t.tone] || toneVar.indigo;
                strokeWidth = 1.5;
                strokeOpacity = 0.9;
              }

              return (
                <line
                  key={`edge-${s.id}-${t.id}-${idx}`}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeDasharray={strokeDasharray}
                />
              );
            })}

            {/* Center node */}
            {centerNode && (
              <g style={{ pointerEvents: "none" }}>
                <circle
                  cx={centerNode.x}
                  cy={centerNode.y}
                  r={32}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                />
                <circle
                  cx={centerNode.x}
                  cy={centerNode.y}
                  r={28}
                  fill="hsl(var(--primary) / 0.15)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  strokeOpacity={0.6}
                />
                <text
                  x={centerNode.x}
                  y={(centerNode.y ?? 0) + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="hsl(var(--primary))"
                >
                  {userInitials}
                </text>
                <text
                  x={centerNode.x}
                  y={(centerNode.y ?? 0) + 52}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="hsl(var(--muted-foreground))"
                  style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
                >
                  Tu cuenta
                </text>
              </g>
            )}

            {/* Service & Platform nodes */}
            {renderableNodes.map((n) => {
              const isHover = hoverId === n.id;
              const isSelected = selectedId === n.id;
              const isActive = isHover || isSelected;
              const ok = statusOk(n.status);
              const warn = statusWarn(n.status) || (n.alertCount ? n.alertCount > 0 : false);
              const nodeColor = toneVar[n.tone] || toneVar.muted;
              const x = n.x ?? 0;
              const y = n.y ?? 0;
              const r = n.radius;
              const isAlert = n.kind === "alert";

              if (isAlert) {
                const isRed = n.tone === "red";
                return (
                  <g
                    key={n.id}
                    data-node
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(isSelected ? null : n.id);
                    }}
                    className={isRed ? "animate-pulse" : ""}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill="hsl(var(--card))"
                      stroke={nodeColor}
                      strokeWidth={1.5}
                      filter={isRed ? "url(#glow)" : undefined}
                    />
                    <circle cx={x} cy={y} r={r-2} fill={nodeColor} fillOpacity={0.2} />
                    <foreignObject x={x - r/2} y={y - r/2} width={r} height={r} style={{ pointerEvents: "none" }}>
                      <div className="flex items-center justify-center w-full h-full" style={{ color: nodeColor }}>
                        <n.Icon className="size-[10px]" strokeWidth={2} />
                      </div>
                    </foreignObject>
                  </g>
                );
              }

              return (
                <g
                  key={n.id}
                  data-node
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHoverId(n.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onMouseDown={(e) => onNodeMouseDown(e, n)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(isSelected ? null : n.id);
                  }}
                >
                  {/* outer halo for selected/hover */}
                  {isActive && (
                    <circle
                      cx={x}
                      cy={y}
                      r={r + 6}
                      fill="none"
                      stroke={nodeColor}
                      strokeWidth={1}
                      strokeOpacity={0.3}
                    />
                  )}

                  {/* main circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill="hsl(var(--card))"
                    stroke={nodeColor}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeOpacity={isActive ? 1 : 0.75}
                    filter={isActive ? "url(#glow)" : undefined}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={r - 2}
                    fill={nodeColor}
                    fillOpacity={isActive ? 0.2 : 0.1}
                  />

                  {/* status dot (for services/deployments) */}
                  {n.kind !== "platform" && (
                    <circle
                      cx={x + r * 0.7}
                      cy={y - r * 0.7}
                      r={n.kind === "deployment" ? 3 : 4}
                      fill={
                        ok && !warn
                          ? "hsl(var(--risk-low))"
                          : warn
                            ? "hsl(var(--risk-high))"
                            : "hsl(var(--muted-foreground))"
                      }
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                    />
                  )}

                  {/* alert count badge */}
                  {n.alertCount && n.alertCount > 0 && (
                    <g transform={`translate(${x + r - 4}, ${y - r - 4})`}>
                      <circle cx={0} cy={0} r={6} fill="hsl(var(--risk-high))" />
                      <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight="bold" fill="white">
                        {n.alertCount}
                      </text>
                    </g>
                  )}

                  {/* label */}
                  <text
                    x={x}
                    y={y + r + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={
                      isActive
                        ? "hsl(var(--foreground))"
                        : "hsl(var(--muted-foreground))"
                    }
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
                  </text>
                  <text
                    x={x}
                    y={y + r + 28}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fill="hsl(var(--muted-foreground) / 0.7)"
                    style={{ pointerEvents: "none" }}
                  >
                    {n.type}
                  </text>

                  {/* Icon via foreignObject */}
                  <foreignObject
                    x={x - r/2}
                    y={y - r/2}
                    width={r}
                    height={r}
                    style={{ pointerEvents: "none" }}
                  >
                    <div
                      className="flex items-center justify-center w-full h-full"
                      style={{ color: nodeColor }}
                    >
                      <n.Icon className={n.kind === "deployment" ? "size-[12px]" : "size-[14px]"} strokeWidth={1.8} />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-[280px] rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl p-3.5 z-10 animate-slide-in-up">
            <div className="flex items-start gap-3 mb-3">
              <div
                className={cn(
                  "size-9 rounded-md flex items-center justify-center flex-shrink-0 border"
                )}
                style={{
                  backgroundColor: (toneVar[selectedNode.tone] || toneVar.muted) + "1A",
                  borderColor: (toneVar[selectedNode.tone] || toneVar.muted) + "40",
                  color: toneVar[selectedNode.tone] || toneVar.muted,
                }}
              >
                <selectedNode.Icon className="size-4" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-semibold leading-tight truncate">
                  {selectedNode.label}
                </h4>
                <p className="text-[10.5px] text-muted-foreground mt-1 capitalize">
                  {selectedNode.kind}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-muted-foreground/60 hover:text-foreground text-[16px] leading-none"
                title="Cerrar"
              >
                ×
              </button>
            </div>

            {selectedNode.kind === "alert" ? (
              <div className="space-y-3">
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Severidad:</span> {selectedNode.tone === "red" ? "Crítica" : selectedNode.tone === "amber" ? "Alta" : "Media"}
                </div>
                <button className="w-full text-xs bg-primary text-primary-foreground py-1.5 rounded flex items-center justify-center gap-1 hover:opacity-90">
                  <CheckCircle className="size-3" /> Resolver
                </button>
              </div>
            ) : selectedNode.kind === "deployment" ? (
              <div className="space-y-2">
                {selectedNode.url && (
                  <div className="text-[11px] truncate">
                    <span className="text-muted-foreground">URL: </span>
                    <a href={selectedNode.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {selectedNode.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <div className="text-[11px]">
                  <span className="text-muted-foreground">Plataforma: </span>
                  {selectedNode.parentId?.replace('platform-', '')}
                </div>
              </div>
            ) : selectedNode.kind === "platform" ? (
              <div className="text-[11px]">
                <span className="text-muted-foreground">Deployments activos: </span>
                {nodes.filter(n => n.parentId === selectedNode.id).length}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span
                  className={cn(
                    "size-[5px] rounded-full",
                    statusOk(selectedNode.status) && "bg-risk-low",
                    statusWarn(selectedNode.status) && "bg-risk-high",
                    !statusOk(selectedNode.status) &&
                      !statusWarn(selectedNode.status) &&
                      "bg-muted-foreground/40"
                  )}
                />
                <span
                  className={cn(
                    "font-medium",
                    statusOk(selectedNode.status) && "text-risk-low",
                    statusWarn(selectedNode.status) && "text-risk-high",
                    !statusOk(selectedNode.status) &&
                      !statusWarn(selectedNode.status) &&
                      "text-muted-foreground"
                  )}
                >
                  {statusOk(selectedNode.status)
                    ? "Conectado"
                    : statusWarn(selectedNode.status)
                      ? "Requiere atención"
                      : "Desconectado"}
                </span>
              </div>
            )}
            
            {/* Alertas vinculadas para services y deployments */}
            {(selectedNode.kind === "service" || selectedNode.kind === "deployment") && selectedNode.alertCount && selectedNode.alertCount > 0 ? (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-[11px] font-semibold text-risk-high flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {selectedNode.alertCount} alerta(s) activa(s)
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* AI Action Banner */}
        {pendingGraphAction && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-xl p-4 flex flex-col gap-3 z-30 min-w-[320px] max-w-[400px] animate-slide-in-up">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
                {pendingGraphAction.action === "delete_connection" ? <Trash2 className="size-4" /> : <AlertTriangle className="size-4" />}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className="text-sm font-semibold leading-tight mb-1">Acción propuesta por IA</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{pendingGraphAction.message}</p>
                <div className="mt-2 bg-muted/50 rounded-md p-2 text-xs border border-border/50">
                  <span className="font-medium text-foreground">{pendingGraphAction.label}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full mt-1">
              <button
                onClick={onCancelGraphAction}
                className="flex-1 h-8 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="size-3.5" />
                Cancelar
              </button>
              <button
                onClick={onConfirmGraphAction}
                className="flex-1 h-8 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="size-3.5" />
                Confirmar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none z-10">
          {Math.round(zoom * 100)}%
        </div>
        <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/60 select-none pointer-events-none z-10">
          Arrastrá los nodos · scroll para zoom
        </div>
      </div>
    </div>
  );
}
