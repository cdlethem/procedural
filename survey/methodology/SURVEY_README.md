# genart-survey

Automated survey of the Processing sketches in `${PROCESSING_SKETCHES_ROOT}`: render each one headlessly
with a fixed seed, let a local LLM (omp + Qwen3.8-27B) look at the result, vary parameters, and write
structured notes. The notes feed the design of a reusable generative-art library.

- `tools/render.py SKETCH --out DIR [--sub 'OLD' 'NEW']` renders one sketch (copy + harness tab + jars, Xvfb, time budget).
- `tools/survey_all.py` mechanical baseline of every sketch -> `out/index.jsonl`, `out/catalog.md`.
- `tools/run_survey.sh` the LLM loop, one `omp -p` per sketch, resumable.
- `tools/aggregate.py` harvests `notes.md` frontmatter -> `out/survey.json` / `.csv`.
- `tools/fetch_libs.sh` downloads the third-party jars into `tools/libs/`.
- `PROMPT.md`, `AGENTS.md`, `NOTES_TEMPLATE.md`: what the model is told.

Outputs live in `out/<same relative path as the sketch>/{baseline,variants,notes.md}`. PNGs are gitignored.
