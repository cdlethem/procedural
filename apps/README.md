# Private application successor

The application source, tests and deployment tools moved to the private repository
[cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
Application development and current run instructions belong there. This public checkout
no longer contains `apps/web`, `apps/server` or the app-only render harness.

The public repository retains the MIT toolkit, editable native examples, contracts and
historical evidence. Private builds consume the immutable public
[`web-toolkit-v0.2.1` release](https://github.com/cdlethem/procedural/releases/tag/web-toolkit-v0.2.1),
not an adjacent public checkout. Build the public artifacts independently with:

```sh
node tools/build_web_toolkit.mjs --output .work/dist/web-toolkit
```

Published MIT source and its history remain public. The
[pre-extraction application guide](https://github.com/cdlethem/procedural/blob/ed02f698c9f97139be239a8e7b384ba1484359d1/apps/README.md)
and [historical architecture](../docs/web-app-architecture.md) describe the former
shared-store application, not a visitor-safe deployment. Legacy app ingress remains
offline during the multi-tenant migration; preserved stores are migration/rollback inputs.

Extraction does not itself establish tenant isolation, private workspaces or visitor-launch
acceptance. See [current project state](../PROJECT_STATE.md) for the active boundary.
