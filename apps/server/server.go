package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	maxRequestBytes = 1 << 20
	maxProjects     = 200
)

var safeID = regexp.MustCompile(`^[a-f0-9]{64}$`)

type Project struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Document  json.RawMessage `json:"document"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

type projectSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Store struct {
	dir string
	mu  sync.RWMutex
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0750); err != nil {
		return nil, err
	}
	return &Store{dir: dir}, nil
}

func (s *Store) path(id string) string { return filepath.Join(s.dir, id+".json") }

func (s *Store) create(title string, document json.RawMessage) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := s.projectFiles()
	if err != nil {
		return Project{}, err
	}
	if len(entries) >= maxProjects {
		return Project{}, errStoreFull
	}
	for attempt := 0; attempt < 3; attempt++ {
		id, err := newID()
		if err != nil {
			return Project{}, err
		}
		project := Project{ID: id, Title: title, Document: document, UpdatedAt: time.Now().UTC()}
		if _, err := os.Stat(s.path(id)); errors.Is(err, os.ErrNotExist) {
			return project, s.write(project)
		} else if err != nil {
			return Project{}, err
		}
	}
	return Project{}, errors.New("could not allocate project ID")
}

func (s *Store) get(id string) (Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.read(id)
}

func (s *Store) update(id, title string, document json.RawMessage) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.read(id); err != nil {
		return Project{}, err
	}
	project := Project{ID: id, Title: title, Document: document, UpdatedAt: time.Now().UTC()}
	return project, s.write(project)
}

func (s *Store) delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.read(id); err != nil {
		return err
	}
	return os.Remove(s.path(id))
}

func (s *Store) list() ([]projectSummary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	files, err := s.projectFiles()
	if err != nil {
		return nil, err
	}
	projects := make([]projectSummary, 0, len(files))
	for _, file := range files {
		project, err := s.read(strings.TrimSuffix(file.Name(), ".json"))
		if err != nil {
			return nil, err
		}
		projects = append(projects, projectSummary{ID: project.ID, Title: project.Title, UpdatedAt: project.UpdatedAt})
	}
	sort.Slice(projects, func(i, j int) bool { return projects[i].UpdatedAt.After(projects[j].UpdatedAt) })
	return projects, nil
}

func (s *Store) projectFiles() ([]os.DirEntry, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	files := make([]os.DirEntry, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") && safeID.MatchString(strings.TrimSuffix(entry.Name(), ".json")) {
			files = append(files, entry)
		}
	}
	return files, nil
}

func (s *Store) read(id string) (Project, error) {
	contents, err := os.ReadFile(s.path(id))
	if err != nil {
		return Project{}, err
	}
	var project Project
	if err := json.Unmarshal(contents, &project); err != nil {
		return Project{}, fmt.Errorf("read project %s: %w", id, err)
	}
	if project.ID != id {
		return Project{}, fmt.Errorf("read project %s: ID mismatch", id)
	}
	return project, nil
}

func (s *Store) write(project Project) error {
	contents, err := json.Marshal(project)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(s.dir, ".project-*.tmp")
	if err != nil {
		return err
	}
	tempName := temp.Name()
	defer os.Remove(tempName)
	if err := temp.Chmod(0600); err != nil {
		temp.Close()
		return err
	}
	if _, err := temp.Write(contents); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(tempName, s.path(project.ID))
}

func newID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

var errStoreFull = errors.New("project store limit reached")

type API struct{ store *Store }

func NewServer(store *Store) http.Handler { return API{store: store} }

func (api API) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.URL.Path == "/api/health" {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	if r.URL.Path == "/api/projects" {
		api.projects(w, r)
		return
	}
	const prefix = "/api/projects/"
	if strings.HasPrefix(r.URL.Path, prefix) {
		id := strings.TrimPrefix(r.URL.Path, prefix)
		if !safeID.MatchString(id) || strings.Contains(id, "/") {
			writeError(w, http.StatusNotFound, "not_found", "project not found")
			return
		}
		api.project(w, r, id)
		return
	}
	writeError(w, http.StatusNotFound, "not_found", "route not found")
}

func (api API) projects(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		projects, err := api.store.list()
		if err != nil {
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
	case http.MethodPost:
		if !allowMutation(w, r) {
			return
		}
		title, document, ok := decodeProjectInput(w, r)
		if !ok {
			return
		}
		project, err := api.store.create(title, document)
		if err != nil {
			writeStoreError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, project)
	default:
		methodNotAllowed(w, http.MethodGet+", "+http.MethodPost)
	}
}

func (api API) project(w http.ResponseWriter, r *http.Request, id string) {
	switch r.Method {
	case http.MethodGet:
		project, err := api.store.get(id)
		if err != nil {
			writeProjectReadError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, project)
	case http.MethodPut:
		if !allowMutation(w, r) {
			return
		}
		title, document, ok := decodeProjectInput(w, r)
		if !ok {
			return
		}
		project, err := api.store.update(id, title, document)
		if err != nil {
			writeProjectReadError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, project)
	case http.MethodDelete:
		if !allowSameSiteMutation(w, r) {
			return
		}
		if err := api.store.delete(id); err != nil {
			writeProjectReadError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		methodNotAllowed(w, http.MethodGet+", "+http.MethodPut+", "+http.MethodDelete)
	}
}

func decodeProjectInput(w http.ResponseWriter, r *http.Request) (string, json.RawMessage, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	defer r.Body.Close()
	var input map[string]json.RawMessage
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&input); err != nil {
		writeInputError(w, err)
		return "", nil, false
	}
	if err := requireEOF(decoder); err != nil {
		writeInputError(w, err)
		return "", nil, false
	}
	if len(input) != 2 || input["title"] == nil || input["document"] == nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "request must contain only title and document")
		return "", nil, false
	}
	var title string
	if err := json.Unmarshal(input["title"], &title); err != nil || !validTitle(title) {
		writeError(w, http.StatusBadRequest, "invalid_title", "title must contain 1 to 120 characters")
		return "", nil, false
	}
	if err := validDocument(input["document"]); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_document", err.Error())
		return "", nil, false
	}
	return title, input["document"], true
}

func requireEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err == nil {
		return errors.New("request must contain one JSON value")
	} else if err != io.EOF {
		return err
	}
	return nil
}

func allowMutation(w http.ResponseWriter, r *http.Request) bool {
	if !allowSameSiteMutation(w, r) {
		return false
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || !strings.EqualFold(mediaType, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "unsupported_media_type", "Content-Type must be application/json")
		return false
	}
	return true
}

func allowSameSiteMutation(w http.ResponseWriter, r *http.Request) bool {
	if strings.EqualFold(r.Header.Get("Sec-Fetch-Site"), "cross-site") {
		writeError(w, http.StatusForbidden, "cross_site_request", "cross-site mutations are not allowed")
		return false
	}
	return true
}

func validTitle(title string) bool {
	return utf8.RuneCountInString(title) >= 1 && utf8.RuneCountInString(title) <= 120
}

func validDocument(document json.RawMessage) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(document, &fields); err != nil || fields == nil {
		return errors.New("document must be a JSON object")
	}
	version, ok := fields["schemaVersion"]
	if !ok {
		return errors.New("document.schemaVersion must equal 1 or 2")
	}
	switch strings.TrimSpace(string(version)) {
	case "1":
		// Exact studio-v1/v2/v3 semantics remain the browser's migration boundary.
		return nil
	case "2":
		binding, ok := fields["bindingVersion"]
		if !ok || strings.Trim(string(binding), `"`) != "harness-v1" {
			return errors.New("document schemaVersion 2 requires bindingVersion harness-v1")
		}
		return validHarnessDocument(document)
	default:
		return errors.New("document.schemaVersion must equal 1 or 2")
	}
}

