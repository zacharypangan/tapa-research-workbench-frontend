# stling_frontend/AGENTS.md

## Frontend Rules

- Use existing React/component patterns.
- Check nearby components before creating new ones.
- Keep UI changes localized.
- Do not rewrite global styling unless requested.
- Do not add UI libraries without asking.
- Preserve existing accessibility patterns.
- Preserve existing bilingual text patterns if present.

## Credit-Saving Workflow

For UI bugs:
1. Start from the exact component, route, modal, button, or error message.
2. Inspect the smallest likely component tree.
3. Check related utility files only if the component calls them.
4. Avoid broad scans of all UI files.
5. Make the smallest fix and provide manual test steps.

## Testing

- Run `npm run lint` after editing frontend files if lint exists.
- Run `npm run build` when imports, routing, or production behavior are affected.
- Do not repeatedly run the dev server unless necessary.

## Common Focus Areas

For report/PDF/export issues, inspect in this order:
1. report modal component
2. export/download utility
3. print/PDF CSS
4. search highlighting utility
5. API call only if the UI depends on server-rendered data

