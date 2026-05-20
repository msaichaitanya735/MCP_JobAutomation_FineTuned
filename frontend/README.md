# frontend

Next.js 15 (App Router) + TypeScript + Tailwind v3 + shadcn/ui (New York
style) + React Flow for the LangGraph state-machine visualization.

```bash
npm install
cp .env.example .env.local   # set DEMO_PASSWORD + AUTH_COOKIE_SECRET
npm run dev                  # http://localhost:3000
```

## Pages

- `/` landing (public): hero, animated graph, how-it-works, links.
- `/login` (public): password gate.
- `/runs` (public): list of curated public runs (read from `public/sample-runs/*.json`).
- `/runs/[id]` (public): detail view with metrics, eligibility, ATS, downloads.
- `/submit` (password): live JD form that POSTs to `/api/runs`.

## API routes

- `POST /api/auth` – verify `DEMO_PASSWORD`, set HttpOnly cookie.
- `POST /api/runs` – proxy to backend Lambda (`NEXT_PUBLIC_BACKEND_URL`).
- `GET /api/runs/:id` – fetch a run record.

## Deployment

See `docs/DEPLOYMENT.md` at the repo root. Amplify reads
`frontend/amplify.yml`.
