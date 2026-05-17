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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionData } from "@/lib/api";

const serviceIcons: Record<string, LucideIcon> = {
  supabase: Database,
  shopify: ShoppingCart,
  aws: Cloud,
  github: GitBranch,
  postgresql: Database,
  sentry: Bug,
  vercel: Globe,
  generic_mcp: Server,
};

type Tone = "indigo" | "teal" | "green" | "red" | "amber" | "muted";

const serviceTone: Record<string, Tone> = {
  supabase: "green",
  shopify: "teal",
  aws: "amber",
  github: "indigo",
  postgresql: "green",
  sentry: "red",
  vercel: "muted",
  generic_mcp: "muted",
};

const toneVar: Record<Tone, string> = {
  indigo: "hsl(var(--primary))",
  teal:   "hsl(var(--brand-accent))",
  green:  "hsl(var(--risk-low))",
  red:    "hsl(var(--risk-critical))",
  amber:  "hsl(var(--risk-high))",
  muted:  "hsl(var(--muted-foreground))",
};

// ── Node + Link types compatible with d3-force ──
interface GNode extends SimulationNodeDatum {
  id: string;
  kind: "center" | "service";
  label: string;
  type: string;
  tone: Tone;
  status: string;
  Icon: LucideIcon;
  radius: number;
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode;
  target: string | GNode;
}

function statusOk(status: string): boolean {
  return status === "connected";
}
function statusWarn(status: string): boolean {
  return status === "requires_attention" || status === "error";
}

interface ConnectionsGraphProps {
  connections: ConnectionData[];
  onAddConnection?: () => void;
  userInitials?: string;
}

const CENTER_ID = "__center__";

