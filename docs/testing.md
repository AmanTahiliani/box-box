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

## Release Fidelity and Owner Review

Visual regression and mockup fidelity are deliberately separate gates. `npm run test:visual:prod` verifies the candidate against committed regression snapshots; it does not establish that the current UI matches the approved product design.

After the approved references are available at `docs/product/<version>/mockups/`, make an offline review packet. For v0.4.0 the packet pairs `weekend-between-races` and `weekend-live` at the 1280×800 desktop reference viewport, plus `weekend-between-sessions-mobile` at the 390×844 mobile reference viewport. The capture configuration uses the same seeded SQLite data and unreachable OpenF1 endpoint as the visual suite.

```bash
export RELEASE_FIDELITY_VERSION=v0.4.0
npm run release:fidelity:capture
npm run release:fidelity:packet
```

Open `release-fidelity/v0.4.0/index.html` and review every approved-mockup/candidate pair. The owner, not an automated tool, records a decision in the committed file `docs/release/owner-reviews/v0.4.0.md`:

```md
# Owner Fidelity Sign-off: v0.4.0

- Version: v0.4.0
- Candidate commit: <full commit SHA>
- Reviewed by: <owner name>
- Reviewed on: YYYY-MM-DD
- Decision: approved
```

Do not create the file or use `approved` until the owner has reviewed the packet. Once it is committed, the release gate can verify the evidence and decision:

```bash
npm run release:fidelity:verify
```

The verifier checks that the packet exists, the sign-off exists in `HEAD`, and its full candidate SHA names a commit that is an ancestor of the sign-off commit. It also requires the owner, date, and approved decision fields. It intentionally cannot assess visual fidelity or create approval.

For a release candidate, `npm run release:fidelity:gate` runs production visual regression first, then capture, packet generation, and owner-evidence verification in that order. It will remain red until the owner has committed the sign-off.

## Deployment and Rollback

Build and preserve a SHA-256 record with the deployable binary. Verify the staged binary before replacing the running one:

```bash
mkdir -p dist
go build -trimpath -o dist/box-box ./cmd/main.go
sha256sum dist/box-box | tee dist/box-box.sha256
sha256sum -c dist/box-box.sha256
```

Record the current production binary and its SHA before deployment. If owner review rejects the release or deployment fails, restore that saved binary, then verify the restored SHA is byte-identical to the pre-deployment record:

```bash
sha256sum /srv/box-box/box-box
install -m 0755 /srv/box-box/backups/box-box.previous /srv/box-box/box-box
sha256sum -c /srv/box-box/backups/box-box.previous.sha256
```

Restart and health-check the service using the deployment environment's normal procedure. Keep the candidate SHA, prior SHA, fidelity packet path, and owner sign-off path with the release record.
