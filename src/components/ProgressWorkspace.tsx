import { startTransition, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useWorkbenchAuth } from '../auth-context';
import { API_BASE_URL } from '../config';
import { MeetingWorkspace } from './progress/MeetingWorkspace';
import type {
  MeetingDetailPayload,
  ProgressApi,
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

export function ProgressWorkspace({ headerNavigation }: ProgressWorkspaceProps) {
  const { apiFetch, displayName } = useWorkbenchAuth();
  const [status, setStatus] = useState<ProgressStatus | null>(null);
  const [meetings, setMeetings] = useState<ProgressMeeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingDetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProgressSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);

  const api: ProgressApi = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set('Content-Type', 'application/json');
    const response = await apiFetch(`${API_BASE_URL}/progress${path}`, { ...init, headers });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      const detailMessage = typeof payload?.detail === 'string'
        ? payload.detail
        : payload?.detail
          ? JSON.stringify(payload.detail)
          : `Progress API returned ${response.status}`;
      throw new Error(detailMessage);
    }
    return response.json() as Promise<T>;
  }, [apiFetch]);

  const loadMeetings = async () => {
    const payload = await api<ProgressMeeting[]>('/meetings');
    setMeetings(payload);
    setSelectedMeetingId((current) => current || payload[0]?.id || null);
  };

  const loadDetail = async (meetingId = selectedMeetingId) => {
    if (!meetingId) return;
    const payload = await api<MeetingDetailPayload>(`/meetings/${meetingId}`);
    setDetail(payload);
  };

  useEffect(() => {
    let active = true;
    Promise.all([api<ProgressStatus>('/status'), api<ProgressMeeting[]>('/meetings')])
      .then(([statusPayload, meetingPayload]) => {
        if (!active) return;
        setStatus(statusPayload);
        setMeetings(meetingPayload);
        setSelectedMeetingId(meetingPayload[0]?.id || null);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Progress API is unavailable.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!selectedMeetingId) {
      setDetail(null);
      return;
    }
    let active = true;
    setIsLoading(true);
    api<MeetingDetailPayload>(`/meetings/${selectedMeetingId}`)
      .then((payload) => { if (active) setDetail(payload); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load meeting.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [api, selectedMeetingId]);

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
      setError(searchError instanceof Error ? searchError.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#edf2ee] text-slate-900">
      <header className="border-b border-emerald-950/10 bg-[#f8faf7]/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 pr-14">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.26em] text-teal-700">Research memory</p>
            <h1 className="font-serif text-xl font-bold tracking-tight">Progress & Provenance</h1>
          </div>
          <form onSubmit={submitSearch} className="order-3 flex w-full max-w-2xl overflow-hidden rounded-full border border-slate-300 bg-white shadow-sm lg:order-none">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search original text, translations, and concepts..." className="min-w-0 flex-1 px-5 py-2.5 text-sm outline-none" />
            <button className="bg-teal-800 px-5 text-xs font-black uppercase tracking-wider text-white">{isSearching ? 'Searching' : 'Search'}</button>
          </form>
          {headerNavigation}
        </div>
      </header>

      {error && <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-800">{error}</div>}

      {searchResults.length > 0 ? (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6 flex items-end justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Bilingual retrieval</p><h2 className="font-serif text-4xl font-semibold">Results for “{search}”</h2></div>
            <button onClick={() => setSearchResults([])} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Return to meetings</button>
          </div>
          <div className="space-y-4">
            {searchResults.map((result) => (
              <button key={`${result.source_kind}:${result.source_id}`} onClick={() => { setSearchResults([]); if (result.meeting_id) startTransition(() => setSelectedMeetingId(result.meeting_id!)); }} className="block w-full rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-teal-400">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                  <span className="text-teal-700">{result.source_kind.replaceAll('_', ' ')}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">{searchBasis[result.retrieval_basis]}</span>
                  <span className="text-slate-400">Matched: {result.matched_term}</span>
                </div>
                {result.title && <h3 className="mt-3 font-serif text-xl font-semibold">{result.title}</h3>}
                {result.original_text && <p className="mt-3 text-sm leading-7 text-slate-800">{result.original_text}</p>}
                {(result.translation_en || result.translation_ja) && <p className="mt-2 border-l-2 border-amber-400 pl-3 text-sm leading-6 text-slate-500">{result.translation_en || result.translation_ja}</p>}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-[#173f35] text-white lg:min-h-[calc(100vh-65px)]">
            <div className="border-b border-white/10 p-5">
              <p className="text-xs text-emerald-100">{displayName}</p>
              <div className="mt-2 flex items-center gap-2"><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase">{status?.role || 'checking'}</span><span className="text-[10px] text-emerald-200">{meetings.length} meetings</span></div>
              <button onClick={() => setShowMeetingForm(true)} className="mt-4 w-full rounded-xl bg-[#e6b95c] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-emerald-950">Add meeting</button>
            </div>
            <nav className="p-3" aria-label="Meetings">
              {meetings.map((meeting) => (
                <button key={meeting.id} onClick={() => startTransition(() => setSelectedMeetingId(meeting.id))} className={`mb-1 block w-full rounded-xl px-4 py-3 text-left ${meeting.id === selectedMeetingId ? 'bg-white text-emerald-950 shadow-lg' : 'text-emerald-50 hover:bg-white/10'}`}>
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em] opacity-65">{meeting.meeting_date}</span>
                  <span className="mt-1 block font-serif text-base font-semibold leading-tight">{meeting.title_original}</span>
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0 bg-[#f4f6f3]">
            {isLoading && !detail && <div className="grid min-h-[60vh] place-items-center text-sm text-slate-500">Loading project ledger...</div>}
            {!isLoading && meetings.length === 0 && <EmptyLedger onAdd={() => setShowMeetingForm(true)} />}
            {detail && <MeetingWorkspace detail={detail} api={api} permissions={status?.permissions || []} onReload={() => loadDetail(detail.meeting.id)} />}
          </main>
        </div>
      )}

      {showMeetingForm && <MeetingForm api={api} onClose={() => setShowMeetingForm(false)} onCreated={async () => { await loadMeetings(); setShowMeetingForm(false); }} />}
    </div>
  );
}

function EmptyLedger({ onAdd }: { onAdd: () => void }) {
  return <div className="grid min-h-[70vh] place-items-center p-8"><div className="max-w-xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">Start the ledger</p><h2 className="mt-3 font-serif text-5xl font-semibold">Document how project data become evidence.</h2><button onClick={onAdd} className="mt-6 rounded-full bg-teal-800 px-6 py-3 text-sm font-bold text-white">Add the first meeting</button></div></div>;
}

function MeetingForm({ api, onClose, onCreated }: { api: ProgressApi; onClose: () => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await api('/meetings', { method: 'POST', body: JSON.stringify({ title_original: title, meeting_date: date, location: location || null, meeting_type: 'hybrid' }) }); await onCreated(); } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-[#fffdf7] p-7 shadow-2xl"><div className="flex justify-between"><h2 className="font-serif text-3xl font-semibold">Add a meeting</h2><button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-bold">Original title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" /></label><label className="block text-sm font-bold">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" /></label><label className="block text-sm font-bold">Location<input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal" /></label></div><button disabled={saving} className="mt-6 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Creating...' : 'Create meeting'}</button></form></div>;
}
