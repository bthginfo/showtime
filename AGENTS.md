# Showtime contributor instructions

This repository is SvelteKit/Svelte 5, TypeScript and a modular event-driven backend. DigitalMask is the read-only historical reference; do not modify that sibling project or access its environment, databases, deployments or private files.

## Security boundaries

- Every business operation requires a verified tenant context and `tenantTransaction`. Never use the application DB outside the request's scoped transaction.
- Runtime roles must be nonowner and NOBYPASSRLS. Keep migration/owner credentials out of deployments and source control. Authentication, tenant control and event workers have separate roles.
- Apply fresh action, department, production and content membership checks. Platform administration does not imply private chat, document or personnel access.
- Tenant IDs from forms, headers, queue messages or file paths are never sufficient authorization. Preserve composite tenant foreign keys and deny missing context.
- Do not trust stale document tickets, recipient lists, grants, caches or browser state after membership withdrawal or expiry.
- Keep secrets, database URLs, cookies, passwords, private documents and API responses out of logs. `.local` and environment files are ignored.

## Architecture

- Reuse module entry points and event contracts for interactions between domains. Do not import Svelte components into server code or server DB/credential code into the browser.
- Persist business data and its outbox event in the same transaction. Consumers are idempotent and respect aggregate versions. Keep private message/document contents out of queue pointers.
- New trades belong in the typed registry and tenant module configuration; reuse shared production, calendar, resource, document, task and chat services.
- Preserve optimistic versions, paging, time windows, private file inheritance and browser namespaces when extending features.

## Verification

Run `npm run typecheck`, `npm run lint`, relevant unit tests and `npm run build`. Permission, tenant, planning or event changes also need real development integration tests. UI changes need the relevant Playwright flows and screenshots. Tests must use synthetic Showtime data and explicitly selected environments.

`tests/e2e/showtime.spec.ts` exercises actual development API/DB/Blob/document and browser flows. Cloud smoke tests must exercise the deployed app, queue consumer, private files and exports. Never claim pixel equality from a build alone; record the states and comparisons that were actually checked.
