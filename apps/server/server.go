package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	if !ok || strings.TrimSpace(string(version)) != "1" {
		return errors.New("document.schemaVersion must equal 1")
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
