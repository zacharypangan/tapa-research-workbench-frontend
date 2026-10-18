# Document graphs in the hosted Workbench

This branch starts from `origin/mvp-ollama-cloud` and adds one optional Knowledge graph view. The existing Sources, search, reports and walkthrough remain in place. Atlas, Progress and Governance workspaces are not included.

## Research workflow

1. Open Knowledge graph, or select a source and choose Create graph.
2. Select saved documents or upload PDF, Word, text, Markdown or JSON files. Uploads are saved in the existing repository.
3. Run assisted extraction when configured, or add concepts and relationships from exact source passages.
4. Optionally choose document concepts and attach relevant public web pages. Web evidence stays associated with those document concepts.
5. Inspect the graph and quotations, include or exclude candidates, then download a preview or publish a reviewed version.

Every relationship retains supporting evidence. Proposed cross-source comparisons remain distinguishable from source-reported relationships; inclusion does not imply specialist validation. Saved projects can be reopened using `?view=knowledge&graph=<run-id>`.

If assisted extraction fails the evidence checks, the workflow pauses at Concepts and explains that the source passages need review. Add or correct grounded concepts and relationships in the editor to continue; unchecked model output is not included automatically.

Choose Open source record beside a quotation to inspect its repository details and attached files. The graph inspector retains the exact quotation and page locator; graph ingestion does not require the repository's separate text-extraction step. Create graph always starts a new form, including when no source is selected.

## API pairing

The frontend uses the existing `VITE_API_BASE_URL` configuration. Its backend must include both the existing `/repository` API and the `/research-runs` API from the companion backend branch `codex/mvp-document-graphs`. A frontend-only deployment against the older backend will show graph-service errors.

Graph projects, snapshots, processing checkpoints and published graph versions are stored by the backend. The browser does not contain collection credentials or run the extraction pipeline. Capability responses determine whether assisted extraction and web collection are available; document-only manual work remains supported.

No new frontend dependencies, database tables, authentication changes or additional workspaces are required. Deployment environment settings should pair the preview frontend with the preview backend before sharing it.

## Verification

Run `npm run lint` and `npm run build`. In the paired preview, verify Sources → Create graph → document selection → extraction/manual concepts → optional web enrichment → review → graph download, and open a quotation's source record to return to Sources. Refresh a saved graph URL and confirm the project reopens. Start a new graph with no source selected and confirm the previous project does not reopen; existing segment/image evidence links should still open the corresponding extracted-content tab.

Port checks on 2026-10-17: the production build and focused graph/App/type lint pass. Full-repository lint retains existing legacy findings; comparison against the hosted branch confirms that the two findings in the modified Sources component are unchanged (`no-explicit-any`).

## Document shortcut

Choose **View graph** on a Sources row or its Metadata panel. The graph page opens that document’s latest graph, or starts source-only entity extraction when none exists. The `material` and `graph` URL parameters preserve the document and selected graph on refresh. Unsupported files and evidence-check failures explain the next step. Both pages share the same Workbench header; graph filters and additional creation options remain available in collapsed panels, while the entity list is visible initially.

## Entity details and insights

On desktop, the graph remains beside a persistent detail panel. The first entity is selected automatically; select another entity or connection to inspect its original labels, source, contextual scope, incoming/outgoing relationships, exact quotations and inclusion decisions. The searchable list is open initially. Narrow screens stack the graph and detail panel.

Graph insights show entity types, concepts with/without recorded connections, document–web connections and review totals. Counts describe the current document/graph view before search and filters, including pending and excluded candidates. They are structural diagnostics, not extraction-completeness or scientific-validity scores. Most-connected and unlinked concepts can be opened directly from the insights panel.

The backend's `docs/service-pipeline-review.md` documents the service audit and proposed shared processing pipeline, including the current OCR/index/graph handoff gaps. Those architecture proposals are separate from this UI change.