const (
	maxHarnessLayers   = 8
	maxHarnessControls = 24
	maxHarnessTick     = 600
)

var (
	harnessHash       = regexp.MustCompile(`^[0-9a-f]{64}$`)
	harnessLayerID    = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
	harnessControlKey = regexp.MustCompile(`^[a-z][A-Za-z0-9]{0,31}$`)
	harnessEntrypoint = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,63}\.(js|pde)$`)
	harnessText       = regexp.MustCompile(`^[\x20-\x7e]{1,64}$`)
	harnessColour     = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

// validHarnessDocument mirrors the harness-v1 envelope's structural boundary. It does
// not resolve artifact hashes, run source, or duplicate the browser's catalog registry.
func validHarnessDocument(document json.RawMessage) error {
	var value any
	if err := json.Unmarshal(document, &value); err != nil {
		return errors.New("document must be valid JSON")
	}
	root, err := harnessObject(value, "document", []string{"schemaVersion", "bindingVersion", "catalogSha256", "width", "height", "background", "layers"})
	if err != nil {
		return err
	}
	if root["schemaVersion"] != float64(2) || root["bindingVersion"] != "harness-v1" {
		return errors.New("harness document must use schemaVersion 2 and bindingVersion harness-v1")
	}
	if digest, ok := root["catalogSha256"].(string); !ok || !harnessHash.MatchString(digest) {
		return errors.New("document.catalogSha256 must be a sha256 content hash")
	}
	if root["width"] != float64(640) || root["height"] != float64(640) {
		return errors.New("document canvas must be 640 by 640")
	}
	if background, ok := root["background"].(string); !ok || !harnessColour.MatchString(background) {
		return errors.New("document.background must be an opaque RGB colour")
	}
	layers, ok := root["layers"].([]any)
	if !ok || len(layers) > maxHarnessLayers {
		return fmt.Errorf("document.layers must be an array of at most %d layers", maxHarnessLayers)
	}
	ids := map[string]bool{}
	for index, layer := range layers {
		if err := validHarnessLayer(layer, fmt.Sprintf("document.layers[%d]", index), ids); err != nil {
			return err
		}
	}
	return nil
}

func harnessObject(value any, path string, keys []string) (map[string]any, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an object", path)
	}
	if len(object) != len(keys) {
		return nil, fmt.Errorf("%s has missing or unknown keys", path)
	}
	for _, key := range keys {
		if _, ok := object[key]; !ok {
			return nil, fmt.Errorf("%s is missing %s", path, key)
		}
	}
	return object, nil
}

func harnessFinite(value any) (float64, bool) {
	number, ok := value.(float64)
	return number, ok && !math.IsInf(number, 0) && !math.IsNaN(number)
}

func harnessUint32(value any) bool {
	number, ok := harnessFinite(value)
	return ok && number == math.Trunc(number) && number >= 0 && number <= 4294967295
}

func harnessSafeInteger(value any) bool {
	number, ok := harnessFinite(value)
	return ok && number == math.Trunc(number) && number >= 0 && number <= 9007199254740991
}

func validHarnessLayer(value any, path string, ids map[string]bool) error {
	layer, err := harnessObject(value, path, []string{"id", "kind", "visible", "opacity", "content"})
	if err != nil {
		return err
	}
	id, ok := layer["id"].(string)
	if !ok || !harnessLayerID.MatchString(id) || ids[id] {
		return fmt.Errorf("%s.id must be a unique layer ID", path)
	}
	ids[id] = true
	if _, ok := layer["visible"].(bool); !ok {
		return fmt.Errorf("%s.visible must be true or false", path)
	}
	opacity, ok := harnessFinite(layer["opacity"])
	if !ok || opacity < 0 || opacity > 1 {
		return fmt.Errorf("%s.opacity must be between 0 and 1", path)
	}
	switch layer["kind"] {
	case "workflow":
		return validHarnessWorkflow(layer["content"], path+".content")
	case "source":
		return validHarnessSource(layer["content"], path+".content")
	case "recipe":
		return validHarnessRecipe(layer["content"], path+".content")
	default:
		return fmt.Errorf("%s.kind must be workflow, source or recipe", path)
	}
}

func validHarnessWorkflow(value any, path string) error {
	content, err := harnessObject(value, path, []string{"technique", "seed", "palette", "cutEdits", "transform", "params"})
	if err != nil {
		return err
	}
	if technique, ok := content["technique"].(string); !ok || !harnessText.MatchString(technique) {
		return fmt.Errorf("%s.technique must be a printable technique ID", path)
	}
	if !harnessUint32(content["seed"]) {
		return fmt.Errorf("%s.seed must be a uint32", path)
	}
	palette, ok := content["palette"].([]any)
	if !ok || len(palette) < 2 || len(palette) > 12 {
		return fmt.Errorf("%s.palette must contain 2 to 12 RGB colours", path)
	}
	for _, colour := range palette {
		number, ok := harnessFinite(colour)
		if !ok || number != math.Trunc(number) || number < 0 || number > 0xffffff {
			return fmt.Errorf("%s.palette must contain RGB colours", path)
		}
	}
	if err := validHarnessCutEdits(content["cutEdits"], path+".cutEdits"); err != nil {
		return err
	}
	if err := validHarnessTransform(content["transform"], path+".transform"); err != nil {
		return err
	}
	return validHarnessWorkflowParams(content["params"], path+".params")
}

// Workflow parameter names and ranges belong to the app registry. Unlike declared source
// controls, a workflow parameter object has no generic count or identifier limit here.
func validHarnessWorkflowParams(value any, path string) error {
	params, ok := value.(map[string]any)
	if !ok {
		return fmt.Errorf("%s must be an object", path)
	}
	for key, item := range params {
		switch item := item.(type) {
		case bool, string:
		case float64:
			if _, ok := harnessFinite(item); !ok {
				return fmt.Errorf("%s.%s must be finite", path, key)
			}
		default:
			return fmt.Errorf("%s.%s must be a number, string or boolean", path, key)
		}
	}
	return nil
}

func validHarnessCutEdits(value any, path string) error {
	edits, ok := value.([]any)
	if !ok || len(edits) > 64 {
		return fmt.Errorf("%s must contain at most 64 edits", path)
	}
	for index, value := range edits {
		editPath := fmt.Sprintf("%s[%d]", path, index)
		edit, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("%s must be an object", editPath)
		}
		kind, _ := edit["kind"].(string)
		if kind == "cut" {
			if len(edit) != 4 || (edit["axis"] != "X" && edit["axis"] != "Y") || !harnessSafeInteger(edit["id"]) {
				return fmt.Errorf("%s must be a cut edit", editPath)
			}
			if _, ok := harnessFinite(edit["coordinate"]); !ok {
				return fmt.Errorf("%s.coordinate must be finite", editPath)
			}
		} else if kind == "remove" {
			if len(edit) != 2 || !harnessSafeInteger(edit["id"]) {
				return fmt.Errorf("%s must be a remove edit", editPath)
			}
		} else {
			return fmt.Errorf("%s.kind must be cut or remove", editPath)
		}
	}
	return nil
}

func validHarnessTransform(value any, path string) error {
	transform, err := harnessObject(value, path, []string{"x", "y", "scale", "rotation"})
	if err != nil {
		return err
	}
	x, xOK := harnessFinite(transform["x"])
	y, yOK := harnessFinite(transform["y"])
	scale, scaleOK := harnessFinite(transform["scale"])
	rotation, rotationOK := harnessFinite(transform["rotation"])
	if !xOK || !yOK || !scaleOK || !rotationOK || x < -640 || x > 1280 || y < -640 || y > 1280 || scale < .05 || scale > 4 || rotation < -180 || rotation > 180 {
		return fmt.Errorf("%s has invalid placement", path)
	}
	return nil
}

func validHarnessControls(value any, path string) error {
	controls, ok := value.(map[string]any)
	if !ok || len(controls) > maxHarnessControls {
		return fmt.Errorf("%s must contain at most %d controls", path, maxHarnessControls)
	}
	for key, item := range controls {
		if !harnessControlKey.MatchString(key) {
			return fmt.Errorf("%s has an unusable control name: %s", path, key)
		}
		switch item := item.(type) {
		case bool:
		case string:
			if !harnessText.MatchString(item) {
				return fmt.Errorf("%s.%s must be printable ASCII", path, key)
			}
		default:
			if _, ok := harnessFinite(item); !ok {
				return fmt.Errorf("%s.%s must be a number, string or boolean", path, key)
			}
		}
	}
	return nil
}

func validHarnessSource(value any, path string) error {
	content, err := harnessObject(value, path, []string{"language", "sourceArtifactHash", "previewArtifactHash", "runnerProfile", "entrypoint", "background", "randomSeed", "noiseSeed", "tick", "controls"})
	if err != nil {
		return err
	}
	language, _ := content["language"].(string)
	profile, _ := content["runnerProfile"].(string)
	entrypoint, _ := content["entrypoint"].(string)
	if (language != "p5js" && language != "processing-java") ||
		(language == "p5js" && profile != "p5-static-640-v1") ||
		(language == "processing-java" && profile != "java2d-static-640-v1") ||
		!harnessEntrypoint.MatchString(entrypoint) ||
		(language == "p5js" && !strings.HasSuffix(entrypoint, ".js")) ||
		(language == "processing-java" && !strings.HasSuffix(entrypoint, ".pde")) {
		return fmt.Errorf("%s has an unsupported source profile", path)
	}
	if source, ok := content["sourceArtifactHash"].(string); !ok || !harnessHash.MatchString(source) {
		return fmt.Errorf("%s.sourceArtifactHash must be a sha256 content hash", path)
	}
	if preview := content["previewArtifactHash"]; preview != nil {
		if value, ok := preview.(string); !ok || !harnessHash.MatchString(value) {
			return fmt.Errorf("%s.previewArtifactHash must be a sha256 content hash or null", path)
		}
	}
	if content["background"] != "transparent" && content["background"] != "opaque" {
		return fmt.Errorf("%s.background must be transparent or opaque", path)
	}
	if !harnessUint32(content["randomSeed"]) || !harnessUint32(content["noiseSeed"]) {
		return fmt.Errorf("%s seeds must be uint32", path)
	}
	tick, ok := harnessFinite(content["tick"])
	if !ok || tick != math.Trunc(tick) || tick < 1 || tick > maxHarnessTick {
		return fmt.Errorf("%s.tick must be an integer from 1 to %d", path, maxHarnessTick)
	}
	return validHarnessControls(content["controls"], path+".controls")
}

func validHarnessRecipe(value any, path string) error {
	content, err := harnessObject(value, path, []string{"recipeArtifactHash", "executorProfile"})
	if err != nil {
		return err
	}
	if hash, ok := content["recipeArtifactHash"].(string); !ok || !harnessHash.MatchString(hash) {
		return fmt.Errorf("%s.recipeArtifactHash must be a sha256 content hash", path)
	}
	if profile, ok := content["executorProfile"].(string); !ok || !harnessText.MatchString(profile) {
		return fmt.Errorf("%s.executorProfile must be a printable profile name", path)
	}
	return nil
}

func writeInputError(w http.ResponseWriter, err error) {
	if errors.As(err, new(*http.MaxBytesError)) {
		writeError(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body exceeds 1 MB")
		return
	}
	writeError(w, http.StatusBadRequest, "invalid_json", "request body must be valid JSON")
}

func writeProjectReadError(w http.ResponseWriter, err error) {
	if errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusNotFound, "not_found", "project not found")
		return
	}
	writeStoreError(w, err)
}

func writeStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, errStoreFull) {
		writeError(w, http.StatusConflict, "project_limit", "project store limit reached")
		return
	}
	writeError(w, http.StatusInternalServerError, "storage_error", "could not access project storage")
}

func methodNotAllowed(w http.ResponseWriter, allowed string) {
	w.Header().Set("Allow", allowed)
	writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
