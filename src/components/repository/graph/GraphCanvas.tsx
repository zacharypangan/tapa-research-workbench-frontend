import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import type { GraphSelection, InteractiveGraphEdge, InteractiveGraphNode } from './graphTypes';
import { edgeSourceId, edgeTargetId, nodeRadius, nodeTypeColor } from './graphTypes';

interface GraphCanvasProps {
  nodes: InteractiveGraphNode[];
  edges: InteractiveGraphEdge[];
  selected: GraphSelection;
  searchTerm: string;
  onNodeSelect: (node: InteractiveGraphNode) => void;
  onEdgeSelect: (edge: InteractiveGraphEdge) => void;
  onClearSelection: () => void;
}

const edgeColor = (edge: InteractiveGraphEdge, isActive: boolean) => {
  if (isActive) return '#2563eb';
  if (edge.review_status === 'rejected') return '#f43f5e';
  if (edge.review_status === 'needs_review' || edge.review_status === 'unreviewed' || edge.edge_type === 'co_occurs_with') return '#f59e0b';
  return '#94a3b8';
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const corner = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + corner, y);
  ctx.lineTo(x + width - corner, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + corner);
  ctx.lineTo(x + width, y + height - corner);
  ctx.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  ctx.lineTo(x + corner, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - corner);
  ctx.lineTo(x, y + corner);
  ctx.quadraticCurveTo(x, y, x + corner, y);
};

