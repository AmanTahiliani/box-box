# Testing

## Go

Targeted offline-ish packages:

```bash
go test ./internal/live ./internal/models ./internal/store ./internal/ingest ./internal/query ./internal/web
```

All packages:

```bash
go test ./...
```

OpenF1 integration tests require network access and are rate-limit aware:

```bash
go test -v ./internal/api
```

## Frontend Unit Tests and Build

```bash
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

## E2E

The default Playwright config starts a seeded Go server on port `18080` and Vite on `15173`.

```bash
npx playwright install   # first time only
npm run test:e2e
```

Production serving mode builds around Go serving `frontend/dist`:

```bash
npm run test:e2e:prod
```

## Visual Regression

```bash
npm run test:visual
npm run test:visual:prod
```

After intentional UI changes:

```bash
npm run test:visual:update
npm run test:visual:prod:update
```

Snapshots live under `tests/visual/__snapshots__/`.
