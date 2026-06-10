const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL = configuredApiBaseUrl || (
  import.meta.env.DEV ? 'http://localhost:8000/api/v1' : ''
);
