# @staylayer/operator-console

Internal operator control plane. **Not** a customer-facing app.

This is the new home for what used to be `/admin/*` in `apps/dashboard`. The
customer dashboard is customer-only and must not import from this app or
include operator routes.

## Status

Phase 1 scaffolding. See
[`operator-console-docs/08-opus-4-7-implementation-phases.md`](../../operator-console-docs/08-opus-4-7-implementation-phases.md)
for the phase plan.

- Phase 1 (current): app shell, router, layout, placeholder auth provider,
  Command Center placeholder.
- Phase 2: real `/operator/auth/*` endpoints and login form.
- Phase 3: granular permission registry and guards.
- Phase 4+: tenant 360, support, billing, operations, analytics, etc.

## Local development

```powershell
pnpm --filter @staylayer/operator-console dev
```

Runs on port `5174` so it does not collide with `apps/dashboard` (`5173`)
or `apps/marketing` (`3002`).

The dev server proxies `/api` to `http://localhost:4000` exactly like the
customer dashboard. Set `VITE_API_URL` in `.env.local` to point at a
different backend.

## Invariants

- No imports from `apps/dashboard/*`.
- Session storage key is `operator_*` so the two apps do not share state.
- Every operator mutation must be permission-checked and audited on the
  backend (enforced from Phase 3 onward).
