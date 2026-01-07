# SEO_rapport

Kör SEO-/prestandarapporter med Playwright + Lighthouse. Nu finns både CLI (`node src/run.js <url>`) och ett API (`npm run api` → POST `/api/run-report`).

## Snabbstart lokalt
1. Installera: `npm install`
2. CLI: `node src/run.js https://example.com`
3. API: `npm run api` och POST:
```bash
curl -X POST http://localhost:3000/api/run-report \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
Svar: `{ ok: true, htmlPath, pdfPath }` (filer i `output/`).

## Docker (worker)
```bash
docker build -t seo-rapport .
docker run --rm -p 3000:3000 -v "$PWD/output:/app/output" seo-rapport
```

## Vercel + worker-API
- Deploya bara frontend (formulär) på Vercel. `vercel.json` pekar på `public/` som output.
- Worker (Docker/VPS) kör `npm run api`. Exponera t.ex. `https://din-worker.com`.
- Öppna Vercel-sidan med query för worker: `https://din-vercel-url?worker=https://din-worker.com`. Den sparas i localStorage och används för POST.
- Frontend POST: `https://din-worker.com/api/run-report` med `{ url, email, phone }`. Worker svarar med paths/länkar; lagra HTML/PDF i t.ex. S3/B2 om du vill dela publika länkar.

## API-schema
POST `/api/run-report`
Body: `{ "url": "https://site.com", "email": "valfritt", "phone": "valfritt" }`
Svar: `{ "ok": true, "htmlPath": "output/report-*.html", "pdfPath": "output/report-*.pdf" }`

## Struktur
- `src/audit/runAudit.js` – modulärt anrop som kör alla steg och bygger rapport.
- `src/server.js` – enkel Express-API som wrappar `runAudit`.
- `src/run.js` – CLI.

## Att sälja/embeda
1) Ha en worker (Docker) med API:t publikt eller bakom autentisering.
2) Frontend (t.ex. Next.js) med formulär postar till worker-API.
3) Skicka rapportlänk till kund via UI eller e-post (lägg till SendGrid/Nodemailer i servern vid behov).

## Noteringar
- Playwright/Lighthouse kräver mer runtime än Vercels lambdas; därför körs arbetet bäst i en worker-container/server.
- Output paths är lokala; publicera dem via en CDN/storage om du vill ge direktlänkar.***
