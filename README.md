# EMS Frontend (Web)

Next.js (App Router) + TypeScript — the primary employee + admin web portal (PLAN.md §6, §11).
Themed with the BrainCrop design tokens from `@ems/config`; talks to the API via `@ems/api-client`.

## Setup & run

```bash
# from the repo root
pnpm install
cp frontend/.env.example frontend/.env.local   # set NEXT_PUBLIC_API_URL if not localhost:4000

pnpm --filter frontend dev     # http://localhost:3000
```

Run the backend too (`pnpm dev:backend`) so the dashboard's live health badge can reach the API.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Next dev server on :3000 (regenerates theme first) |
| `build` / `start` | Production build / serve |
| `typecheck` | `tsc --noEmit` |
| `gen:theme` | Regenerate `src/app/theme.generated.css` from `@ems/config` |

## Theming

`src/app/theme.generated.css` is **auto-generated** from `@ems/config` `buildThemeCss()` (runs on
`predev`/`prebuild`). Never edit it by hand — change tokens in `@ems/config` and regenerate. Colors
are semantic CSS variables (`--color-primary`, …); light/dark switch via the `data-theme` attribute
(see the top-bar toggle). Fonts are Geist (via the `geist` package).

## Layout (M0b shell)

- `src/app/layout.tsx` — root layout (fonts, theme, metadata)
- `src/app/(dashboard)/` — the app shell: `Sidebar` + `Topbar` + summary-card dashboard
- `src/components/` — `Sidebar`, `Topbar`, `ThemeToggle`, `StatCard`, `HealthBadge`, `Logo`
- `src/lib/api.ts` — configured `@ems/api-client` instance

Real module screens (auth, profile, attendance, leaves, payroll) arrive in M1–M4.
