import type {
  InteractiveGraphEdge,
  InteractiveGraphNode,
  SemanticAtlasLens,
} from './graphTypes';
import { edgeSourceId, edgeTargetId } from './graphTypes';

export interface DocumentAtlasGroup {
  id: string;
  label: string;
  basis: 'collection' | 'source_type' | 'repository';
  documents: InteractiveGraphNode[];
}

export const shortDocumentTitle = (title: string, wordLimit = 7) => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) return title;
  return `${words.slice(0, wordLimit).join(' ')}...`;
};

export const groupAtlasDocuments = (documents: InteractiveGraphNode[]): DocumentAtlasGroup[] => {
  const grouped = new Map<string, DocumentAtlasGroup>();

  documents.forEach((document) => {
    const collection = document.collection?.trim();
    const sourceType = document.source_type?.trim();
    const basis: DocumentAtlasGroup['basis'] = collection
      ? 'collection'
      : sourceType
        ? 'source_type'
        : 'repository';
    const label = collection || sourceType || 'Other sources';
    const id = `${basis}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const group = grouped.get(id) || { id, label, basis, documents: [] };
    group.documents.push(document);
    grouped.set(id, group);
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      documents: group.documents.sort(
        (left, right) =>
          (right.evidence_count || 0) - (left.evidence_count || 0)
          || left.label.localeCompare(right.label),
      ),
    }))
    .sort((left, right) => right.documents.length - left.documents.length || left.label.localeCompare(right.label));
};

export const entityTypeForLens = (lens: SemanticAtlasLens) => {
  if (lens === 'concepts') return 'concept';
  if (lens === 'places') return 'place';
  if (lens === 'time') return 'time_period';
  return null;
};

export const relationshipFocus = (
  nodes: InteractiveGraphNode[],
  edges: InteractiveGraphEdge[],
  selectedNodeId: string | null,
  lens: SemanticAtlasLens,
  searchTerm: string,
  showRelationships: boolean,
) => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const lensEntityType = entityTypeForLens(lens);
  const matchingIds = new Set(
    nodes
      .filter((node) => {
        if (!normalizedSearch) return false;
        return [
          node.label,
          node.summary,
          node.node_type,
          JSON.stringify(node.properties),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .map((node) => node.id),
  );

  let focusEdges: InteractiveGraphEdge[] = [];
  if (selectedNodeId) {
    const selected = nodeMap.get(selectedNodeId);
    const directEdges = edges.filter(
      (edge) => edgeSourceId(edge) === selectedNodeId || edgeTargetId(edge) === selectedNodeId,
    );
    if (selected?.node_type === 'material') {
      const entityIds = new Set(
        directEdges.map((edge) =>
          edgeSourceId(edge) === selectedNodeId ? edgeTargetId(edge) : edgeSourceId(edge),
        ),
      );
      focusEdges = edges.filter((edge) => {
        const source = edgeSourceId(edge);
        const target = edgeTargetId(edge);
        return (
          source === selectedNodeId
          || target === selectedNodeId
          || entityIds.has(source)
          || entityIds.has(target)
        );
      });
    } else {
      focusEdges = directEdges;
    }
  } else if (normalizedSearch) {
    focusEdges = edges.filter(
      (edge) => matchingIds.has(edgeSourceId(edge)) || matchingIds.has(edgeTargetId(edge)),
    );
  } else if (lensEntityType) {
    focusEdges = edges.filter((edge) => {
      const source = nodeMap.get(edgeSourceId(edge));
      const target = nodeMap.get(edgeTargetId(edge));
      return source?.node_type === lensEntityType || target?.node_type === lensEntityType;
    });
  } else if (showRelationships) {
    focusEdges = edges;
  }

  const focusedNodeIds = new Set<string>();
  focusEdges.forEach((edge) => {
    focusedNodeIds.add(edgeSourceId(edge));
    focusedNodeIds.add(edgeTargetId(edge));
  });
  if (selectedNodeId) focusedNodeIds.add(selectedNodeId);

  const focusedDocumentIds = new Set(
    nodes
      .filter((node) => node.node_type === 'material' && focusedNodeIds.has(node.id))
      .map((node) => node.id),
  );
  const visibleEntityIds = new Set(
    nodes
      .filter((node) => node.node_type !== 'material' && focusedNodeIds.has(node.id))
      .map((node) => node.id),
  );

  if (!selectedNodeId && !normalizedSearch && lensEntityType) {
    nodes
      .filter((node) => node.node_type === lensEntityType)
      .forEach((node) => visibleEntityIds.add(node.id));
  }

  return {
    focusEdges,
    focusedNodeIds,
    focusedDocumentIds,
    visibleEntityIds,
    matchingIds,
  };
};
