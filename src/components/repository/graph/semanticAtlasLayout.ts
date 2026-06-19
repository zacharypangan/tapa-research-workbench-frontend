import { groupAtlasDocuments } from './atlasLayout';
import type { InteractiveGraphNode, SemanticEvidenceItem } from './graphTypes';

export interface AtlasNodePosition {
  id: string;
  node: InteractiveGraphNode;
  laneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasLaneLayout {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';
}

export interface AtlasDocumentGroupLayout {
  id: string;
  label: string;
  basis: 'collection' | 'source_type' | 'repository';
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SemanticAtlasLayout {
  width: number;
  height: number;
  lanes: AtlasLaneLayout[];
  documentGroups: AtlasDocumentGroupLayout[];
  nodePositions: AtlasNodePosition[];
}

export const DOCUMENT_NODE_WIDTH = 220;
export const DOCUMENT_NODE_HEIGHT = 76;
export const EXPANDED_DOCUMENT_WIDTH = 684;
export const EXPANDED_DOCUMENT_HEIGHT = 224;
export const EVIDENCE_ITEM_LEFT = 16;
export const EVIDENCE_ITEM_TOP = 140;
export const EVIDENCE_ITEM_WIDTH = 126;
export const EVIDENCE_ITEM_HEIGHT = 48;
export const EVIDENCE_ITEM_GAP = 8;

const CANVAS_WIDTH = 1120;
const DOCUMENT_LANE_X = 18;
const DOCUMENT_LANE_Y = 58;
const DOCUMENT_LANE_WIDTH = 720;
const DOCUMENT_GROUP_GAP = 10;
const DOCUMENT_CARD_GAP = 8;
const DOCUMENT_GROUP_INSET = 12;
const DOCUMENT_GROUP_HEADER = 30;
const RIGHT_LANE_X = 752;
const RIGHT_LANE_WIDTH = 350;
const RIGHT_LANE_GAP = 10;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const entityNodeWidth = (node: InteractiveGraphNode, maxWidth: number) =>
  clamp(62 + node.label.length * 5, 94, Math.min(170, maxWidth));

const layoutEntityLane = (
  id: string,
  label: string,
  description: string,
  nodes: InteractiveGraphNode[],
  x: number,
  y: number,
  width: number,
  accent: AtlasLaneLayout['accent'],
) => {
  const innerX = x + 10;
  const innerWidth = width - 20;
  const startY = y + 42;
  const nodeHeight = 34;
  const gap = 6;
  let cursorX = innerX;
  let cursorY = startY;
  const positions: AtlasNodePosition[] = [];

  nodes.forEach((node) => {
    const widthForNode = entityNodeWidth(node, innerWidth);
    if (cursorX > innerX && cursorX + widthForNode > innerX + innerWidth) {
      cursorX = innerX;
      cursorY += nodeHeight + gap;
    }
    positions.push({
      id: node.id,
      node,
      laneId: id,
      x: cursorX,
      y: cursorY,
      width: widthForNode,
      height: nodeHeight,
    });
    cursorX += widthForNode + gap;
  });

  const contentBottom = positions.length > 0 ? cursorY + nodeHeight + 10 : startY + 28;
  const height = Math.max(92, contentBottom - y);
  return {
    lane: { id, label, description, x, y, width, height, accent } satisfies AtlasLaneLayout,
    positions,
  };
};

export const buildSemanticAtlasLayout = (
  nodes: InteractiveGraphNode[],
  expandedDocumentId: string | null,
): SemanticAtlasLayout => {
  const documents = nodes.filter((node) => node.node_type === 'material');
  const documentGroups = groupAtlasDocuments(documents);
  const nodePositions: AtlasNodePosition[] = [];
  const documentGroupLayouts: AtlasDocumentGroupLayout[] = [];
  let documentCursorY = DOCUMENT_LANE_Y + 58;

  documentGroups.forEach((group) => {
    const groupY = documentCursorY;
    let cardY = groupY + DOCUMENT_GROUP_HEADER;
    let column = 0;

    group.documents.forEach((document) => {
      const isExpanded = document.id === expandedDocumentId;
      if (isExpanded && column > 0) {
        cardY += DOCUMENT_NODE_HEIGHT + DOCUMENT_CARD_GAP;
        column = 0;
      }

      const width = isExpanded ? EXPANDED_DOCUMENT_WIDTH : DOCUMENT_NODE_WIDTH;
      const height = isExpanded ? EXPANDED_DOCUMENT_HEIGHT : DOCUMENT_NODE_HEIGHT;
      const x = DOCUMENT_LANE_X
        + DOCUMENT_GROUP_INSET
        + (isExpanded ? 0 : column * (DOCUMENT_NODE_WIDTH + DOCUMENT_CARD_GAP));

      nodePositions.push({
        id: document.id,
        node: document,
        laneId: 'documents',
        x,
        y: cardY,
        width,
        height,
      });

      if (isExpanded) {
        cardY += EXPANDED_DOCUMENT_HEIGHT + DOCUMENT_CARD_GAP;
        column = 0;
      } else {
        column += 1;
        if (column === 3) {
          cardY += DOCUMENT_NODE_HEIGHT + DOCUMENT_CARD_GAP;
          column = 0;
        }
      }
    });

    if (column > 0) cardY += DOCUMENT_NODE_HEIGHT + DOCUMENT_CARD_GAP;
    const groupHeight = Math.max(116, cardY - groupY + 2);
    documentGroupLayouts.push({
      id: group.id,
      label: group.label,
      basis: group.basis,
      count: group.documents.length,
      x: DOCUMENT_LANE_X + 6,
      y: groupY,
      width: DOCUMENT_LANE_WIDTH - 12,
      height: groupHeight,
    });
    documentCursorY += groupHeight + DOCUMENT_GROUP_GAP;
  });

  const documentLaneHeight = Math.max(220, documentCursorY - DOCUMENT_LANE_Y + 2);
  const lanes: AtlasLaneLayout[] = [
    {
      id: 'documents',
      label: 'Documents',
      description: 'Grouped by collection, then source type',
      x: DOCUMENT_LANE_X,
      y: DOCUMENT_LANE_Y,
      width: DOCUMENT_LANE_WIDTH,
      height: documentLaneHeight,
      accent: 'blue',
    },
  ];

  const concepts = nodes.filter((node) => node.node_type === 'concept');
  const places = nodes.filter((node) => node.node_type === 'place');
  const times = nodes.filter((node) => node.node_type === 'time_period');
  const agents = nodes.filter((node) => node.node_type === 'agent');

  const conceptLayout = layoutEntityLane(
    'concepts',
    'Concepts',
    'Top bridge concepts only',
    concepts,
    RIGHT_LANE_X,
    DOCUMENT_LANE_Y,
    RIGHT_LANE_WIDTH,
    'emerald',
  );
  lanes.push(conceptLayout.lane);
  nodePositions.push(...conceptLayout.positions);

  const splitWidth = (RIGHT_LANE_WIDTH - RIGHT_LANE_GAP) / 2;
  const lowerY = conceptLayout.lane.y + conceptLayout.lane.height + RIGHT_LANE_GAP;
  const placeLayout = layoutEntityLane(
    'places',
    'Places',
    'Resolved places',
    places,
    RIGHT_LANE_X,
    lowerY,
    splitWidth,
    'amber',
  );
  const timeLayout = layoutEntityLane(
    'time',
    'Time',
    'Validated periods',
    times,
    RIGHT_LANE_X + splitWidth + RIGHT_LANE_GAP,
    lowerY,
    splitWidth,
    'violet',
  );
  lanes.push(placeLayout.lane, timeLayout.lane);
  nodePositions.push(...placeLayout.positions, ...timeLayout.positions);

  let rightCursorY = Math.max(
    placeLayout.lane.y + placeLayout.lane.height,
    timeLayout.lane.y + timeLayout.lane.height,
  ) + RIGHT_LANE_GAP;

  if (agents.length > 0) {
    const agentLayout = layoutEntityLane(
      'agents',
      'Agents',
      'Authors and named agents',
      agents,
      RIGHT_LANE_X,
      rightCursorY,
      RIGHT_LANE_WIDTH,
      'cyan',
    );
    lanes.push(agentLayout.lane);
    nodePositions.push(...agentLayout.positions);
    rightCursorY += agentLayout.lane.height + RIGHT_LANE_GAP;
  }

  lanes.push({
    id: 'review',
    label: 'Review queues',
    description: 'Candidates remain outside the accepted semantic map',
    x: RIGHT_LANE_X,
    y: rightCursorY,
    width: RIGHT_LANE_WIDTH,
    height: 108,
    accent: 'rose',
  });

  const rightBottom = rightCursorY + 108;
  return {
    width: CANVAS_WIDTH,
    height: Math.max(DOCUMENT_LANE_Y + documentLaneHeight, rightBottom) + 18,
    lanes,
    documentGroups: documentGroupLayouts,
    nodePositions,
  };
};

export const evidenceItemAnchor = (
  documentPosition: AtlasNodePosition,
  itemIndex: number,
) => ({
  x:
    documentPosition.x
    + EVIDENCE_ITEM_LEFT
    + itemIndex * (EVIDENCE_ITEM_WIDTH + EVIDENCE_ITEM_GAP)
    + EVIDENCE_ITEM_WIDTH / 2,
  y: documentPosition.y + EVIDENCE_ITEM_TOP + EVIDENCE_ITEM_HEIGHT / 2,
});

export const evidenceItemsForType = (
  items: SemanticEvidenceItem[],
  evidenceType: string,
  visibleEntityIds?: Set<string>,
) => {
  const typeItems = items.filter((item) => item.evidence_type === evidenceType);
  const ranked = [...typeItems].sort((left, right) => {
    const leftVisible = left.entity_id && visibleEntityIds?.has(left.entity_id) ? 1 : 0;
    const rightVisible = right.entity_id && visibleEntityIds?.has(right.entity_id) ? 1 : 0;
    if (leftVisible !== rightVisible) return rightVisible - leftVisible;
    const leftMeaningful = (left.surface_text || '').trim().length >= 4 ? 1 : 0;
    const rightMeaningful = (right.surface_text || '').trim().length >= 4 ? 1 : 0;
    if (leftMeaningful !== rightMeaningful) return rightMeaningful - leftMeaningful;
    return (right.confidence || 0) - (left.confidence || 0);
  });
  const seen = new Set<string>();
  return ranked.filter((item) => {
    const key = `${item.entity_id || ''}:${(item.surface_text || item.evidence_ref.snippet || item.id).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
};
