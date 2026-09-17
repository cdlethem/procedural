# Current live web release

The established site is https://eunoia.tailf03dad.ts.net:8443/ . It serves the completed
merged gallery/Studio redesign plus five new studies and 50 default palettes from
`6d4759b8`, using the immutable checkout `.work/external-gallery-review`. Despite its
historical directory name, this checkout is now production: never edit or build inside it.
The [release review](../evidence/web/external-expansion-live-release.json) records actual
HTTPS browser checks; the [restoration review](../evidence/web/completed-redesign-restoration.json)
retains the earlier recovery evidence.

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
