package web

import (
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPAFileServerServesAssetsAndRoutesToIndex(t *testing.T) {
	staticFS := fstest.MapFS{
		"index.html":          {Data: []byte("<html>react app</html>")},
		"assets/app-123.js":   {Data: []byte("console.log('react')")},
		"assets/app-123.css":  {Data: []byte("body{}")},
		"nested/real-page.js": {Data: []byte("export {}")},
	}
	handler := spaFileServer(staticFS)

	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "root", path: "/", want: "react app"},
		{name: "race hub route", path: "/race-hub", want: "react app"},
		{name: "data library route", path: "/data-library", want: "react app"},
		{name: "real asset", path: "/assets/app-123.js", want: "console.log('react')"},
		{name: "nested real asset", path: "/nested/real-page.js", want: "export {}"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", rec.Code)
			}
			if !strings.Contains(rec.Body.String(), tt.want) {
				t.Fatalf("body = %q, want substring %q", rec.Body.String(), tt.want)
			}
		})
	}
}

func TestSelectStaticFSPrefersFrontendDist(t *testing.T) {
	workspace := t.TempDir()
	dist := filepath.Join(workspace, "frontend", "dist")
	if err := os.MkdirAll(filepath.Join(dist, "assets"), 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(dist, "index.html"), []byte("<html>built react</html>"), 0o644); err != nil {
		t.Fatalf("WriteFile(index.html) error = %v", err)
	}
	if err := os.WriteFile(filepath.Join(dist, "assets", "bundle.js"), []byte("built bundle"), 0o644); err != nil {
		t.Fatalf("WriteFile(bundle.js) error = %v", err)
	}

	child := filepath.Join(workspace, "internal", "web")
	if err := os.MkdirAll(child, 0o755); err != nil {
		t.Fatalf("MkdirAll(child) error = %v", err)
	}
	t.Chdir(child)

	staticFS, err := selectStaticFS()
	if err != nil {
		t.Fatalf("selectStaticFS() error = %v", err)
	}

	body, err := fs.ReadFile(staticFS, "index.html")
	if err != nil {
		t.Fatalf("ReadFile(index.html) error = %v", err)
	}
	if string(body) != "<html>built react</html>" {
		t.Fatalf("index.html = %q, want built React index", string(body))
	}
}

func TestSelectStaticFSFallsBackToEmbeddedAssets(t *testing.T) {
	t.Chdir(t.TempDir())

	staticFS, err := selectStaticFS()
	if err != nil {
		t.Fatalf("selectStaticFS() error = %v", err)
	}

	body, err := fs.ReadFile(staticFS, "index.html")
	if err != nil {
		t.Fatalf("ReadFile(index.html) error = %v", err)
	}
	if !strings.Contains(string(body), "box-box") {
		t.Fatalf("embedded index.html = %q, want legacy box-box asset", string(body))
	}
}

func TestRoutesPreserveAPIPrecedenceOverSPA(t *testing.T) {
	t.Chdir(t.TempDir())
	srv := testServer(t, nil)
	handler, err := srv.routes()
	if err != nil {
		t.Fatalf("routes() error = %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/seasons", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if strings.Contains(rec.Body.String(), "<html") {
		t.Fatalf("API response was served by SPA fallback: %q", rec.Body.String())
	}
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("body = %q, want []", rec.Body.String())
	}
}
