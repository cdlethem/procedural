# Current live web release

The established site is https://eunoia.tailf03dad.ts.net:8443/ . It serves the completed
merged gallery/Studio redesign from `f30c95b4`, using the immutable checkout
`.work/main-redesign-release-20260917`. The [restoration review](../evidence/web/completed-redesign-restoration.json)
records the build, source comparison and actual HTTPS browser checks.

The separate landing-page redesign is in progress. Its working checkout, preview server
and uncommitted files are not the completed-release baseline and must not be overwritten
or silently promoted when adding studies.

`procedurals-web.service` runs Next on127.0.0.1:3002; tailnet8443 proxies that port.
The authoritative persistent override is
`~/.config/systemd/user/procedurals-web.service.d/zzzzzzzz-current-release.conf`.
Older drop-ins remain historical and sort before it. The API stays on8088; named projects
and shared harness/palette/layer storage stay at their existing locations.

For each future study milestone, integrate the reviewed additions into current main without
replacing its UI. Build in a fresh isolated checkout, preserve persisted storage references,
check gallery/Studio behavior and native assets, then update the current-release override.
After restart, verify the actual8443 HTTPS URL, its styles/scripts, gallery, Studio and API.
A passing preview or a merged source commit alone does not update the established live site.
Never build inside the currently serving release or repoint8443 to an unrelated older checkout.
