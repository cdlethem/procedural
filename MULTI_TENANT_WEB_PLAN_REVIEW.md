# Fresh adversarial review: MULTI_TENANT_WEB_PLAN.md (680 lines)

Reviewed revision: `MULTI_TENANT_WEB_PLAN.md` at 680 lines, after the first review pass and its
resolutions. Companion document to the plan; not an acceptance record.

**Verdict:** the security design is now very strong and the factual grounding holds up under
re-checking. But the revision answered every prior criticism by *adding* requirements and never by
cutting scope, and it introduced three defects of its own — including one hard arithmetic
contradiction in the newly written clock section and one new "mitigation" that is TOCTOU-vulnerable
and will cause production outages during ordinary repo work.

## Blocking

**B1. Per-run budgets are now internally impossible — new, checkable, in the text added last revision.**
Line 441 sets `18 model turns, 3 renders, 2 repairs; total wall deadline 10 minutes; each upstream
call at most 90 seconds`. Line 367 clamps each render's lease wait (≤240 s) *and* attempt (≤120 s per
line 384) inside "their parent run's remaining execution time."

Arithmetic:

- 18 turns × 90 s = 1620 s against a 600 s wall.
- 3 renders × (lease wait + 120 s attempt) = up to 1080 s against the same 600 s wall.
- Guests: 6 turns + 2 renders in 300 s (line 413) — 2 × 120 s of attempt envelope alone is 240 s,
  leaving 60 s for six model turns.

Verified context: `loop.ts:116` `MAX_TURNS = 18` and `core.ts:58-59` (3 renders / 2 repairs) are real
and retained, but there is **no total run wall deadline and no per-upstream-call timeout in the
current code** — `model.ts:15,50` take an optional `signal` and set no timeout; `loop.ts:272` waits
`maxRenderSeconds + 300` = 330 s *per render*, so today's implicit budget for 3 renders alone is
990 s. So the 600 s wall and the 90 s call cap are **both new constraints**, and as written they
guarantee that any run exercising its stated allowance is killed. The word "Retain" in line 441 is
also wrong for the two numbers that are new.

Fix is one sentence plus one number, not new machinery: state that the wall deadline binds first and
the turn/render counts are ceilings, then set the wall from the gate's measured p95 (or raise to
~20 min for registered / keep 5 min for guests with 4 turns / 1 render). Make the timeout error say
which budget ended.

**B2. The wrapper "trust exception" added at line 391 is a worse control than the thing it replaced.**
Line 391: "record its reviewed hash and fail startup on unexpected changes," applied to
`/home/colin/dev/procedural/tools/with_native_render_lock.py` in a live git working tree.

- **TOCTOU:** the hash is checked at *startup*; the file is `exec`'d hundreds of times afterwards
  from an owner-writable directory. Anyone who can write that path gets code execution as the
  render-supervisor identity — which per line 498 is the only identity holding the rootless Docker
  socket. That is the sandbox-escape-equivalent, guarded by a startup-only check.
- **Operational:** any legitimate edit, `git pull`, or branch switch touching that file now fails
  render readiness in production. The plan simultaneously forbids weakening the renderer, so the
  failure mode is "generation down until someone re-pins."
- **The rejection reasoning is thin.** Line 389 concedes the wrapper's whole contract is "a
  non-reentrant nonblocking flock and process-group termination." AGENTS.md's rule is that every
  native render uses *the shared machine lease* and that checkout-local locks are subordinate. A
  private launcher taking `flock` on the identical absolute lock path uses that same lease and
  creates no second lease; it is substantively compliant while the current design is only textually
  compliant.

