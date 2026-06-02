# Tapa Research Workbench Frontend

Standalone React/Vite frontend for the Tapa Research Workbench modules developed from the SpatioTemporal Linguistics project.

The app supports:

- material and reference repository browsing
- uploads and link-based material records
- metadata capture
- extracted text/search/report workflows
- source-linked observations for terms, motifs, places, materials, and processes
- optional evidence-only semantic retrieval and Ask Corpus workflows

This repo can be pushed and tracked independently while still integrating with the original frontend through the files listed in `INTEGRATION.md`.

## Running Locally

```bash
npm install --legacy-peer-deps
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment

Create a `.env` file from `.env.example` to point local development at your backend:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

For production/Vercel, set the same variable to the deployed backend API:

```env
VITE_API_BASE_URL=https://stlingbackend.up.railway.app/api/v1
```

## Deploying to Vercel

This frontend is configured as a Vite app through `vercel.json`.

Recommended Vercel settings:

```text
Root Directory: stling_frontend (only if deploying from the parent GIS folder)
Framework Preset: Vite
Install Command: npm install --legacy-peer-deps
Build Command: npm run build
Output Directory: dist
```

Set `VITE_API_BASE_URL` in Vercel Project Settings if the backend URL changes.

## Optional Evidence Assistant

The Evidence Assistant is intentionally secondary to exact search. It uses the backend Ollama retrieval endpoints only when Ollama is configured there.

It is designed to:

- find semantically related passages
- answer questions only from retrieved corpus evidence
- show citations back to exact source/page/segment records
- surface related human observations

It is not designed to assign motif meaning, cultural interpretation, or analytical categories automatically.

## Standalone Repository Setup

If this folder was originally cloned from another GitHub repo, keep the old remote as `upstream` and push your work to your own repo as `origin`:

```bash
git remote rename origin upstream
git remote add origin https://github.com/YOUR_USERNAME/tapa-research-workbench-frontend.git
git push -u origin main
```

## Integration

See `INTEGRATION.md` for the files to port back into the original project.