export function ConnectionsGraph({
  connections,
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

  // Live snapshot of node positions for rendering (forces re-render on each tick)
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

    // Build nodes (preserving positions of nodes that already exist)
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));

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
      // pin the center node — it shouldn't move
      fx: cx,
      fy: cy,
    };

    const serviceNodes: GNode[] = connections.map((c, i) => {
      const old = prev.get(c.id);
      const angle = (i / Math.max(connections.length, 1)) * Math.PI * 2;
      const initialRadius = 180;
      return {
        id: c.id,
        kind: "service",
        label: c.service_name || c.service_type,
        type: c.service_type,
        tone: serviceTone[c.service_type] || "muted",
        status: c.status,
        Icon: serviceIcons[c.service_type] || Server,
        radius: 22,
        x: old?.x ?? cx + Math.cos(angle) * initialRadius,
        y: old?.y ?? cy + Math.sin(angle) * initialRadius,
        vx: old?.vx ?? 0,
        vy: old?.vy ?? 0,
      };
    });

    const allNodes = [centerNode, ...serviceNodes];
    const links: GLink[] = serviceNodes.map((n) => ({
      source: CENTER_ID,
      target: n.id,
    }));

    nodesRef.current = allNodes;
    linksRef.current = links;

    // Stop any previous simulation
    simulationRef.current?.stop();

    const sim = forceSimulation<GNode, GLink>(allNodes)
      .force(
        "link",
        forceLink<GNode, GLink>(links)
          .id((d) => d.id)
          .distance(150)
          .strength(0.6)
      )
      .force("charge", forceManyBody().strength(-450))
      .force("center", forceCenter(cx, cy).strength(0.04))
      .force("collide", forceCollide<GNode>().radius((d) => d.radius + 14))
      .alphaDecay(0.04)
      .velocityDecay(0.45)
      .on("tick", () => setTick((t) => t + 1));

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [connections, dims.w, dims.h]);

  // Convert client coords to SVG/world coords (accounting for pan + zoom)
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      // svg viewBox = 0,0,w,h. Transform = translate(pan) scale(zoom) translate(-cx, -cy) etc.
      // We're using CSS transform on the svg — undo it:
      const cx = dims.w / 2;
      const cy = dims.h / 2;
      const x = (localX - cx - pan.x) / zoom + cx;
      const y = (localY - cy - pan.y) / zoom + cy;
      return { x, y };
    },
    [dims, pan, zoom]
  );

  // Node drag handlers
  const onNodeMouseDown = (e: React.MouseEvent, node: GNode) => {
    if (node.kind === "center") return; // center is pinned
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

  // Canvas drag (pan)
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
      // node drag
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
      // canvas pan
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
  const serviceNodes = nodes.filter((n) => n.kind === "service");
  const centerNode = nodes.find((n) => n.kind === "center");
  const selectedNode = selectedId
    ? serviceNodes.find((n) => n.id === selectedId)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 h-12 px-5 border-b border-border bg-card/95 backdrop-blur-md flex-shrink-0">
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
        className="flex-1 relative overflow-hidden bg-background select-none"
        onMouseDown={onCanvasMouseDown}
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border) / 0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          cursor: panDragRef.current ? "grabbing" : "grab",
        }}
      >
        {serviceNodes.length === 0 && !centerNode ? null : connections.length === 0 ? (
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
            {centerNode &&
              serviceNodes.map((n) => {
                const isActive = hoverId === n.id || selectedId === n.id;
                return (
                  <line
                    key={`edge-${n.id}`}
                    x1={centerNode.x}
                    y1={centerNode.y}
                    x2={n.x}
                    y2={n.y}
                    stroke={isActive ? toneVar[n.tone] : "hsl(var(--border))"}
                    strokeWidth={isActive ? 1.5 : 1}
                    strokeOpacity={isActive ? 0.9 : 0.5}
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

            {/* Service nodes */}
            {serviceNodes.map((n) => {
              const isHover = hoverId === n.id;
              const isSelected = selectedId === n.id;
              const isActive = isHover || isSelected;
              const ok = statusOk(n.status);
              const warn = statusWarn(n.status);
              const nodeColor = toneVar[n.tone];
              const x = n.x ?? 0;
              const y = n.y ?? 0;

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
                      r={28}
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
                    r={22}
                    fill="hsl(var(--card))"
                    stroke={nodeColor}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeOpacity={isActive ? 1 : 0.75}
                    filter={isActive ? "url(#glow)" : undefined}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={20}
                    fill={nodeColor}
                    fillOpacity={isActive ? 0.2 : 0.1}
                  />

                  {/* status dot */}
                  <circle
                    cx={x + 16}
                    cy={y - 16}
                    r={4}
                    fill={
                      ok
                        ? "hsl(var(--risk-low))"
                        : warn
                          ? "hsl(var(--risk-high))"
                          : "hsl(var(--muted-foreground))"
                    }
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  />

                  {/* label */}
                  <text
                    x={x}
                    y={y + 40}
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
                    y={y + 53}
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
                    x={x - 8}
                    y={y - 8}
                    width={16}
                    height={16}
                    style={{ pointerEvents: "none" }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{ color: nodeColor }}
                    >
                      <n.Icon className="size-[14px]" strokeWidth={1.8} />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        )}

        {/* Selected node panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-[240px] rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-xl p-3.5 z-10 animate-slide-in-up">
            <div className="flex items-start gap-3 mb-3">
              <div
                className={cn(
                  "size-9 rounded-md flex items-center justify-center flex-shrink-0 border"
                )}
                style={{
                  backgroundColor: toneVar[selectedNode.tone] + "1A",
                  borderColor: toneVar[selectedNode.tone] + "40",
                  color: toneVar[selectedNode.tone],
                }}
              >
                <selectedNode.Icon className="size-4" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-semibold leading-tight truncate">
                  {selectedNode.label}
                </h4>
                <p className="text-[10.5px] text-muted-foreground mt-1">
                  {selectedNode.type}
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
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/60 font-mono select-none pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>
        <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/60 select-none pointer-events-none">
          Arrastrá los nodos · scroll para zoom
        </div>
      </div>
    </div>
  );
}
