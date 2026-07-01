import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE_URL } from '../config';
import { useWorkbenchAuth } from '../auth-context';

interface GovernanceDataset {
  dataset_id: string;
  dataset_name: string;
  title: string;
  owner: string;
  data_manager: string;
  date_received: string;
  version: string;
  status: string;
  access_level: string;
  format: string;
  system_destination: string;
  quality_status: string;
  temporal_applicability: string;
  temporal_record_count: number;
  spatial_applicability: string;
  spatial_record_count: number;
  transformation_count: number;
  resource_count: number;
  resource_names: string;
  package_path: string;
  package_scope: string;
  source_basis: string;
  quality_notes: string;
}

interface GovernanceRegistryResponse {
  generated_at: string;
  summary: {
    total_datasets: number;
    local_pilots: number;
    in_review: number;
    restricted_flags: number;
  };
  datasets: GovernanceDataset[];
}

interface DataGovernanceRegistryProps {
  headerNavigation?: ReactNode;
}

const EMPTY_DATASETS: GovernanceDataset[] = [];

function uniqueValues(
  datasets: GovernanceDataset[],
  field:
    | 'owner'
    | 'status'
    | 'access_level'
    | 'system_destination'
    | 'package_scope',
) {
  return Array.from(
    new Set(datasets.map((dataset) => dataset[field]).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function formatLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function responseError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export function DataGovernanceRegistry({
  headerNavigation,
}: DataGovernanceRegistryProps) {
  const { apiFetch } = useWorkbenchAuth();
  const [registry, setRegistry] =
    useState<GovernanceRegistryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [accessLevel, setAccessLevel] = useState('');
  const [destination, setDestination] = useState('');
  const [scope, setScope] = useState('');

  const loadRegistry = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/governance/registry`, {
        signal,
      });
      if (!response.ok) {
        throw new Error(await responseError(response));
      }
      const payload = (await response.json()) as GovernanceRegistryResponse;
      setRegistry(payload);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load the data governance registry.',
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRegistry(controller.signal);
    return () => controller.abort();
  }, [loadRegistry]);

  const datasets = registry?.datasets ?? EMPTY_DATASETS;
  const filterOptions = useMemo(
    () => ({
      owners: uniqueValues(datasets, 'owner'),
      statuses: uniqueValues(datasets, 'status'),
      accessLevels: uniqueValues(datasets, 'access_level'),
      destinations: uniqueValues(datasets, 'system_destination'),
      scopes: uniqueValues(datasets, 'package_scope'),
    }),
    [datasets],
  );

  const visibleDatasets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return datasets.filter((dataset) => {
      const matchesSearch =
        !normalizedSearch ||
        Object.values(dataset)
          .map((value) => String(value ?? ''))
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      return (
        matchesSearch &&
        (!owner || dataset.owner === owner) &&
        (!status || dataset.status === status) &&
        (!accessLevel || dataset.access_level === accessLevel) &&
        (!destination || dataset.system_destination === destination) &&
        (!scope || dataset.package_scope === scope)
      );
    });
  }, [
    accessLevel,
    datasets,
    destination,
    owner,
    scope,
    search,
    status,
  ]);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(owner) ||
    Boolean(status) ||
    Boolean(accessLevel) ||
    Boolean(destination) ||
    Boolean(scope);

  const clearFilters = () => {
    setSearch('');
    setOwner('');
    setStatus('');
    setAccessLevel('');
    setDestination('');
    setScope('');
  };

  const refreshedAt = registry?.generated_at
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(registry.generated_at))
    : '';

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-slate-50 text-slate-900">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-4 overflow-x-auto">
            <h2 className="hidden shrink-0 text-sm font-black uppercase tracking-[0.18em] lg:block">
              Data Governance
            </h2>
            {headerNavigation}
          </div>
          <div className="flex items-center gap-3">
            {refreshedAt && (
              <span className="hidden text-xs text-slate-400 lg:inline">
                Refreshed {refreshedAt}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadRegistry()}
              disabled={isLoading}
              className="h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto xl:grid-cols-[280px_minmax(420px,1fr)_320px] xl:overflow-hidden">
          <aside
            aria-label="Registry filters"
            className="border-b border-slate-200 bg-white p-4 xl:min-h-0 xl:overflow-auto xl:border-b-0 xl:border-r"
          >
            <label>
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Search
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Dataset, owner, path, notes"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Registry Filters
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[10px] font-black uppercase tracking-wider text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 space-y-4">
              <FilterSelect
                label="Owner"
                value={owner}
                options={filterOptions.owners}
                onChange={setOwner}
              />
              <FilterSelect
                label="Status"
                value={status}
                options={filterOptions.statuses}
                onChange={setStatus}
              />
              <FilterSelect
                label="Access"
                value={accessLevel}
                options={filterOptions.accessLevels}
                onChange={setAccessLevel}
              />
              <FilterSelect
                label="Scope"
                value={scope}
                options={filterOptions.scopes}
                onChange={setScope}
              />
              <FilterSelect
                label="Destination"
                value={destination}
                options={filterOptions.destinations}
                onChange={setDestination}
              />
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Governance Rule
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Browse approved metadata only. Raw and working research files
                remain outside the registry.
              </p>
            </div>
          </aside>

          <section className="min-h-0 p-4 xl:overflow-auto">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Governed Datasets
                </h1>
                <p className="text-xs text-slate-400">
                  {visibleDatasets.length} of {datasets.length} packages shown
                </p>
              </div>
              <Badge>Read only</Badge>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => void loadRegistry()}
                  className="shrink-0 text-xs font-black uppercase tracking-wider hover:text-red-900"
                >
                  Retry
                </button>
              </div>
            )}

            {!registry && isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading governance registry…
              </div>
            ) : !registry ? null : (
              <section
                aria-label="Dataset registry table"
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <tr>
                        <th scope="col" className="w-[24%] px-4 py-3">
                          Dataset
                        </th>
                        <th scope="col" className="w-[15%] px-4 py-3">
                          Stewardship
                        </th>
                        <th scope="col" className="w-[15%] px-4 py-3">
                          Review
                        </th>
                        <th scope="col" className="w-[13%] px-4 py-3">
                          Coverage
                        </th>
                        <th scope="col" className="w-[13%] px-4 py-3">
                          Resources
                        </th>
                        <th scope="col" className="w-[20%] px-4 py-3">
                          Destination
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleDatasets.map((dataset) => (
                        <tr
                          key={`${dataset.package_scope}:${dataset.package_path}`}
                          className="align-top transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-4">
                            <strong className="block leading-snug text-slate-800">
                              {dataset.title || dataset.dataset_name}
                            </strong>
                            <span className="mt-1 block text-xs text-slate-400">
                              {dataset.dataset_id}
                            </span>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge>
                                {formatLabel(dataset.package_scope)}
                              </Badge>
                              <span className="truncate text-[10px] text-slate-400">
                                {dataset.package_path}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="block font-bold text-slate-700">
                              {dataset.owner}
                            </span>
                            <span className="mt-1 block text-xs text-slate-400">
                              {dataset.data_manager}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <Badge>{formatLabel(dataset.status)}</Badge>
                            <span className="mt-2 block text-xs text-slate-500">
                              Quality:{' '}
                              {formatLabel(dataset.quality_status) || 'Unknown'}
                            </span>
                            <span className="mt-1 block text-xs text-slate-400">
                              {formatLabel(dataset.access_level)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600">
                            <span className="block">
                              Time: {formatLabel(
                                dataset.temporal_applicability,
                              )}{' '}
                              ({dataset.temporal_record_count})
                            </span>
                            <span className="mt-2 block">
                              Place:{' '}
                              {formatLabel(dataset.spatial_applicability)} (
                              {dataset.spatial_record_count})
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="block text-lg font-black tabular-nums text-slate-700">
                              {dataset.resource_count}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                              {dataset.resource_names || 'No named resources'}
                            </span>
                            <span className="mt-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {dataset.transformation_count} transformations
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="block text-xs font-bold leading-relaxed text-slate-700">
                              {dataset.system_destination}
                            </span>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">
                              {dataset.quality_notes || 'No quality notes'}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleDatasets.length === 0 && (
                  <div className="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
                    No datasets match the current filters.
                  </div>
                )}
              </section>
            )}
          </section>

          <aside
            aria-label="Registry summary"
            className="border-t border-slate-200 bg-white p-4 xl:min-h-0 xl:overflow-auto xl:border-l xl:border-t-0"
          >
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
                Registry Overview
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Current package and review totals
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {registry &&
                [
                  ['Total datasets', registry.summary.total_datasets],
                  ['Local pilots', registry.summary.local_pilots],
                  ['In review', registry.summary.in_review],
                  ['Restricted flags', registry.summary.restricted_flags],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3"
                  >
                    <span className="text-xs font-bold text-slate-600">
                      {label}
                    </span>
                    <strong className="text-lg font-black tabular-nums text-slate-800">
                      {value}
                    </strong>
                  </div>
                ))}
            </div>

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                Registry Status
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                The registry is live from approved package metadata. Changes
                appear after refresh.
              </p>
              {refreshedAt && (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Refreshed {refreshedAt}
                </p>
              )}
            </div>

            <div className="mt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Included Metadata
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
                <li>Ownership and data management</li>
                <li>Status, access, and quality review</li>
                <li>Temporal and spatial field coverage</li>
                <li>Resources and transformation counts</li>
              </ul>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <label>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-blue-700">
      {children}
    </span>
  );
}
