# Trinobil web

pnpm workspace with two separate projects:

| Project | What | Dev | Port |
|---|---|---|---|
| `app/` | Functional web app (React + Vite + TypeScript + Tailwind) using the same Trinobil backend and logins as the mobile app | `pnpm dev:app` | 3000 |
| `landing/` | Marketing landing page | `pnpm dev:landing` | 3001 |

```bash
pnpm install          # once
pnpm dev:app          # http://localhost:3000  (proxies /api to the gateway on :8080)
pnpm dev:landing      # http://localhost:3001
pnpm build            # production builds in app/dist and landing/dist
```

## App
- API types are generated from the backend's OpenAPI specs: `pnpm --filter @trinobil/app gen:api`
  (refresh `app/openapi/*.json` from the running services first).
- Dev proxy target: `TRINOBIL_API` (default `http://127.0.0.1:8080`). For production set `VITE_API_BASE`
  if the app is not served from the same origin as the gateway.

## Landing
Set in `landing/.env` for production:
- `VITE_APP_URL` – where "Sign in / Open the web app" go
- `VITE_APK_URL` – Android app download link
- `VITE_CONTACT_EMAIL` – contact address on the page
