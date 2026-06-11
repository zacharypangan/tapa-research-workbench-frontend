const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const mvpApiBaseUrl = 'https://tapa-research-workbench-backend-production.up.railway.app/api/v1';

export const API_BASE_URL = configuredApiBaseUrl || (
  import.meta.env.DEV ? 'http://localhost:8000/api/v1' : mvpApiBaseUrl
);
