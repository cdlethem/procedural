package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	defaultAddr := envOr("WEB_ADDR", "127.0.0.1:8080")
	defaultDataDir := envOr("WEB_DATA_DIR", ".work/web-projects")
	addr := flag.String("addr", defaultAddr, "listen address")
	dataDir := flag.String("data-dir", defaultDataDir, "directory for project JSON files")
	flag.Parse()

	store, err := NewStore(*dataDir)
	if err != nil {
		log.Fatalf("initialize project store: %v", err)
	}
	server := &http.Server{
		Addr:              *addr,
		Handler:           NewServer(store),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("web API listening on http://%s (projects: %s)", *addr, *dataDir)
	log.Fatal(server.ListenAndServe())
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
