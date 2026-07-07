# App Router (`src/app/`)

**Why:** Next.js 14 App Router defines every URL, layout, and server/client boundary.

## Route groups

| Group | Path prefix | Purpose |
|-------|-------------|---------|
| `(marketing)` | `/` | Public landing page — no auth required |
| `(auth)` | `/sign-in`, `/sign-up` | Clerk authentication pages |
| `(dashboard)` | `/dashboard`, `/portfolio`, … | Protected app shell with sidebar |

Route groups in parentheses do **not** affect the URL. `(dashboard)/dashboard` → `/dashboard`.

## Conventions

- `layout.tsx` — shared chrome (sidebar, header) per group
- `page.tsx` — route entry; prefer Server Components for initial data
- `loading.tsx` — skeleton loaders during suspense
- `error.tsx` — route-level error boundaries
