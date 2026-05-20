"use client";

/**
 * React Flow visualization of the LangGraph pipeline.
 *
 * Two modes:
 *  - "demo"  : loops a highlight animation through the happy path.
 *              Used on the landing page.
 *  - "trace" : highlights nodes in `pathTaken` and annotates each node
 *              with metrics drawn from `metrics`. Used on /runs/[id].
 */

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn, formatCost, formatLatency } from "@/lib/utils";
import { NODE_META, type NodeKindMeta, type NodeMetrics } from "@/lib/types";

// ---------------------------------------------------------------------------
// Node + edge data
// ---------------------------------------------------------------------------

type NodeKind = NodeKindMeta["kind"];

interface PipelineNodeData extends Record<string, unknown> {
  meta: NodeKindMeta;
  metric?: NodeMetrics;
  highlighted: boolean;
  inPath: boolean;
}

const META_BY_ID: Record<string, NodeKindMeta> = NODE_META.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<string, NodeKindMeta>
);

// Layout coordinates. Manual placement keeps the diagram stable and obviously
// sized for the landing/viewer card. ~180 wide, ~70 tall per node.
const POSITIONS: Record<string, { x: number; y: number }> = {
  start: { x: 240, y: 0 },
  hard_screen: { x: 240, y: 90 },
  ai_eligibility_and_fit: { x: 240, y: 200 },
  human_in_the_loop: { x: 480, y: 270 },
  select_stories: { x: 240, y: 340 },
  compose_resume_content: { x: 240, y: 440 },
  resume_editor: { x: 240, y: 540 },
  pdf_converter: { x: 240, y: 640 },
  ats_score: { x: 240, y: 740 },
  logger: { x: 240, y: 870 },
  end: { x: 240, y: 970 },
};

const KIND_BY_ID: Record<string, NodeKind> = {
  start: "terminal",
  end: "terminal",
  ...NODE_META.reduce((acc, m) => ({ ...acc, [m.id]: m.kind }), {}),
};

const KIND_COLORS: Record<NodeKind, { bg: string; border: string; text: string }> = {
  ai: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    border: "border-indigo-300 dark:border-indigo-700",
    text: "text-indigo-900 dark:text-indigo-200",
  },
  code: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-900 dark:text-emerald-200",
  },
  hitl: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-900 dark:text-amber-200",
  },
  terminal: {
    bg: "bg-neutral-100 dark:bg-neutral-900",
    border: "border-neutral-300 dark:border-neutral-700",
    text: "text-neutral-700 dark:text-neutral-300",
  },
};

// Happy-path order used by the "demo" animation.
const HAPPY_PATH = [
  "start",
  "hard_screen",
  "ai_eligibility_and_fit",
  "select_stories",
  "compose_resume_content",
  "resume_editor",
  "pdf_converter",
  "ats_score",
  "logger",
  "end",
];

// ---------------------------------------------------------------------------
// Custom node renderer
// ---------------------------------------------------------------------------

function PipelineNode({ data }: NodeProps<Node<PipelineNodeData>>) {
  const { meta, metric, highlighted, inPath } = data;
  const colors = KIND_COLORS[meta.kind];

  const isTerminalDot = meta.id === "start" || meta.id === "end";

  return (
    <div
      className={cn(
        "rounded-md border-[1.5px] px-3 py-2 text-[11px] shadow-sm transition-all",
        colors.bg,
        colors.border,
        colors.text,
        highlighted && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        !inPath && "opacity-50",
        isTerminalDot && "w-20 text-center font-semibold uppercase tracking-widest"
      )}
      style={{ width: isTerminalDot ? 80 : 180 }}
    >
      {meta.id !== "start" && (
        <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5" />
      )}
      {meta.id !== "end" && (
        <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5" />
      )}
      {meta.id === "human_in_the_loop" && (
        <>
          <Handle type="target" id="from-eligibility" position={Position.Left} className="!h-1.5 !w-1.5" />
          <Handle type="source" id="to-select" position={Position.Bottom} className="!h-1.5 !w-1.5" />
          <Handle type="source" id="to-logger" position={Position.Right} className="!h-1.5 !w-1.5" />
        </>
      )}
      {!isTerminalDot && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-medium">{meta.label}</span>
            <KindPill kind={meta.kind} />
          </div>
          {metric ? (
            <div className="mt-1 flex items-center gap-2 text-[10px] opacity-80">
              <span>{formatLatency(metric.latency_ms)}</span>
              {metric.tokens_in > 0 || metric.tokens_out > 0 ? (
                <span>
                  {metric.tokens_in}/{metric.tokens_out} tok
                </span>
              ) : null}
              {metric.cost_usd > 0 ? <span>{formatCost(metric.cost_usd)}</span> : null}
            </div>
          ) : null}
        </>
      )}
      {isTerminalDot && meta.id.toUpperCase()}
    </div>
  );
}

