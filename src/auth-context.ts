import { createContext, useContext } from 'react';

export interface WorkbenchAuth {
  userId: string | null;
  displayName: string;
  getToken: () => Promise<string | null>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export const anonymousFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, init);

export const WorkbenchAuthContext = createContext<WorkbenchAuth>({
  userId: null,
  displayName: 'Local development',
  getToken: async () => null,
  apiFetch: anonymousFetch,
});

export function useWorkbenchAuth() {
  return useContext(WorkbenchAuthContext);
}
