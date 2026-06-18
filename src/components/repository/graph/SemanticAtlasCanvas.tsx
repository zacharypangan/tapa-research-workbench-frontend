import { useMemo, useState } from 'react';
import { formatEvidenceLabel } from '../formatters';
import { DocumentEvidenceCluster } from './DocumentEvidenceCluster';
import { EntityLane } from './EntityLane';
import { ReviewQueueChips } from './ReviewQueueChips';
import {
  type SemanticAtlasDisplayEdge,
  SemanticAtlasEdgeLayer,
} from './SemanticAtlasEdgeLayer';
import { SemanticAtlasNode } from './SemanticAtlasNode';
import { SemanticLensPanel } from './SemanticLensPanel';
import { relationshipFocus } from './atlasLayout';
import {
  buildSemanticAtlasLayout,
  evidenceItemAnchor,
  evidenceItemsForType,
} from './semanticAtlasLayout';
import {
  edgeSourceId,
  edgeTargetId,
} from './graphTypes';
import type {
  GraphSelection,
  InteractiveGraphEdge,
  InteractiveGraphNode,
  SemanticAtlasLens,
  SemanticEntityDetail,
  SemanticEntityEvidence,
  SemanticEvidenceFocus,
  SemanticEvidenceItem,
  SemanticGraphPayload,
} from './graphTypes';

interface SemanticAtlasCanvasProps {
  nodes: InteractiveGraphNode[];
  edges: InteractiveGraphEdge[];
  selected: GraphSelection;
  evidenceFocus: SemanticEvidenceFocus | null;
  lens: SemanticAtlasLens;
  searchTerm: string;
  expandedDocumentId: string | null;
  detailsByEntity: Record<string, SemanticEntityDetail | undefined>;
  evidenceByEntity: Record<string, SemanticEntityEvidence | undefined>;
  hiddenSummary?: SemanticGraphPayload['hidden_summary'];
  loadingDetailId: string | null;
  loadingEvidenceId: string | null;
  onLensChange: (lens: SemanticAtlasLens) => void;
  onNodeSelect: (node: InteractiveGraphNode) => void;
  onEdgeSelect: (edge: InteractiveGraphEdge) => void;
  onDocumentToggle: (document: InteractiveGraphNode) => void;
  onEvidenceSelect: (document: InteractiveGraphNode, item: SemanticEvidenceItem) => void;
  onOpenMaterialView: (materialId: string, view: 'segments' | 'images' | 'observations') => void;
}

const evidenceCount = (edge: InteractiveGraphEdge) =>
  edge.semantic_relation?.evidence_count || Math.max(1, Math.round(edge.weight || 1));

const buildRelatedDocumentEdges = (
  selectedDocument: InteractiveGraphNode,
  nodes: InteractiveGraphNode[],
  edges: InteractiveGraphEdge[],
): SemanticAtlasDisplayEdge[] => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const relatedEntityTypes = new Set(['concept', 'place', 'time_period', 'agent']);
  const entityIds = new Set<string>();
  edges.forEach((edge) => {
    const source = edgeSourceId(edge);
    const target = edgeTargetId(edge);
    if (source === selectedDocument.id && relatedEntityTypes.has(nodeMap.get(target)?.node_type || '')) {
      entityIds.add(target);
    }
    if (target === selectedDocument.id && relatedEntityTypes.has(nodeMap.get(source)?.node_type || '')) {
      entityIds.add(source);
    }
  });

  const related = new Map<
    string,
    { document: InteractiveGraphNode; labels: Set<string>; evidence: number; needsReview: boolean }
  >();
  edges.forEach((edge) => {
    const source = edgeSourceId(edge);
    const target = edgeTargetId(edge);
    const entityId = entityIds.has(source) ? source : entityIds.has(target) ? target : null;
    if (!entityId) return;
    const otherId = source === entityId ? target : source;
    const document = nodeMap.get(otherId);
    if (!document || document.node_type !== 'material' || document.id === selectedDocument.id) return;
    const item = related.get(document.id) || {
      document,
      labels: new Set<string>(),
      evidence: 0,
      needsReview: false,
    };
    const entity = nodeMap.get(entityId);
    if (entity) item.labels.add(entity.label);
    item.evidence += evidenceCount(edge);
    item.needsReview ||= edge.review_status === 'needs_review' || edge.review_status === 'unreviewed';
    related.set(document.id, item);
  });

  return Array.from(related.values())
    .sort((left, right) => right.labels.size - left.labels.size || right.evidence - left.evidence)
    .slice(0, 3)
    .map((item) => {
      const labels = Array.from(item.labels);
      return {
        id: `related:${selectedDocument.id}:${item.document.id}`,
        sourceId: selectedDocument.id,
        targetId: item.document.id,
        label: `via ${labels.slice(0, 2).join(' + ')} · ${item.evidence} evidence`,
        confidence: 0.8,
        evidenceCount: item.evidence,
        status: item.needsReview ? 'needs_review' : 'accepted',
        kind: 'related_document' as const,
        relatedDocument: item.document,
        showLabel: false,
      };
    });
};

