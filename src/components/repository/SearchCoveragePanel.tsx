import { useEffect, useState } from 'react';

interface SearchCoverage {
  scope: 'material' | 'repository';
  material_id: string | null;
  material_count: number;
  uploaded_file_count: number;
  files_without_extracted_evidence_count: number;
  files_with_failed_extraction_count: number;
  files_with_unsupported_format_count: number;
  materials_without_text_count: number;
  materials_with_failed_extraction_count: number;
  segment_count: number;
  embedded_segment_count: number;
  pending_segment_count: number;
  image_evidence_count: number;
  embedded_image_count: number;
  pending_image_count: number;
  embedding_model: string;
}

interface Props {
  repositoryFetch: (path: string, init?: RequestInit) => Promise<Response>;
  selectedMaterialId: string | null;
  refreshKey: string;
}

export function SearchCoveragePanel({ repositoryFetch, selectedMaterialId, refreshKey }: Props) {
  const [loaded, setLoaded] = useState<{
    materialId: string | null;
    refreshKey: string;
    repository?: SearchCoverage;
    material?: SearchCoverage;
    error?: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const paths = ['/ai/coverage'];
        if (selectedMaterialId) paths.push(`/ai/coverage?material_id=${encodeURIComponent(selectedMaterialId)}`);
        const coverage = await Promise.all(paths.map(async (path) => {
          const response = await repositoryFetch(path, { signal: controller.signal });
          if (!response.ok) throw new Error('Coverage details are unavailable. Refresh after processing or check the backend version.');
          return await response.json() as SearchCoverage;
        }));
        if (!controller.signal.aborted) setLoaded({ materialId: selectedMaterialId, refreshKey, repository: coverage[0], material: coverage[1] });
      } catch (error) {
        if (!controller.signal.aborted) setLoaded({ materialId: selectedMaterialId, refreshKey, error: error instanceof Error ? error.message : 'Coverage details are unavailable.' });
      }
    };
    void load();
    return () => controller.abort();
  }, [repositoryFetch, selectedMaterialId, refreshKey]);

  const current = loaded?.materialId === selectedMaterialId && loaded.refreshKey === refreshKey ? loaded : null;
  const repository = current?.repository;
  return (
    <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="cursor-pointer font-semibold">
        Repository search coverage {repository ? `· ${repository.embedded_segment_count}/${repository.segment_count} passages and ${repository.embedded_image_count}/${repository.image_evidence_count} images indexed` : ''}
      </summary>
      {!current && <p className="mt-2" role="status">Loading coverage…</p>}
      {current?.error && <p className="mt-2 text-amber-800" role="status">{current.error}</p>}
      {repository && <CoverageDetails coverage={repository} label="Whole repository" />}
      {current?.material && <CoverageDetails coverage={current.material} label="Selected material" />}
      <p className="mt-2">Exact search uses extracted text. Related search can also use indexed passages and image text. Missing extraction or indexing can leave evidence undiscovered; an empty result does not establish absence.</p>
      <p className="mt-1">Image indexing counts searchable OCR and description text. These counts do not measure OCR accuracy, language coverage, or scholarly correctness.</p>
    </details>
  );
}

function CoverageDetails({ coverage, label }: { coverage: SearchCoverage; label: string }) {
  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <p className="font-semibold">{label}: {coverage.material_count} material(s), {coverage.uploaded_file_count} uploaded file(s)</p>
      <p>{coverage.segment_count} extracted passages · {coverage.pending_segment_count} awaiting embeddings · {coverage.image_evidence_count} extracted images · {coverage.pending_image_count} awaiting embeddings</p>
      <p>{coverage.materials_without_text_count} material(s) without extracted text · {coverage.files_without_extracted_evidence_count} file(s) without extracted evidence</p>
      <p className={coverage.files_with_failed_extraction_count || coverage.materials_with_failed_extraction_count ? 'text-amber-800' : ''}>
        {coverage.files_with_failed_extraction_count} file failure(s) · {coverage.materials_with_failed_extraction_count} material(s) whose latest extraction failed · {coverage.files_with_unsupported_format_count} unsupported file(s)
      </p>
      <p className="mt-1 text-slate-500">Embedding model: {coverage.embedding_model}</p>
    </div>
  );
}
