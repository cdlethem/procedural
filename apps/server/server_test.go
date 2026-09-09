package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testServer(t *testing.T) http.Handler {
	t.Helper()
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return NewServer(store)
}

func request(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if method == http.MethodPost || method == http.MethodPut {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func decodeProject(t *testing.T, recorder *httptest.ResponseRecorder) Project {
	t.Helper()
	var project Project
	if err := json.Unmarshal(recorder.Body.Bytes(), &project); err != nil {
		t.Fatal(err)
	}
	return project
}

func TestCRUDAndPersistence(t *testing.T) {
	dir := t.TempDir()
	store, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	handler := NewServer(store)

	created := request(t, handler, http.MethodPost, "/api/projects", `{"title":"First","document":{"schemaVersion":1,"canvas":{"width":800}}}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create = %d: %s", created.Code, created.Body.String())
	}
	project := decodeProject(t, created)
	if len(project.ID) != 64 || project.Title != "First" {
		t.Fatalf("unexpected project: %#v", project)
	}

	listed := request(t, handler, http.MethodGet, "/api/projects", "")
	if listed.Code != http.StatusOK {
		t.Fatalf("list = %d", listed.Code)
	}
	var list struct {
		Projects []projectSummary `json:"projects"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list.Projects) != 1 || list.Projects[0].ID != project.ID {
		t.Fatalf("list = %#v", list)
	}

	got := request(t, handler, http.MethodGet, "/api/projects/"+project.ID, "")
	if got.Code != http.StatusOK || decodeProject(t, got).Title != "First" {
		t.Fatalf("get = %d: %s", got.Code, got.Body.String())
	}

	updated := request(t, handler, http.MethodPut, "/api/projects/"+project.ID, `{"title":"Second","document":{"schemaVersion":1,"layers":[]}}`)
	if updated.Code != http.StatusOK || decodeProject(t, updated).Title != "Second" {
		t.Fatalf("update = %d: %s", updated.Code, updated.Body.String())
	}

	// A new store instance must read the atomically persisted record.
	reopened, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := reopened.get(project.ID)
	if err != nil || persisted.Title != "Second" {
		t.Fatalf("persisted = %#v, %v", persisted, err)
	}

	deleted := request(t, handler, http.MethodDelete, "/api/projects/"+project.ID, "")
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("delete = %d", deleted.Code)
	}
	if result := request(t, handler, http.MethodGet, "/api/projects/"+project.ID, ""); result.Code != http.StatusNotFound {
		t.Fatalf("get deleted = %d", result.Code)
	}
}

func TestInvalidBodiesAndIDs(t *testing.T) {
	handler := testServer(t)
	cases := []struct {
		name, path, body string
		status           int
	}{
		{"unknown key", "/api/projects", `{"title":"x","document":{"schemaVersion":1},"extra":true}`, http.StatusBadRequest},
		{"trailing JSON", "/api/projects", `{"title":"x","document":{"schemaVersion":1}} {}`, http.StatusBadRequest},
		{"array document", "/api/projects", `{"title":"x","document":[{"schemaVersion":1}]}`, http.StatusBadRequest},
		{"bad schema", "/api/projects", `{"title":"x","document":{"schemaVersion":2}}`, http.StatusBadRequest},
		{"missing title", "/api/projects", `{"document":{"schemaVersion":1}}`, http.StatusBadRequest},
		{"unsafe ID", "/api/projects/not-an-id", "", http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			method := http.MethodPost
			if tc.path != "/api/projects" {
				method = http.MethodGet
			}
			response := request(t, handler, method, tc.path, tc.body)
			if response.Code != tc.status {
				t.Fatalf("status = %d: %s", response.Code, response.Body.String())
			}
			if !bytes.Contains(response.Body.Bytes(), []byte(`"error"`)) {
				t.Fatalf("not JSON error: %s", response.Body.String())
			}
		})
	}
}

func harnessDocument() string {
	return `{"schemaVersion":2,"bindingVersion":"harness-v1","catalogSha256":"0000000000000000000000000000000000000000000000000000000000000000","width":640,"height":640,"background":"#ece7da","layers":[{"id":"source-layer","kind":"source","visible":true,"opacity":1,"content":{"language":"p5js","sourceArtifactHash":"1111111111111111111111111111111111111111111111111111111111111111","previewArtifactHash":null,"runnerProfile":"p5-static-640-v1","entrypoint":"sketch.js","background":"transparent","randomSeed":1,"noiseSeed":2,"tick":1,"controls":{"density":12}}}]}`
}

