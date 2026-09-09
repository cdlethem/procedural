# Bounded agent assignments

Read [AGENTS](../AGENTS.md) and [current state](../PROJECT_STATE.md) first. This document
is a task-brief template, not an execution queue. Use the current user assignment and
[roadmap](roadmap.md) to select work; completed milestone IDs do not schedule new tasks.

## Assignment template

| Field | Required content |
|---|---|
| Objective | One bounded result and explicit stopping condition |
| Inputs | Exact evidence/candidate identities, note hashes and approved contract version |
| Ownership | Files the worker may edit; integration-owned files it must leave alone |
| Behavior | Target, capabilities, input/output semantics, errors and unchanged tolerances |
| Validation | Existing commands and observable acceptance scenarios; state read-only limits |
| Handoff | Changes/findings, checks actually run, evidence paths and unresolved blockers |

Give only task-relevant context. Independent assignments need disjoint file ownership.
Workers resolve ordinary bugs; root decides API ambiguity and conflicting evidence.
Do not silently shrink an assignment to its first stage or call a prepared build validated.

## Roles

- **Root:** selects artist capabilities, reads decisive evidence, freezes contracts and
  reviews numerical/state/ownership risks, source, representative images and integration.
- **Luna:** focused evidence retrieval, documentation, routine fixes and existing runners.
- **Terra:** coherent implementation/example or packaging slices against frozen behavior,
  including first-pass debugging and actual assigned validation.
- **Independent architecture review:** optional when explicitly scheduled; no standing
  review gate. Root retains the final decision. Use the user's requested reviewer if assigned.

## Evidence proposal requirements

Provide exact candidate ID, name, signature and relevant parent-note passage. Describe the
computation's inputs, outputs, state, ordering and topology; distinguish every extracted
component from its composite consumer. Check adjacent ordinals to avoid mistaken identity.
Compare both sides of a proposed merge and identify the retained representative. Name
matches and broad scene descriptions do not establish computational equivalence.

Explain keep/merge/reject and remaining ingredients. Wrapper rejection is not ingredient
rejection; do not claim an ingredient is retained without its ledger identity. Unknown
records stay unknown. Root independently verifies decisive passages before accepting edits
to the authored ledger. Use the parameter-evidence skill for uncertain parameter choices.

## Implementation and handoff

Use catalog contracts and shared fixtures unchanged. Return ambiguities about defaults,
RNG consumption, ordering, numeric tolerances or capabilities to root. Review ownership,
allocation and failure semantics as well as fixture output; frozen wrappers alone do not
make backing storage immutable, and counts alone do not prove geometry equivalence.

Packaging changes must exercise the real build path in fresh ignored output when building
is within the assignment. Validate archive construction and extracted consumers, not just
syntax. Native runs use the machine lease specified in AGENTS. No worker may write root
acceptance records or mark shared support accepted. Return proposed evidence and limitations.

Report named scenarios and results, not loop-expanded assertion totals. Keep temporary
files under ignored `.work/`. Final handoff means the assigned deliverables are complete,
or identifies the concrete blocker and retained unfinished work without claiming acceptance.
