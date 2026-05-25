# box-box Web Frontend

React Race Hub slice for the production Web UI.

## Commands

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

The Vite dev server proxies `/api` requests to the Go server on
`http://localhost:8080`.

Run the backend separately:

```bash
go run cmd/main.go --web
```

Then open the React app, usually:

```text
http://localhost:5173/race-hub
```

Load an ingested session with:

```text
http://localhost:5173/race-hub?session_key=9472
```
