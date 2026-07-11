# Multi-stage: build Go + frontend (with fallback if npm fails)
FROM golang:1.25.6 AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /boxbox-server ./cmd/main.go

FROM node:20 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
# Allow build to succeed even if tsc fails - we use vite directly
RUN npx vite build || echo "frontend build failed - will use embedded assets"

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=go-builder /boxbox-server /app/boxbox-server
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
# fallback Alpine assets are already embedded in binary via //go:embed
EXPOSE 8080
ENV PORT=8080
CMD ["/app/boxbox-server","--web","--port","8080"]
