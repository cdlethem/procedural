# Procedural Studio API

This is a small local-only Go API for the web studio. It stores each project as an atomic
JSON file and does not interpret or execute project documents.

Build and start it from the repository root:

```sh
go -C apps/server build -o ../../.work/procedural-studio-api .
.work/procedural-studio-api
```

It listens on `127.0.0.1:8080` and writes project files to `.work/web-projects`. Configure
those values with `-addr`, `-data-dir`, or the `WEB_ADDR` and `WEB_DATA_DIR` environment
variables:

```sh
go -C apps/server build -o ../../.work/procedural-studio-api .
.work/procedural-studio-api -addr 127.0.0.1:8081 -data-dir /tmp/procedural-projects
```

The API is intended to sit behind the same-origin web-app proxy. It deliberately sends no
permissive CORS headers.

`document` is opaque JSON studio data, but must be a JSON object with `"schemaVersion": 1`.
Request bodies are limited to 1 MB and the store holds up to 200 projects.

```sh
cd apps/server && go test ./...
```
