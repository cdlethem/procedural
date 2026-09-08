# Current support without rewriting contracts

Root decision, independently challenged by Sol: publish current operation support through
checked validation attestations under `catalog/validation/`. An operation contract's
target status fields describe its historical contract-freeze state. They are not the
authority for current implementation, native integration or reproduction claims.

Changing such status fields has no mathematical effect, but changes the contract file's
hash and invalidates exact evidence bindings. Repeated metadata exceptions would obscure
which bytes were tested. Keep reviewed contracts and reports intact; let a new attestation
identify the immutable contract and the evidence supporting the current support claim.

There is one optional attestation file per operation, named after its contract file.
The catalog checker verifies operation identity/version/hash, known unique targets,
accepted root/Sol review identity, current implementation and evidence hashes, explicit
runtime/profile, and declared evidence predicates. A failed predicate, stale binding,
unsafe path or unaccepted review rejects publication. Evidence predicates are precise
checks on recorded JSON; they do not replace architectural review of whether a test
establishes the claimed capability.

Each target has separate core, native and technique dimensions. A package build is
installation evidence; it cannot substitute for native execution or visual inspection.
The status vocabulary is deliberately small:

- `unvalidated`, in any dimension: no positive support claim or supporting metadata.
- `conformant`, in the core dimension: the operation's shared fixtures and host checks
  passed for the identified implementation on the named execution runtime. An Android
  row may identify a shared Java implementation tested on a host JVM; it must say so
  explicitly and does not imply that every fixture ran on ART.
- `validated-scoped`, in native or technique: accepted execution or visual evidence
  supports the explicitly named example, runtime and profile. This is not full-corpus
  certification or permission to generalize to other renderers and devices.

Every positive dimension requires at least one checked evidence predicate and an
accepted review. Unknown status strings cannot be published.

An absent record means “not attested,” rather than importing optimistic or stale strings
from a contract. The generated reference consumes only checked attestations for its
current status table and links the reviewed scope.

The first records can use the accepted PathMarks composition for native/technique
integration of all four operations it actually uses: grid, field, palette and path.
That claim is specifically PathMarks on the recorded runtimes. Each operation also
requires its own pure conformance evidence. Existing CP1 and full-corpus evidence remain
separate scopes; neither is silently inferred from the new table.

The earlier grid/noise/palette pure reports predate two additive public export lines.
Their operation implementations are unchanged. Current entrypoint compatibility is
covered by the accepted supplemental export review and CP2 native examples; retain
both evidence layers instead of rewriting those historical pure reports.

This is catalog governance, not another public operation or duplicated control schema.
Future generated consumers must use the same checker and attestations for support
claims. Algorithm behavior, input schemas, fixtures and operation versions remain
defined by the existing contracts.

Root and Sol accepted the framework and the first four operation records after reviewing
all 48 evidence blocks. The reference was regenerated through the catalog checker;
catalog validation and all 97 unit tests passed. Tests cover stale bindings, unknown
statuses, missing predicates, strict JSON types and parsing, review identity and path
containment. This acceptance concerns evidence publication, not a new algorithm or
expanded runtime claim.