function KindPill({ kind }: { kind: NodeKind }) {
  const labels: Record<NodeKind, string> = {
    ai: "AI",
    code: "code",
    hitl: "HITL",
    terminal: "term",
  };
  return (
    <span
      className={cn(
        "rounded px-1 py-px text-[9px] font-mono uppercase tracking-wide",
        kind === "ai" && "bg-indigo-200/70 text-indigo-900",
        kind === "code" && "bg-emerald-200/70 text-emerald-900",
        kind === "hitl" && "bg-amber-200/70 text-amber-900",
        kind === "terminal" && "bg-neutral-200/70 text-neutral-700"
      )}
    >
      {labels[kind]}
    </span>
  );
}

const nodeTypes = { pipeline: PipelineNode };

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

const STATIC_EDGES: Edge[] = [
  edge("e_start", "start", "hard_screen"),
  edge("e_hs_eli", "hard_screen", "ai_eligibility_and_fit", { label: "pass" }),
  edge("e_hs_log", "hard_screen", "logger", { label: "blocked", curved: true }),
  edge("e_eli_sel", "ai_eligibility_and_fit", "select_stories", { label: "ok" }),
  edge("e_eli_hitl", "ai_eligibility_and_fit", "human_in_the_loop", {
    label: "soft / fit?",
    curved: true,
  }),
  edge("e_eli_log", "ai_eligibility_and_fit", "logger", {
    label: "hard_block",
    curved: true,
  }),
  edge("e_hitl_sel", "human_in_the_loop", "select_stories", {
    label: "proceed",
    curved: true,
    sourceHandle: "to-select",
  }),
  edge("e_hitl_log", "human_in_the_loop", "logger", {
    label: "skip",
    curved: true,
    sourceHandle: "to-logger",
  }),
  edge("e_sel_comp", "select_stories", "compose_resume_content"),
  edge("e_comp_edit", "compose_resume_content", "resume_editor"),
  edge("e_edit_pdf", "resume_editor", "pdf_converter"),
  edge("e_pdf_ats", "pdf_converter", "ats_score"),
  edge("e_ats_log", "ats_score", "logger", { label: "pass" }),
  edge("e_ats_retry", "ats_score", "compose_resume_content", {
    label: "retry",
    curved: true,
    dashed: true,
  }),
  edge("e_log_end", "logger", "end"),
];

interface EdgeOpts {
  label?: string;
  curved?: boolean;
  dashed?: boolean;
  sourceHandle?: string;
}

function edge(id: string, source: string, target: string, opts: EdgeOpts = {}): Edge {
  return {
    id,
    source,
    target,
    type: opts.curved ? "default" : "smoothstep",
    animated: false,
    label: opts.label,
    sourceHandle: opts.sourceHandle,
    labelStyle: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      fill: "hsl(var(--muted-foreground))",
    },
    labelBgStyle: { fill: "hsl(var(--background))" },
    style: {
      stroke: "hsl(var(--border))",
      strokeWidth: 1.25,
      strokeDasharray: opts.dashed ? "4 4" : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface PipelineGraphProps {
  mode: "demo" | "trace";
  /** When `mode === "trace"`, the path the run actually took. */
  pathTaken?: string[];
  /** When `mode === "trace"`, per-node metrics keyed by node_name. */
  metrics?: NodeMetrics[];
  /** Optional explicit height. Defaults to 1080 px. */
  height?: number;
}

export function PipelineGraph({
  mode,
  pathTaken,
  metrics,
  height = 1080,
}: PipelineGraphProps) {
  const [demoIdx, setDemoIdx] = useState(0);

  useEffect(() => {
    if (mode !== "demo") return;
    const interval = setInterval(() => {
      setDemoIdx((i) => (i + 1) % HAPPY_PATH.length);
    }, 700);
    return () => clearInterval(interval);
  }, [mode]);

  const metricByNode = useMemo(() => {
    if (!metrics) return {} as Record<string, NodeMetrics>;
    // If a node ran multiple times (compose_resume_content on retry), surface
    // the LAST execution. That's what the displayed run effectively used.
    const out: Record<string, NodeMetrics> = {};
    for (const m of metrics) out[m.node_name] = m;
    return out;
  }, [metrics]);

  const nodes: Node<PipelineNodeData>[] = useMemo(() => {
    return Object.keys(POSITIONS).map((id) => {
      const meta: NodeKindMeta =
        META_BY_ID[id] ??
        ({ id, label: id, kind: KIND_BY_ID[id] ?? "terminal", description: "", detail: "" } as NodeKindMeta);

      const inPath =
        mode === "demo"
          ? HAPPY_PATH.includes(id)
          : id === "start" ||
            id === "end" ||
            (pathTaken ?? []).includes(id);

      const highlighted =
        mode === "demo"
          ? HAPPY_PATH[demoIdx] === id
          : false;

      return {
        id,
        type: "pipeline",
        position: POSITIONS[id],
        data: { meta, metric: metricByNode[id], highlighted, inPath },
        draggable: false,
        selectable: false,
      };
    });
  }, [mode, demoIdx, pathTaken, metricByNode]);

  return (
    <div className="rounded-lg border bg-card" style={{ height }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={STATIC_EDGES}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
