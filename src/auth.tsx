import {
  ClerkProvider,
  SignIn,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/react';
import { createContext, useCallback, useContext } from 'react';
import App from './App';

interface WorkbenchAuth {
  userId: string | null;
  displayName: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const anonymousFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, init);

const WorkbenchAuthContext = createContext<WorkbenchAuth>({
  userId: null,
  displayName: 'Local development',
  apiFetch: anonymousFetch,
});

export function useWorkbenchAuth() {
  return useContext(WorkbenchAuthContext);
}

function ClerkAuthenticatedApp() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = await getToken();
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [getToken],
  );

  if (!isLoaded) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading secure workspace...</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <SignIn routing="hash" />
      </main>
    );
  }

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Project member';
  return (
    <WorkbenchAuthContext.Provider value={{ userId: userId ?? null, displayName, apiFetch }}>
      <div className="fixed right-5 top-4 z-[100] flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-sm backdrop-blur">
        <span className="hidden max-w-48 truncate pl-2 text-xs font-semibold text-slate-600 sm:block">
          {displayName}
        </span>
        <UserButton />
      </div>
      <App />
    </WorkbenchAuthContext.Provider>
  );
}

export function WorkbenchRoot() {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <WorkbenchAuthContext.Provider
        value={{ userId: 'local-admin', displayName: 'Local development', apiFetch: anonymousFetch }}
      >
        <App />
      </WorkbenchAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthenticatedApp />
    </ClerkProvider>
  );
}
