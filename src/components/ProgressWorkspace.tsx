import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useWorkbenchAuth } from '../auth-context';
import { API_BASE_URL } from '../config';
import { MeetingWorkspace } from './progress/MeetingWorkspace';
import { ProjectProgressPage } from './progress/ProjectProgressPage';
import type {
  MeetingDetailPayload,
  ProgressApi,
  ProjectProgressDashboard,
  ProgressMeeting,
  ProgressSearchResult,
  ProgressStatus,
} from './progress/types';

interface ProgressWorkspaceProps {
  headerNavigation?: ReactNode;
}

const searchBasis = {
  original: 'Original text',
  translation: 'Translation',
  concept_alias: 'Concept expansion',
};

const responseError = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (payload?.detail) return JSON.stringify(payload.detail);
  return fallback;
};

export function ProgressWorkspace({ headerNavigation }: ProgressWorkspaceProps) {
  const { apiFetch, displayName } = useWorkbenchAuth();
  const [status, setStatus] = useState<ProgressStatus | null>(null);
  const [meetings, setMeetings] = useState<ProgressMeeting[]>([]);
  const [dashboard, setDashboard] = useState<ProjectProgressDashboard | null>(null);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activeSurface, setActiveSurface] = useState<'dashboard' | 'meeting'>('dashboard');
  const [detail, setDetail] = useState<MeetingDetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProgressSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);

  const api: ProgressApi = useCallback(
    async <T,>(path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (init?.body) headers.set('Content-Type', 'application/json');
      const response = await apiFetch(`${API_BASE_URL}/progress${path}`, {
        ...init,
        headers,
      });
      if (!response.ok) {
        throw new Error(
          await responseError(response, `Progress API returned ${response.status}`),
        );
      }
      return response.json() as Promise<T>;
    },
    [apiFetch],
  );

  const loadMeetings = useCallback(async () => {
    const payload = await api<ProgressMeeting[]>('/meetings');
    setMeetings(payload);
    setSelectedMeetingId((current) => current || payload[0]?.id || null);
    return payload;
  }, [api]);

  const loadDashboard = useCallback(async () => {
    const payload = await api<ProjectProgressDashboard>('/dashboard');
    setDashboard(payload);
    return payload;
  }, [api]);

  const loadDetail = useCallback(
    async (meetingId = selectedMeetingId) => {
      if (!meetingId) return null;
      const payload = await api<MeetingDetailPayload>(`/meetings/${meetingId}`);
      setDetail(payload);
      return payload;
    },
    [api, selectedMeetingId],
  );

  useEffect(() => {
    let active = true;
    Promise.all([api<ProgressStatus>('/status'), loadMeetings(), loadDashboard()])
      .then(([statusPayload, meetingPayload]) => {
        if (!active) return;
        setStatus(statusPayload);
        setSelectedMeetingId((current) => current || meetingPayload[0]?.id || null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Progress API is unavailable.',
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, loadDashboard, loadMeetings]);

  useEffect(() => {
    if (activeSurface !== 'meeting') return;
    if (!selectedMeetingId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsLoading(true);
    api<MeetingDetailPayload>(`/meetings/${selectedMeetingId}`)
      .then((payload) => {
        if (active) setDetail(payload);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load the selected meeting.',
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeSurface, api, selectedMeetingId]);

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: search.trim(), limit: '60' });
      const payload = await api<ProgressSearchResult[]>(`/search?${params}`);
      setSearchResults(payload);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : 'Search failed.',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const canWrite = status?.permissions.includes('progress:write') ?? false;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm">
      <div className="flex h-full w-full flex-col bg-slate-50 text-slate-900">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
          <div className="flex min-w-0 items-center gap-4 overflow-x-auto">
            <h2 className="hidden shrink-0 text-sm font-black uppercase tracking-[0.18em] lg:block">
              Progress Portal
            </h2>
            {headerNavigation}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 lg:inline-flex">
              {status?.role || 'Checking'}
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={() => setShowMeetingForm(true)}
                className="h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
              >
                New Meeting
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-white p-4 xl:min-h-0 xl:overflow-auto xl:border-b-0 xl:border-r">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Signed in
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-400">
                    Meetings
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {meetings.length}
                  </p>
                </div>
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-400">
                    Records
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {dashboard?.summary.record_count ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={submitSearch} className="mt-4 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                Portal Search
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Original text, translations, concepts"
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  {isSearching ? 'Searching' : 'Search'}
                </button>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchResults([])}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            <div className="mt-6">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                Views
              </h3>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearchResults([]);
                    startTransition(() => setActiveSurface('dashboard'));
                  }}
                  className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    activeSurface === 'dashboard' && searchResults.length === 0
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Overview
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-slate-900">
                    Project tracker
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Progress, records, and narrative arc development
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Meetings
                </h3>
                <button
                  type="button"
                  onClick={() => void Promise.all([loadMeetings(), loadDashboard()])}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
              <nav className="mt-3 space-y-2" aria-label="Meetings">
                {meetings.map((meeting) => {
                  const isActive = meeting.id === selectedMeetingId;
                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => {
                        setSearchResults([]);
                        startTransition(() => {
                          setActiveSurface('meeting');
                          setSelectedMeetingId(meeting.id);
                        });
                      }}
                      className={`block w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                        isActive && activeSurface === 'meeting'
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {meeting.meeting_date}
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-slate-900">
                        {meeting.title_original}
                      </span>
                      {meeting.title_en && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {meeting.title_en}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="min-h-0 overflow-auto">
            {searchResults.length > 0 ? (
              <SearchResultsPanel
                query={search}
                results={searchResults}
                onOpenMeeting={(meetingId) => {
                  setSearchResults([]);
                  startTransition(() => {
                    setActiveSurface('meeting');
                    setSelectedMeetingId(meetingId);
                  });
                }}
              />
            ) : isLoading && (activeSurface === 'dashboard' ? !dashboard : !detail) ? (
              <div className="grid min-h-full place-items-center px-6 text-sm text-slate-500">
                Loading progress portal...
              </div>
            ) : !isLoading && meetings.length === 0 ? (
              <EmptyLedger onAdd={() => setShowMeetingForm(true)} canWrite={canWrite} />
            ) : activeSurface === 'dashboard' && dashboard ? (
              <ProjectProgressPage
                dashboard={dashboard}
                onOpenMeeting={(meetingId) => {
                  startTransition(() => {
                    setActiveSurface('meeting');
                    setSelectedMeetingId(meetingId);
                  });
                }}
              />
            ) : detail ? (
              <MeetingWorkspace
                detail={detail}
                api={api}
                permissions={status?.permissions || []}
                onReload={async () => {
                  await Promise.all([loadDetail(detail.meeting.id), loadDashboard()]);
                }}
              />
            ) : (
              <div className="grid min-h-full place-items-center px-6 text-sm text-slate-500">
                Choose a meeting to inspect its archive structure.
              </div>
            )}
          </main>
        </div>
      </div>

      {showMeetingForm && (
        <MeetingForm
          api={api}
          onClose={() => setShowMeetingForm(false)}
          onCreated={async () => {
            const [payload] = await Promise.all([loadMeetings(), loadDashboard()]);
            const nextMeeting = payload[0]?.id || null;
            setActiveSurface('meeting');
            setSelectedMeetingId(nextMeeting);
            if (nextMeeting) {
              await loadDetail(nextMeeting);
            }
            setShowMeetingForm(false);
          }}
        />
      )}
    </div>
  );
}

function SearchResultsPanel({
  query,
  results,
  onOpenMeeting,
}: {
  query: string;
  results: ProgressSearchResult[];
  onOpenMeeting: (meetingId: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Bilingual Retrieval
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Results for “{query}”
        </h2>
      </div>
      <div className="mt-4 space-y-3">
        {results.map((result) => (
          <button
            key={`${result.source_kind}:${result.source_id}`}
            type="button"
            onClick={() => {
              if (result.meeting_id) onOpenMeeting(result.meeting_id);
            }}
            className="block w-full rounded-xl border border-slate-200 bg-white p-5 text-left hover:bg-slate-50"
          >
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                {result.source_kind.replaceAll('_', ' ')}
              </span>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
                {searchBasis[result.retrieval_basis]}
              </span>
              <span className="text-slate-400">Matched: {result.matched_term}</span>
            </div>
            {result.title && (
              <h3 className="mt-3 text-lg font-semibold text-slate-900">
                {result.title}
              </h3>
            )}
            {result.original_text && (
              <p className="mt-3 text-sm leading-6 text-slate-800">
                {result.original_text}
              </p>
            )}
            {(result.translation_en || result.translation_ja) && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                {result.translation_en || result.translation_ja}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyLedger({
  onAdd,
  canWrite,
}: {
  onAdd: () => void;
  canWrite: boolean;
}) {
  return (
    <div className="grid min-h-full place-items-center p-8">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Start The Ledger
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Document how meetings turn source material into evidence.
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-6 h-10 rounded-lg border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
          >
            Add The First Meeting
          </button>
        )}
      </div>
    </div>
  );
}

function MeetingForm({
  api,
  onClose,
  onCreated,
}: {
  api: ProgressApi;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title_original: title,
          meeting_date: date,
          location: location || null,
          meeting_type: 'hybrid',
        }),
      });
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Progress Portal
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Add Meeting
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Original title
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Date
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Location
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <button
          disabled={saving}
          className="mt-6 h-10 rounded-lg border border-slate-200 bg-white px-5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Creating' : 'Create Meeting'}
        </button>
      </form>
    </div>
  );
}