export function GraphCanvas({
  nodes,
  edges,
  selected,
  searchTerm,
  onNodeSelect,
  onEdgeSelect,
  onClearSelection,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 760, height: 520 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(360, Math.floor(rect.height)),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (nodes.length === 0) return;
    const timer = window.setTimeout(() => graphRef.current?.zoomToFit(450, 44), 250);
    return () => window.clearTimeout(timer);
  }, [edges.length, nodes.length]);

  const selectedNodeId = selected?.kind === 'node' ? selected.node.id : null;
  const selectedEdgeId = selected?.kind === 'edge' ? selected.edge.id : null;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const activeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    edges.forEach((edge) => {
      if (edge.id === hoveredEdgeId || edge.id === selectedEdgeId) {
        ids.add(edgeSourceId(edge));
        ids.add(edgeTargetId(edge));
      }
      if (hoveredNodeId && (edgeSourceId(edge) === hoveredNodeId || edgeTargetId(edge) === hoveredNodeId)) {
        ids.add(edgeSourceId(edge));
        ids.add(edgeTargetId(edge));
      }
      if (selectedNodeId && (edgeSourceId(edge) === selectedNodeId || edgeTargetId(edge) === selectedNodeId)) {
        ids.add(edgeSourceId(edge));
        ids.add(edgeTargetId(edge));
      }
    });
    if (hoveredNodeId) ids.add(hoveredNodeId);
    if (selectedNodeId) ids.add(selectedNodeId);
    return ids;
  }, [edges, hoveredEdgeId, hoveredNodeId, selectedEdgeId, selectedNodeId]);

  const graphData = useMemo(() => ({ nodes, links: edges }), [edges, nodes]);

  return (
    <div ref={containerRef} className="min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white">
      {nodes.length === 0 ? (
        <div className="flex h-[520px] items-center justify-center p-6 text-center">
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-slate-400">Start Anywhere</div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              Build or load the atlas, then search for a term or choose a tour. Source evidence remains available when you select a node or relationship.
            </p>
          </div>
        </div>
      ) : (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={size.width}
          height={size.height}
          backgroundColor="#ffffff"
          nodeId="id"
          linkSource="source"
          linkTarget="target"
          cooldownTicks={70}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.32}
          minZoom={0.18}
          maxZoom={4}
          nodeRelSize={5}
          nodeVal={(node) => {
            const item = node as InteractiveGraphNode;
            return Math.max(1, Math.min(18, (item.evidence_count || item.document_count || item.node_count || item.degree) + 1));
          }}
          nodeLabel={(node) => {
            const item = node as InteractiveGraphNode;
            return `${item.label} (${item.node_type.replace(/_/g, ' ')})`;
          }}
          linkLabel={(link) => {
            const edge = link as InteractiveGraphEdge;
            return `${edge.edge_type.replace(/_/g, ' ')} · ${(edge.confidence * 100).toFixed(0)}%`;
          }}
          linkColor={(link) => {
            const edge = link as InteractiveGraphEdge;
            return edgeColor(edge, edge.id === selectedEdgeId || edge.id === hoveredEdgeId);
          }}
          linkWidth={(link) => {
            const edge = link as InteractiveGraphEdge;
            const active = edge.id === selectedEdgeId || edge.id === hoveredEdgeId;
            return active ? 3.2 : Math.max(0.7, Math.min(3, edge.weight * (0.9 + edge.confidence)));
          }}
          linkLineDash={(link) => {
            const edge = link as InteractiveGraphEdge;
            return edge.review_status === 'needs_review' || edge.review_status === 'unreviewed' || edge.edge_type === 'co_occurs_with'
              ? [6, 4]
              : null;
          }}
          linkDirectionalParticles={(link) => ((link as InteractiveGraphEdge).id === selectedEdgeId ? 2 : 0)}
          linkDirectionalParticleWidth={2}
          onNodeClick={(node) => onNodeSelect(node as InteractiveGraphNode)}
          onLinkClick={(link) => onEdgeSelect(link as InteractiveGraphEdge)}
          onNodeHover={(node) => setHoveredNodeId(node ? (node as InteractiveGraphNode).id : null)}
          onLinkHover={(link) => setHoveredEdgeId(link ? (link as InteractiveGraphEdge).id : null)}
          onBackgroundClick={onClearSelection}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const item = node as InteractiveGraphNode;
            const radius = nodeRadius(item);
            const isSelected = item.id === selectedNodeId;
            const isActive = activeNodeIds.has(item.id);
            const isSearchMatch = normalizedSearch.length > 0 && item.label.toLowerCase().includes(normalizedSearch);
            ctx.beginPath();
            ctx.arc(item.x || 0, item.y || 0, radius + (isSelected ? 5 : isActive || isSearchMatch ? 3 : 0), 0, 2 * Math.PI, false);
            ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.18)' : isSearchMatch ? 'rgba(250, 204, 21, 0.24)' : 'rgba(148, 163, 184, 0.14)';
            ctx.fill();
            ctx.beginPath();
            if (item.node_type === 'cluster') {
              ctx.rect((item.x || 0) - radius, (item.y || 0) - radius, radius * 2, radius * 2);
            } else if (item.node_type === 'summary_group') {
              roundedRect(ctx, (item.x || 0) - radius * 1.15, (item.y || 0) - radius * 0.8, radius * 2.3, radius * 1.6, 5);
            } else {
              ctx.arc(item.x || 0, item.y || 0, radius, 0, 2 * Math.PI, false);
            }
            ctx.fillStyle = nodeTypeColor(item.node_type);
            ctx.fill();
            ctx.lineWidth = isSelected || isActive ? 2.2 : 1;
            ctx.strokeStyle = isSelected ? '#1d4ed8' : '#ffffff';
            ctx.stroke();

            const shouldLabel =
              isSelected
              || isActive
              || isSearchMatch
              || item.is_synthetic
              || ['material', 'collection', 'source_type'].includes(item.node_type)
              || item.degree >= 8;
            if (!shouldLabel || globalScale < 0.55) return;
            const fontSize = Math.max(7, 11 / globalScale);
            const label = item.label.length > 28 ? `${item.label.slice(0, 25)}...` : item.label;
            ctx.font = `700 ${fontSize}px Inter, ui-sans-serif, system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#334155';
            ctx.fillText(label, item.x || 0, (item.y || 0) + radius + 3);
          }}
        />
      )}
    </div>
  );
}