**Decision required** (rules interpretation is the maintainer's): (a) private launcher flocks
`/home/colin/dev/procedural/.work/native-render-machine.lock` directly — no script dependency, no
trust exception, container-aware termination in one place; or (b) keep the wrapper and accept a
startup-only integrity check on maintainer-writable code. Recommendation: (a), with the AGENTS.md
reading recorded explicitly.

**B3. The guardian has no self-deadline, and it can orphan the machine-wide lease.**
Line 390 requires a lease-holding guardian "outside the wrapper's killable child process group."
Mechanically that works — `flock` follows the open file description, and
`with_native_render_lock.py:32` passes the lease fd to its child, so a detached grandchild keeps the
lock after the wrapper exits. That is exactly the hazard: the wrapper returns, the supervisor sees
the attempt end, and a surviving guardian holds an exclusive machine-wide flock with **no stated
deadline of its own**. Every native render on the box — including the public repo's active
external-expansion checks — then fails with "Native renderer busy" until someone finds it. Line
390's remedy ("startup reconciliation removes labelled orphans") only runs at renderer startup and
targets containers, not the lock holder.

Required: an unconditional guardian hard deadline (≥ attempt envelope + grace) after which it
releases the lease and reports; plus an explicit statement that wrapper exit is *not* attempt
completion for the supervisor.

**B4. The plan's own preconditions now keep the insecure status quo alive indefinitely.**
Before ingress cutover the plan requires: rootless sandbox gate (44), off-host encrypted backup
destination + verified remote bytes + pre-cutover isolated restore (533-534), tombstone hash-chain
journal with off-host generation authority (535), real SMTP delivery evidence (543), capacity
alerting (427), published privacy/AUP notices (456), migration importer with dry-run/apply (464-485),
and relocation proof to S3 (538). Each individually blocks cutover. Meanwhile line 42 says "the
existing owner-only deployment remains available until final cutover" — i.e. the current
**unauthenticated** app on 8443→3002/8088 plus the 8444→3016 preview keeps serving the shared store
for as long as any one prerequisite is outstanding.

That inverts the security goal. Name a minimum cutover set (sandbox gate + tenancy + auth +
admission + migration + local-verified backup) and move quarterly restore drills, relocation proof,
legal copy and capacity alerting to post-cutover-but-pre-public-signup. The plan already has the
right gate for the thing that actually matters — `SIGNUP_ENABLED=false` — and should use it instead
of holding the whole cutover.

## Contradictions and defects introduced by the last revision

**C1. `session_assurances` (line 161) has no lifecycle.** It is keyed by auth session ID, in the app
schema, deliberately unable to FK across to Better Auth's session table (line 94 forbids cascade).
Nothing deletes rows when a session expires or is revoked. Two consequences: unbounded growth (≥1 row
per user per day, forever, alongside a policy that retains 10,000 guests), and a correctness risk — a
stale assurance row that outlives its session could satisfy the `freshAge` check at line 244/402 if a
session identifier is ever recreated. Add: resolve assurance only by (session id + stable user + that
session's own `createdAt`), and delete assurances older than the maximum session lifetime.
`provisioning_intents`/`provisioning_receipts` (line 160) have the same omission; `usage_buckets` got
30-day retention (423), so the inconsistency is visible within the plan.

**C2. `IDEMPOTENCY_DIGEST_KEY_FILE` (169, 519) is unnecessary complexity — added in the last
revision and wrong.** It adds a seventh mounted secret, a rotation constraint ("must preserve
comparison for live receipts"), and a new failure mode, to avoid storing a digest of a password. The
cheaper correct answer: **exclude the password from the canonical request digest** (digest over
scope + normalized email + name). Duplicate-submit detection doesn't need the password; a same-key
request with a different password is either the same completion (replay) or a 409, both already
specified. Delete the key and the config row.

**C3. `verify:stack --profile database` (559) has no invocation anywhere.** Line 97 mandates
delivering "the database/blob portion of `verify:stack`" first, but the only executable sequence
(574-590) uses the full `up`. Also from the last revision. Add the early command, or the step-2
checkpoint has no reproducible entrypoint — precisely the hole the plan refuses to tolerate
elsewhere.

**C4. Three competing orderings.** Numbered steps 1-9, the four "bounded integration checkpoints"
(42), and the production runbook order (541). A reader has to reconcile them, and line 40's prose
adds a fourth partial order ("start step 2 with…, implement step 7's admission primitives
alongside…"). Pick one authoritative sequence and make the others explicit views of it.

**C5. Acceptance records bind hashes of files that are gitignored.** Line 84 requires records
"binding … screenshot hashes"; line 643 requires personally inspecting screenshots that "stay
private/ignored." After `.work` cleanup nobody — including the maintainer — can re-verify the
binding. Either archive the screenshot set to a durable private location referenced by digest, or
bind only durable artifacts and describe the visual inspection in prose.

## Substantive gaps still open

**G1. Guest runs admitted just before the 24-hour deadline are guaranteed orphans.** Line 340 keeps
durable runs alive across session loss; line 364 forbids reclassifying a guest run when "its browser
session expired." So a run admitted at 23:58 spends the global guest trial budget and the single
render lane to produce content the owner can never see, and writes blobs into the non-evictable
10 GiB pool (452). One-sentence fix: refuse admission when
`now + max run wall > anonymous_access_expires_at`.

**G2. The capacity terminal state is documented and then declined.** Lines 425-427 compute the
exhaustion (20 daily quotas to 10,000 guests; 320 full guests to 10 GiB), then state that reclaiming
expired users "requires a separately authorized retention-policy change; this plan does not
implement it." So the plan ships a known permanent-denial state for *humans* with no implemented
remedy. Line 425's justification is circular: "no automatic reclamation loophole for an expired
'empty' account, because every successful bootstrap owns a draft/context" — but the plan itself
provisions that blank draft at bootstrap (327). **Decision required:** mark the bootstrap-provisioned
context `pristine` and make expired guests with zero user edits reclaimable. That deletes no
user-authored byte, so it does not breach "no automatic deletion of saved work," and it converts the
terminal state into a bounded one.

**G3. Daily render ceilings exceed one lane's physical capacity.** 200 guest + 300/account registered
attempts/day (417, 440) against 1 dispatch lane (439) with up to a 120 s envelope plus grace
≈ ≥16.7 lease-hours/day of demand from the ceilings alone, before the public repo's active native
checks contend for the same flock. Line 370 concedes "ceilings, not a throughput promise," which
means the numbers in the tables aren't limits, they're decoration. Derive the daily caps from the
gate's measured p95 hold × target utilisation, or explicitly mark them placeholders pending that
measurement.

**G4. Playwright's documented `--ipc=host` recommendation conflicts with the chosen profile, and the
gate doesn't call it out.** The Docker page states verbatim: "Using `--ipc=host` is recommended when
using Chromium. Without it, Chromium can run out of memory and crash." The plan forbids host IPC and
substitutes private 64 MiB shared memory (380). That is the right security call, but it is a
known-risky interaction and the gate (44) lists sandbox/namespace/cgroup checks without naming it.
Add it: prove repeated 640×640 renders under 64 MiB `/dev/shm` without renderer crashes, and record
the shm headroom actually used.

**G5. Better Auth IP derivation is unspecified while the plan depends on it.** Line 212 says "Ingress
overwrites trusted client-address headers," but never configures `advanced.ipAddress.ipAddressHeaders`
or `trustedProxies`. Better Auth's default is `x-forwarded-for`, and its own docs warn that behind a
proxy you must either point at a single trusted header or enumerate proxies. With Caddy in front
(499), leaving this at default makes the library limiter's bucket key depend on an unpinned header
contract. One line: name the header Caddy sets and set it in config. (Its default `/64` IPv6
bucketing already matches line 416 — good.)

**G6. No Range support breaks the 2 GiB account export.** Line 179 declares byte ranges unnecessary
and line 621 tests that authorized Range requests get a full 200. But account archives are capped at
2 GiB (352) with a 24-hour expiry. A download failing at 90% restarts from zero. Ranges matter in
exactly one place; grant authenticated Range for export/archive downloads and add
`get(key, range?)` — the interface economy isn't worth the user-visible failure.

**G7. The ten-function SQL boundary still costs more than it buys — and line 133 now says so.**
Line 132 freezes an inventory of ~10 definer functions (claim/heartbeat/finish/cancel, read inputs,
read admitted credential version, reserve/record attempts, publish run step/candidate/render result,
plus mail/export/purge/GC) — a second data-access layer in PL/pgSQL, duplicating logic behind the
same `Principal`-first signatures mandated at line 183. Line 133 then concedes that a compromised
coordinator "can expose plaintext/ciphertext for valid tasks it can claim, including successive
claims," and that it holds the vault key. Given that concession, a single
`assert_lease(task, token, epoch) → owner` function plus `set_config('app.owner_id', owner, true)`
inside the same transaction yields materially the same residual risk with one implementation instead
of two. Keep RLS as defense-in-depth. If the ten functions stay, state the added implementation cost
so it is a chosen trade, not an invisible one.

**G8. Derived cost of the 24-hour registered session is now a whole subsystem.** `expiresIn:86400` +
`disableSessionRefresh:true` + `freshAge:300` (223) means admins re-authenticate with password+TOTP
daily and re-authenticate again for any settings change. The revision added the same-user
reauthentication buffer (343) and its own acceptance scenario (623) solely to keep that from
destroying unsaved canvas work. That machinery exists only to absorb a self-imposed constraint. The
24-hour maximum is a confirmed maintainer requirement and is not overridden here — but the cheaper
shape is: keep the hard 24 h for **anonymous** sessions, allow registered sessions a normal refresh
with idle timeout, and set `freshAge` to 15-30 minutes. That deletes the buffer subsystem and one
acceptance scenario.

## Product limits worth confirming rather than discovering later

- **Port 443 only** (302) blocks legitimate self-hosted gateways on e.g. `:8443`, with no user-side
  workaround — only an operator endpoint registration. Deliberate?
- **Post-signup generation loss** is now disclosed in the UI (307) rather than resolved. Correct
  handling of a bad incentive, but it remains: the conversion CTA moves a user from *can generate* to
  *must supply an API key*.

## Recommendation

1. Fix B1 (one sentence + one number) and C2/C3 (delete a secret, add a command) immediately — all
   three are text-only.
2. Resolve B2/B3 together: private launcher flocks the shared lock path, guardian gets a hard
   deadline, wrapper exit ≠ attempt end. This is the highest-risk area and the one where the current
   text is actively harmful.
3. Decide G2 (`pristine` reclamation) and G8 (registered session refresh) explicitly — both are
   policy calls and both remove machinery.
4. Split the cutover gate per B4 so the unauthenticated 3002/3016 surfaces come down as soon as
   tenancy + auth + migration + sandbox pass, with `SIGNUP_ENABLED=false` carrying the remaining
   risk.
5. Add G1, G4, G5 as one line each.

## Verification basis

Everything re-checked in this pass held: `loop.ts:116`, `core.ts:58-59`, `model.ts:15,50`,
`with_native_render_lock.py:32`, `queue_render.py:166`, Better Auth's PostgreSQL
`schemaName`/`search_path` guidance, `rateLimit.customStorage.consume`, and the Playwright
`--ipc=host` text. The plan's factual grounding is not the problem; its size and two of its newest
paragraphs are.

Read-only review: no services, renders, installations or plan edits were performed for this pass.
