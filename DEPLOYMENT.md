# Frontend Deployment: Vercel

## Shared Workbench release branch

Set the Vercel Production environment's branch to `codex/mvp-document-graphs`.
The shared URL remains `https://tapa-research-workbench-frontend.vercel.app`.
Production `VITE_API_BASE_URL` must keep the existing repository backend:

```text
https://tapa-research-workbench-backend-production.up.railway.app/api/v1
```

Deploy the matching backend branch to Railway `production` first, preserving
its existing volume. The separate preview override below targets the isolated
staging repository; it must not be used for the shared URL.

## Document graph staging before release

Stage `codex/mvp-document-graphs`, based on the hosted `mvp-ollama-cloud` branch.
This adds the Knowledge graph workspace alongside the existing Sources view.
Use the companion backend branch in Railway's isolated `graph-staging`
environment. Set this Vercel variable for **Preview, branch
`codex/mvp-document-graphs` only**:

```text
VITE_API_BASE_URL=https://tapa-research-workbench-backend-graph-staging.up.railway.app/api/v1
```

The Git preview URL follows future pushes to this branch. Production settings
and the shared production URL are independent. See `docs/document-graphs.md`
for the workflow and verification checklist.

Before making this the Production branch, remove its temporary branch-specific
Preview override. Vercel cannot assign a Production branch while that override
exists. The already-built preview keeps its staging API configuration; future
Production builds use the production API setting above.

Deploy this directory as a Vercel Vite project.

## Vercel Settings

```text
Root directory: stling_frontend
Framework preset: Vite
Build command: npm run build
Output directory: dist
```

Set this environment variable in Vercel:

```env
VITE_API_BASE_URL=https://tapa-research-workbench-backend-production.up.railway.app/api/v1
```

Use Vercel deployment protection or team-only access for the first shared-team deployment.

## Backend Pairing

The backend should run on Railway from `stling_backend/` with:

```env
ALLOWED_ORIGINS=https://<vercel-domain>,https://<custom-domain-if-any>
REPOSITORY_STORAGE_ROOT=/app/storage/repository
```

See `../stling_backend/DEPLOYMENT.md` for the backend checklist and smoke check command.