const laneNodeType: Partial<Record<SemanticAtlasLens, string>> = {
  concepts: 'concept',
  places: 'place',
  time: 'time_period',
};

export function SemanticAtlasCanvas({
  nodes,
  edges,
  selected,
  evidenceFocus,
  lens,
  searchTerm,
  expandedDocumentId,
  detailsByEntity,
  evidenceByEntity,
  hiddenSummary,
  loadingDetailId,
  loadingEvidenceId,
  onLensChange,
  onNodeSelect,
  onEdgeSelect,
  onDocumentToggle,
  onEvidenceSelect,
  onOpenMaterialView,
}: SemanticAtlasCanvasProps) {
  const [evidenceTypeByDocument, setEvidenceTypeByDocument] = useState<Record<string, string>>({});
  const selectedNodeId = selected?.kind === 'node' ? selected.node.id : null;
  const selectedEdge = selected?.kind === 'edge' ? selected.edge : null;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const atlasNodes = useMemo(
    () => nodes.filter((node) => {
      if (node.node_type !== 'concept') return true;
      if (node.semantic_entity?.is_generic) return false;
      return !/[;,:]$/.test(node.label.trim());
    }),
    [nodes],
  );
  const layout = useMemo(
    () => buildSemanticAtlasLayout(atlasNodes, expandedDocumentId),
    [atlasNodes, expandedDocumentId],
  );
  const positions = useMemo(
    () => new Map(layout.nodePositions.map((position) => [position.id, position])),
    [layout.nodePositions],
  );
  const visibleEntityIds = useMemo(
    () => new Set(atlasNodes.filter((node) => node.node_type !== 'material').map((node) => node.id)),
    [atlasNodes],
  );
  const focus = useMemo(
    () => relationshipFocus(atlasNodes, edges, selectedNodeId, lens, searchTerm, false),
    [atlasNodes, edges, lens, searchTerm, selectedNodeId],
  );
  const evidenceMatchingDocumentIds = useMemo(() => {
    const ids = new Set<string>();
    if (!normalizedSearch) return ids;
    Object.entries(evidenceByEntity).forEach(([entityId, payload]) => {
      const matches = payload?.items.some((item) =>
        [
          item.surface_text,
          item.evidence_ref.snippet,
          item.evidence_ref.page_ref,
          item.evidence_ref.source_locator,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch),
      );
      if (matches) ids.add(entityId);
    });
    return ids;
  }, [evidenceByEntity, normalizedSearch]);

  const activeNodeIds = useMemo(() => {
    const ids = new Set(focus.focusedNodeIds);
    focus.matchingIds.forEach((id) => ids.add(id));
    evidenceMatchingDocumentIds.forEach((id) => ids.add(id));
    if (selectedEdge) {
      ids.add(edgeSourceId(selectedEdge));
      ids.add(edgeTargetId(selectedEdge));
    }
    const focusedType = laneNodeType[lens];
    if (focusedType) {
      atlasNodes.filter((node) => node.node_type === focusedType).forEach((node) => ids.add(node.id));
    }
    if (evidenceFocus) {
      ids.add(evidenceFocus.document.id);
      if (evidenceFocus.item.entity_id) ids.add(evidenceFocus.item.entity_id);
    }
    return ids;
  }, [
    evidenceFocus,
    evidenceMatchingDocumentIds,
    focus.focusedNodeIds,
    focus.matchingIds,
    lens,
    atlasNodes,
    selectedEdge,
  ]);

  const displayEdges = useMemo(() => {
    let semanticEdges: InteractiveGraphEdge[] = [];
    if (selectedEdge) {
      semanticEdges = [selectedEdge];
    } else if (selectedNodeId) {
      semanticEdges = edges.filter(
        (edge) => edgeSourceId(edge) === selectedNodeId || edgeTargetId(edge) === selectedNodeId,
      );
    } else if (normalizedSearch) {
      semanticEdges = focus.focusEdges;
    }

    const selectedNode = selected?.kind === 'node' ? selected.node : null;
    const actualLimit = selectedNodeId ? 10 : 24;
    const actual: SemanticAtlasDisplayEdge[] = semanticEdges
      .filter((edge) => positions.has(edgeSourceId(edge)) && positions.has(edgeTargetId(edge)))
      .sort((left, right) => evidenceCount(right) - evidenceCount(left))
      .slice(0, actualLimit)
      .map((edge) => ({
        id: edge.id,
        sourceId: edgeSourceId(edge),
        targetId: edgeTargetId(edge),
        label: `${formatEvidenceLabel(edge.edge_type)} · ${evidenceCount(edge)} evidence`,
        confidence: edge.confidence,
        evidenceCount: evidenceCount(edge),
        status: edge.review_status,
        kind: 'semantic' as const,
        edge,
        showLabel: false,
      }));

    const selectedDocument = selectedNode?.node_type === 'material'
      ? selectedNode
      : null;
    return selectedDocument
      ? [...actual, ...buildRelatedDocumentEdges(selectedDocument, atlasNodes, edges).filter(
          (edge) => positions.has(edge.targetId),
        )]
      : actual;
  }, [atlasNodes, edges, focus.focusEdges, normalizedSearch, positions, selected, selectedEdge, selectedNodeId]);

  const expandedEvidence = expandedDocumentId ? evidenceByEntity[expandedDocumentId] : undefined;
  const availableEvidenceType = ['segment', 'image', 'observation', 'metadata'].find((type) =>
    expandedEvidence?.items.some((item) => item.evidence_type === type),
  ) || 'segment';
  const activeEvidenceType = expandedDocumentId
    ? evidenceTypeByDocument[expandedDocumentId]
      || (
        evidenceFocus?.document.id === expandedDocumentId
          ? evidenceFocus.item.evidence_type
          : availableEvidenceType
      )
    : availableEvidenceType;
  const evidenceEdge = useMemo(() => {
    if (
      !evidenceFocus
      || !expandedDocumentId
      || evidenceFocus.document.id !== expandedDocumentId
      || !evidenceFocus.item.entity_id
    ) {
      return null;
    }
    const documentPosition = positions.get(expandedDocumentId);
    if (!documentPosition) return null;
    const visibleItems = evidenceItemsForType(
      expandedEvidence?.items || [],
      activeEvidenceType,
      visibleEntityIds,
    );
    const index = visibleItems.findIndex((item) => item.id === evidenceFocus.item.id);
    if (index < 0) return null;
    return {
      id: `evidence:${evidenceFocus.item.id}`,
      sourcePoint: evidenceItemAnchor(documentPosition, index),
      targetId: evidenceFocus.item.entity_id,
      label: `${formatEvidenceLabel(evidenceFocus.item.evidence_type)} supports entity`,
    };
  }, [
    activeEvidenceType,
    evidenceFocus,
    expandedDocumentId,
    expandedEvidence?.items,
    positions,
    visibleEntityIds,
  ]);

  const counts = {
    documents: atlasNodes.filter((node) => node.node_type === 'material').length,
    concepts: atlasNodes.filter((node) => node.node_type === 'concept').length,
    places: atlasNodes.filter((node) => node.node_type === 'place').length,
    time: atlasNodes.filter((node) => node.node_type === 'time_period').length,
  };
  const hasFocus = Boolean(
    selectedNodeId
    || selectedEdge
    || evidenceFocus
    || normalizedSearch
    || lens !== 'documents',
  );
  const pathCallouts = [
    ...displayEdges.filter((edge) => edge.kind === 'related_document'),
    ...displayEdges.filter((edge) => edge.kind !== 'related_document'),
  ].slice(0, 3);

  return (
    <section className="min-h-[620px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Semantic map canvas
          </div>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            Fixed positions · persistent labels · relationships revealed on focus
          </p>
        </div>
        <SemanticLensPanel lens={lens} counts={counts} onLensChange={onLensChange} />
        <div className="flex gap-2 text-[9px] font-black uppercase tracking-wider text-slate-500">
          <span className="rounded-full border border-slate-800 px-2 py-1">Solid accepted</span>
          <span className="rounded-full border border-amber-500/30 px-2 py-1 text-amber-300">Dashed review</span>
        </div>
      </div>

      <div className="max-h-[760px] overflow-auto">
        <div
          style={{
            width: layout.width,
            height: layout.height,
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.055) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          className="relative bg-slate-950"
        >
          <SemanticAtlasEdgeLayer
            width={layout.width}
            height={layout.height}
            positions={positions}
            edges={displayEdges}
            evidenceEdge={evidenceEdge}
            onEdgeSelect={onEdgeSelect}
            onRelatedDocumentSelect={onNodeSelect}
          />

          {displayEdges.length > 0 && (
            <div className="absolute left-[360px] top-5 z-40 flex max-w-[760px] flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">
                Visible paths
              </span>
              {pathCallouts.map((edge) => (
                <span
                  key={`path-label:${edge.id}`}
                  className={`rounded-full border bg-slate-950/90 px-2.5 py-1 text-[9px] font-bold ${
                    edge.kind === 'related_document'
                      ? 'border-cyan-400/40 text-cyan-200'
                      : edge.status === 'needs_review' || edge.status === 'unreviewed'
                        ? 'border-amber-400/40 text-amber-200'
                        : 'border-emerald-400/40 text-emerald-200'
                  }`}
                >
                  {edge.label}
                </span>
              ))}
            </div>
          )}

          {layout.lanes.map((lane) => (
            <EntityLane
              key={lane.id}
              lane={lane}
              count={
                lane.id === 'documents'
                  ? counts.documents
                  : lane.id === 'concepts'
                    ? counts.concepts
                    : lane.id === 'places'
                      ? counts.places
                      : lane.id === 'time'
                        ? counts.time
                        : lane.id === 'agents'
                          ? atlasNodes.filter((node) => node.node_type === 'agent').length
                          : (
                            (hiddenSummary?.hidden_candidate_relations || 0)
                            + (hiddenSummary?.unresolved_place_mentions || 0)
                            + (hiddenSummary?.invalid_or_candidate_time_mentions || 0)
                          )
              }
              isActive={
                lens === 'documents'
                  ? lane.id === 'documents'
                  : lane.id === lens
              }
            />
          ))}

          {layout.documentGroups.map((group) => (
            <div
              key={group.id}
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
              className="absolute z-[1] rounded-2xl border border-blue-300/15 bg-blue-950/15"
            >
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200/80">
                  {group.label}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-300/40">
                  {group.count} · {group.basis.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}

          {layout.nodePositions.map((position) => {
            const isExpanded = position.id === expandedDocumentId;
            const isSelected = position.id === selectedNodeId;
            const isSearchMatch = focus.matchingIds.has(position.id)
              || evidenceMatchingDocumentIds.has(position.id);
            const isFocused = activeNodeIds.has(position.id);
            const isDimmed = hasFocus && !isFocused && !isSelected && !isSearchMatch;
            return (
              <SemanticAtlasNode
                key={position.id}
                position={position}
                isSelected={isSelected}
                isFocused={isFocused}
                isDimmed={isDimmed}
                isExpanded={isExpanded}
                isSearchMatch={isSearchMatch}
                onSelect={() => onNodeSelect(position.node)}
                onToggleExpand={
                  position.node.node_type === 'material'
                    ? () => onDocumentToggle(position.node)
                    : undefined
                }
              >
                {isExpanded && (
                  <DocumentEvidenceCluster
                    document={position.node}
                    detail={detailsByEntity[position.id]}
                    evidence={evidenceByEntity[position.id]}
                    activeEvidenceType={activeEvidenceType}
                    visibleEntityIds={visibleEntityIds}
                    selectedEvidenceId={
                      evidenceFocus?.document.id === position.id ? evidenceFocus.item.id : null
                    }
                    isLoading={
                      loadingDetailId === position.id
                      || loadingEvidenceId === position.id
                    }
                    onEvidenceTypeChange={(evidenceType) =>
                      setEvidenceTypeByDocument((current) => ({
                        ...current,
                        [position.id]: evidenceType,
                      }))
                    }
                    onEvidenceSelect={(item) => {
                      setEvidenceTypeByDocument((current) => ({
                        ...current,
                        [position.id]: item.evidence_type,
                      }));
                      onEvidenceSelect(position.node, item);
                    }}
                    onOpenMaterialView={onOpenMaterialView}
                  />
                )}
              </SemanticAtlasNode>
            );
          })}

          {layout.lanes
            .filter((lane) => lane.id === 'review')
            .map((lane) => (
              <ReviewQueueChips
                key={lane.id}
                lane={lane}
                hiddenSummary={hiddenSummary}
                onLensChange={onLensChange}
              />
            ))}

          {atlasNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-slate-400">
                  No semantic nodes
                </div>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Build or load the Semantic Atlas to populate the fixed spatial map.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
