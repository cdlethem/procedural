# Web deployment successor

Application ingress on ports 8443 and 8444 is offline during the multi-tenant cutover.
The private successor is [cdlethem/procedurals-web](https://github.com/cdlethem/procedurals-web).
Its deployment instructions and acceptance records own future releases. Do not restart
the shared-store app for visitors or apply the historical procedure below as a current runbook.

## Historical rollback deployment

Before containment, https://eunoia.tailf03dad.ts.net:8443/ served the established site. It served the completed
merged gallery/Studio redesign, 26 revised studies, five external studies and 50 default
palettes from `eb2bdfdc`, using the immutable checkout `.work/study-quality-release`.
Never edit or build inside the current release. The [quality release review](../evidence/web/creative-quality-live-release.json)
records the scoped checks and actual HTTPS verification. `.work/study-copy-release`
at `d76e204c` is the previous rollback release; its [review](../evidence/web/study-copy-live-release.json)
and the [restoration review](../evidence/web/completed-redesign-restoration.json) retain
the earlier recovery evidence.

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

Carry forward ignored `public/previews` assets and build with
`PROCEDURALS_API_URL=http://127.0.0.1:8088`. Check decoded gallery images and the
project service as well as scripts, page text and canvas readiness.
