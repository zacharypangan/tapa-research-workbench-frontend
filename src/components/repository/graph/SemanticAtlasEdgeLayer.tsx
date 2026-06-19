import type { InteractiveGraphEdge, InteractiveGraphNode } from './graphTypes';
import type { AtlasNodePosition } from './semanticAtlasLayout';

export interface SemanticAtlasDisplayEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  confidence: number;
  evidenceCount: number;
  status: string;
  kind: 'semantic' | 'related_document';
  edge?: InteractiveGraphEdge;
  relatedDocument?: InteractiveGraphNode;
  showLabel?: boolean;
}

interface EvidenceEdge {
  id: string;
  sourcePoint: { x: number; y: number };
  targetId: string;
  label: string;
}

interface SemanticAtlasEdgeLayerProps {
  width: number;
  height: number;
  positions: Map<string, AtlasNodePosition>;
  edges: SemanticAtlasDisplayEdge[];
  evidenceEdge?: EvidenceEdge | null;
  onEdgeSelect: (edge: InteractiveGraphEdge) => void;
  onRelatedDocumentSelect: (document: InteractiveGraphNode) => void;
}

const endpointPath = (
  source: AtlasNodePosition,
  target: AtlasNodePosition,
) => {
  const sourceCenter = {
    x: source.x + source.width / 2,
    y: source.y + source.height / 2,
  };
  const targetCenter = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;

  if (Math.abs(dx) >= Math.abs(dy) * 0.65) {
    const direction = dx >= 0 ? 1 : -1;
    const start = {
      x: sourceCenter.x + direction * source.width / 2,
      y: sourceCenter.y,
    };
    const end = {
      x: targetCenter.x - direction * target.width / 2,
      y: targetCenter.y,
    };
    const curve = Math.max(46, Math.abs(end.x - start.x) * 0.42);
    return {
      path: `M ${start.x} ${start.y} C ${start.x + direction * curve} ${start.y}, ${end.x - direction * curve} ${end.y}, ${end.x} ${end.y}`,
      midpoint: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2 - Math.min(18, Math.abs(dy) * 0.08),
      },
    };
  }

  const direction = dy >= 0 ? 1 : -1;
  const start = {
    x: sourceCenter.x,
    y: sourceCenter.y + direction * source.height / 2,
  };
  const end = {
    x: targetCenter.x,
    y: targetCenter.y - direction * target.height / 2,
  };
  const curve = Math.max(44, Math.abs(end.y - start.y) * 0.42);
  return {
    path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * curve}, ${end.x} ${end.y - direction * curve}, ${end.x} ${end.y}`,
    midpoint: {
      x: (start.x + end.x) / 2 + 8,
      y: (start.y + end.y) / 2,
    },
  };
};

const pointToPositionPath = (
  source: { x: number; y: number },
  target: AtlasNodePosition,
) => {
  const end = {
    x: target.x + target.width / 2,
    y: target.y + target.height / 2,
  };
  const direction = end.x >= source.x ? 1 : -1;
  const curve = Math.max(56, Math.abs(end.x - source.x) * 0.38);
  return `M ${source.x} ${source.y} C ${source.x + direction * curve} ${source.y}, ${end.x - direction * curve} ${end.y}, ${end.x} ${end.y}`;
};

const edgeColor = (edge: SemanticAtlasDisplayEdge) => {
  if (edge.kind === 'related_document') return '#b45309';
  if (edge.status === 'needs_review' || edge.status === 'unreviewed') return '#d97706';
  if (edge.status === 'rejected') return '#e11d48';
  return '#059669';
};

export function SemanticAtlasEdgeLayer({
  width,
  height,
  positions,
  edges,
  evidenceEdge,
  onEdgeSelect,
  onRelatedDocumentSelect,
}: SemanticAtlasEdgeLayerProps) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
    >
      {edges.map((edge) => {
        const source = positions.get(edge.sourceId);
        const target = positions.get(edge.targetId);
        if (!source || !target) return null;
        const geometry = endpointPath(source, target);
        const color = edgeColor(edge);
        const widthForEdge = Math.max(
          1.25,
          Math.min(4.5, 0.8 + Math.log1p(edge.evidenceCount) + edge.confidence),
        );
        const isDashed = edge.kind === 'related_document'
          || edge.status === 'needs_review'
          || edge.status === 'unreviewed';
        return (
          <g key={edge.id}>
            <title>{edge.label}</title>
            <path
              d={geometry.path}
              fill="none"
              stroke={color}
              strokeWidth={widthForEdge}
              strokeDasharray={isDashed ? '8 6' : undefined}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d={geometry.path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              className="pointer-events-auto cursor-pointer"
              onClick={() => {
                if (edge.edge) onEdgeSelect(edge.edge);
                else if (edge.relatedDocument) onRelatedDocumentSelect(edge.relatedDocument);
              }}
            />
            {edge.showLabel && (
              <g transform={`translate(${geometry.midpoint.x}, ${geometry.midpoint.y})`}>
                <rect
                  x={-Math.min(118, 18 + edge.label.length * 2.9)}
                  y={-10}
                  width={Math.min(236, 36 + edge.label.length * 5.8)}
                  height={20}
                  rx={10}
                  fill="#ffffff"
                  stroke={color}
                  strokeOpacity={0.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#475569"
                  fontSize="9"
                  fontWeight="700"
                >
                  {edge.label.length > 38 ? `${edge.label.slice(0, 35)}…` : edge.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {evidenceEdge && (() => {
        const target = positions.get(evidenceEdge.targetId);
        if (!target) return null;
        const path = pointToPositionPath(evidenceEdge.sourcePoint, target);
        return (
          <g key={evidenceEdge.id}>
            <title>{evidenceEdge.label}</title>
            <path
              d={path}
              fill="none"
              stroke="#ca8a04"
              strokeWidth={3}
              strokeDasharray="5 4"
              strokeLinecap="round"
              opacity={0.88}
            />
          </g>
        );
      })()}
    </svg>
  );
}
