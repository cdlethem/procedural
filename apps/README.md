# Private application successor

The application source, tests and deployment tools moved to the private repository
[cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
Application development and current run instructions belong there. This public checkout
no longer contains `apps/web`, `apps/server` or the app-only render harness.

The public repository owns the MIT operation library, reusable p5.js instruments,
editable native examples, contracts and historical evidence. The
[`web-toolkit-v0.2.2` baseline](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.2)
packages `@procedurals/javascript`, `@procedurals/instruments` and
`@procedurals/catalog`. Private builds consume those immutable release assets,
not an adjacent checkout or app-local copies of the drawing library.

The [instrument package guide](../packages/instruments/README.md) documents installation,
the caller-owned p5 lifecycle, controls, preparation and reproducible artifact builds.
The app owns its interface, composition documents, persistence and deployment.

Published MIT source and its history remain public. The
[pre-extraction application guide](https://github.com/cdlethem/procedural/blob/ed02f698c9f97139be239a8e7b384ba1484359d1/apps/README.md)
and [historical architecture](../docs/web-app-architecture.md) describe the former
shared-store application, not a visitor-safe deployment. Historical app ingress remains
offline during the multi-tenant migration. Saved Studio artwork is disposable, not a
compatibility requirement for the instrument library.

Extraction does not itself establish tenant isolation, private workspaces or visitor-launch
acceptance. See [current project state](../PROJECT_STATE.md) for the active boundary.