func harnessMixedDocument() string {
	return `{"schemaVersion":2,"bindingVersion":"harness-v1","catalogSha256":"0000000000000000000000000000000000000000000000000000000000000000","width":640,"height":640,"background":"#ece7da","layers":[{"id":"source-layer","kind":"source","visible":true,"opacity":1,"content":{"language":"p5js","sourceArtifactHash":"1111111111111111111111111111111111111111111111111111111111111111","previewArtifactHash":null,"runnerProfile":"p5-static-640-v1","entrypoint":"sketch.js","background":"transparent","randomSeed":1,"noiseSeed":2,"tick":1,"controls":{"density":12}}},{"id":"workflow-layer","kind":"workflow","visible":true,"opacity":0.5,"content":{"technique":"field-marks","seed":3,"palette":[0,16777215],"cutEdits":[],"transform":{"x":320,"y":320,"scale":1,"rotation":0},"params":{"custom name":"any value","over-24-parameters-are-not-generic-controls":true}}}]}`
}

func TestHarnessV1StrictPersistence(t *testing.T) {
	handler := testServer(t)
	created := request(t, handler, http.MethodPost, "/api/projects", `{"title":"Prompt layer","document":`+harnessMixedDocument()+`}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create = %d: %s", created.Code, created.Body.String())
	}
	project := decodeProject(t, created)
	loaded := request(t, handler, http.MethodGet, "/api/projects/"+project.ID, "")
	if loaded.Code != http.StatusOK || string(decodeProject(t, loaded).Document) != harnessMixedDocument() {
		t.Fatalf("load = %d: %s", loaded.Code, loaded.Body.String())
	}
	for _, document := range []string{
		strings.Replace(harnessDocument(), `"entrypoint":"sketch.js"`, `"entrypoint":"../sketch.js"`, 1),
		strings.Replace(harnessDocument(), `"tick":1`, `"tick":601`, 1),
		strings.Replace(harnessDocument(), `"layers":[`, `"extra":true,"layers":[`, 1),
		strings.Replace(harnessDocument(), `"controls":{"density":12}`, `"controls":{"Bad-key":12}`, 1),
	} {
		response := request(t, handler, http.MethodPost, "/api/projects", `{"title":"invalid","document":`+document+`}`)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid harness document = %d: %s", response.Code, response.Body.String())
		}
	}
}

func TestLimitsAndRoutes(t *testing.T) {
	handler := testServer(t)
	tooLarge := `{"title":"x","document":{"schemaVersion":1,"data":"` + strings.Repeat("x", maxRequestBytes) + `"}}`
	if response := request(t, handler, http.MethodPost, "/api/projects", tooLarge); response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large = %d: %s", response.Code, response.Body.String())
	}
	if response := request(t, handler, http.MethodPatch, "/api/projects", ""); response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("method = %d", response.Code)
	}
	if response := request(t, handler, http.MethodGet, "/wrong", ""); response.Code != http.StatusNotFound {
		t.Fatalf("route = %d", response.Code)
	}
	if response := request(t, handler, http.MethodGet, "/api/health", ""); response.Code != http.StatusOK {
		t.Fatalf("health = %d", response.Code)
	}
	trailing := `{"title":"x","document":{"schemaVersion":1}}` + strings.Repeat(" ", maxRequestBytes)
	if response := request(t, handler, http.MethodPost, "/api/projects", trailing); response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("large trailing body = %d: %s", response.Code, response.Body.String())
	}
}

func TestMutationBrowserGuards(t *testing.T) {
	handler := testServer(t)
	body := `{"title":"x","document":{"schemaVersion":1}}`

	missingType := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(body))
	missingTypeResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingTypeResponse, missingType)
	if missingTypeResponse.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("missing content type = %d", missingTypeResponse.Code)
	}

	wrongType := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(body))
	wrongType.Header.Set("Content-Type", "text/plain")
	wrongTypeResponse := httptest.NewRecorder()
	handler.ServeHTTP(wrongTypeResponse, wrongType)
	if wrongTypeResponse.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("wrong content type = %d", wrongTypeResponse.Code)
	}

	crossSite := httptest.NewRequest(http.MethodPost, "/api/projects", strings.NewReader(body))
	crossSite.Header.Set("Content-Type", "application/json; charset=utf-8")
	crossSite.Header.Set("Sec-Fetch-Site", "cross-site")
	crossSiteResponse := httptest.NewRecorder()
	handler.ServeHTTP(crossSiteResponse, crossSite)
	if crossSiteResponse.Code != http.StatusForbidden {
		t.Fatalf("cross-site mutation = %d", crossSiteResponse.Code)
	}

	health := request(t, handler, http.MethodGet, "/api/health", "")
	if health.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("cache header = %q", health.Header().Get("Cache-Control"))
	}
}
