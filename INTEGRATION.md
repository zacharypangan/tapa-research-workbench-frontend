# Integration Notes

This frontend can run as a standalone Vite app or be integrated with the original SpatioTemporal Linguistics frontend.

## Standalone Mode

Use this repository as its own app:

```bash
npm install --legacy-peer-deps
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the backend API root. The research repository routes are expected under:

```text
{VITE_API_BASE_URL}/repository
```

For example:

```text
http://127.0.0.1:8000/api/v1/repository
```

## Original Project Integration

The Research Workbench is implemented as a frontend module inside:

```text
src/components/RepositoryWorkbench.tsx
```

It is currently mounted from:

```text
src/App.tsx
```

To integrate changes back into the original project, compare and port:

- `src/components/RepositoryWorkbench.tsx`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/config.ts`
- `tsconfig.app.json`
- `vercel.json`

Keep `.env` values environment-specific. Commit `.env.example`, not `.env`.

## Phase Tracking

Recommended branch names:

- `phase-1-repository-workbench`
- `phase-2-extraction-search`
- `phase-3-observations`
- `deployment-vercel`

