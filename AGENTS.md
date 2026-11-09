# AGENTS.md

## Project Scope

This repository is for semi-automated extraction of structured evidence from Doc Analyzer chats and for filling the workbook:

- `datasheet 20_to_fill.xlsx` as the working file
- `datasheet 20_original.xlsx` as the untouched structural reference

The goal is to complete the 20 review questions already represented in the workbook columns. Do not create alternative tracking workbooks such as `matriz.xlsx` for the main workflow unless the user explicitly asks for one.

## Core Operating Mode

When the user says:

- `Sigamos llenando el datasheet`

that must be interpreted as a workflow trigger with the following meaning:

1. Open `datasheet 20_to_fill.xlsx`.
2. Inspect progress and identify the next row(s) that still need completion.
3. Use the value in the `Title` column as the primary key to find the matching article in Doc Analyzer exports.
4. Export chats if needed.
5. Match the article against Doc Analyzer data.
6. Read the full matched conversation, not just one answer.
7. Review `document insight` / document details as additional context.
8. Fill only the existing workbook columns for that row.
9. Preserve workbook structure and formatting.
10. Stop and tell the user if that article has not yet been worked in Doc Analyzer or if there is no reliable match.

## Project Guides

This project does not use reusable global Codex skills for the Doc Analyzer workflows.

Treat the local files in `project-guides/` as project-specific operating guides. Read them when the request matches their scope, but do not treat them as globally invocable `$skill`s.

Available guides:

- `project-guides/doc-analyzer-login.md`
  Use when the task requires signing into `docanalyzer.ai`, checking whether the saved session is still valid, or refreshing the session automatically before other automation.

- `project-guides/doc-analyzer-chat-extraction.md`
  Use when the task requires finding existing chats for one or more articles/documents, exporting chat data, matching chats to requested articles, and writing one Markdown file per article in `extracted_data/`.

## Required Workflow

### 1. Authentication and export

- Prefer the scripts already present in `scripts/` over rebuilding the logic inline.
- Use `scripts/doc-analyzer-login.js` for session creation or refresh.
- Use `scripts/doc-analyzer-export-chats.js` to export chats before analyzing or writing article outputs.
- If the export script detects an expired or missing session, allow it to trigger reauthentication automatically.

### 2. Article matching

For each datasheet row:

- Use `Title` as the primary search key.
- Match requested articles against:
  - `thread.title`
  - `documents[].name`
  - `documents[].filename`
  - `queries[].prompt`
  - `queries[].answer`
- Prefer exact or near-exact matches on document name.
- Use thread title as a secondary signal.
- Use prompt and answer content only as a fallback signal.
- Do not merge unrelated chats because of vague thread names.
- If multiple chats clearly belong to the same article, consolidate them.
- If no reliable match exists, do not invent content.

### 3. Depth of review

When filling a row, do all of the following:

- Read the complete matched chat history for that article.
- Review exclusion screening content if present.
- Review all structured extraction answers if present.
- Review `document insight`, including title, summary, authors, sections, and other document details.
- Detect inconsistencies across answers and prefer the most defensible synthesis.
- If a value seems contradictory across chat responses, note the issue in the appropriate workbook cell in concise prose rather than fabricating certainty.

### 4. Research posture

Operate as a careful researcher and strong synthesis writer:

- Write in Spanish unless the workbook already dictates another language.
- Be descriptively concise, but do not strip out relevant nuance.
- Do not invent information not present in the exported chat or document details.
- If a category does not apply, say so clearly.
- If the article offers indirect but useful information for propagation, nursery design, establishment, or wetland restoration, include it in the most appropriate category.
- Distinguish clearly between:
  - direct propagation evidence
  - indirect restoration relevance
  - purely contextual information

## Datasheet Files

### Working file

- Always write to `datasheet 20_to_fill.xlsx`.

### Reference file

- Use `datasheet 20_original.xlsx` only to verify structure, formatting, or original contents.
- Do not overwrite `datasheet 20_original.xlsx`.

### Preservation rules

- Preserve existing formatting and column order.
- Do not add columns.
- Do not add auxiliary sheets unless the user explicitly asks for them.
- Do not replace filled cells unless the user asks for revision or the existing value is clearly wrong and can be corrected from stronger evidence.

## Datasheet Structure

The active header row is row 2 in `Hoja2`.

Operational columns:

- Column B: `Title`
- Column C: `Título`
- Column D: `Recolección de información (screen def)`
- Columns E to X: structured extraction fields for the review

The workbook currently uses the following review categories:

1. `Año de publicación y evolución temporal`
2. `2. País – región geográfica`
3. `3. Zona climática`
4. `4. Tipo de estrategia de conservación`
5. `5. Tipo de ecosistema acuático`
6. `6. Condiciones ambientales del estudio`
7. `7. Selección de especies`
8. `8. Biotipo o hábito de crecimiento`
9. `9. ¿Se realizó propagación?`
10. `10. Tipo de propagación`
11. `11. Condición de propagación`
12. `12. Diseño de la propagación`
13. `13. Diseño y estructura del vivero (si aplica)`
14. `14. Sustratos utilizados`
15. `15. Tratamientos pregerminativos`
16. `16. Variables ambientales y físico-químicas analizadas`
17. `17. Indicadores de éxito en la propagación o restauración ecológica de humedales`
18. `18. Aportes para la conservación`
19. `19. Limitaciones reportadas en el ejercicio de propagación, restauración ecológica y monitoreo`
20. `20. Estrategias de establecimiento y reintroducción de las plantas acuáticas propagadas`

Fill only those columns.

## How To Decide Where To Continue

When the trigger is `Sigamos llenando el datasheet`:

- Start from `datasheet 20_to_fill.xlsx`.
- Identify rows with a `Title` value that still have missing extraction content.
- Prefer continuing from the first incomplete row unless the user names a specific article.
- Treat excluded rows as already processed if column D clearly records the exclusion basis.
- If a row already has partial data, continue filling the missing fields instead of overwriting the whole row.

## Output Rules For Each Article

For each processed article:

- Write or update one Markdown consolidation file under `extracted_data/`.
- The Markdown file should capture:
  - source chat(s)
  - document details
  - structured synthesis by category
  - any verification caveats
- Then transfer the final synthesis into the matching row of `datasheet 20_to_fill.xlsx`.

The Markdown file is the article-level working note.
The Excel row is the final structured output.

## Handling Missing Coverage In Doc Analyzer

If the article title from the datasheet does not have a reliable Doc Analyzer match:

- stop the filling workflow for that row
- tell the user clearly that the article has not yet been worked in Doc Analyzer, or that no reliable chat match was found
- do not infer the answers from title alone
- do not silently skip the issue

This stop condition is mandatory.

## Spreadsheet Skill

Use the local spreadsheet skill when modifying `.xlsx` files:

- `C:/Users/juani/.codex/skills/spreadsheet/SKILL.md`

Apply it for:

- reading workbook structure
- preserving formatting
- editing the existing datasheet safely
- verifying written cell values

## Preferred Tools

- Prefer `scripts/doc-analyzer-login.js` for login/session work.
- Prefer `scripts/doc-analyzer-export-chats.js` for chat export.
- Prefer `openpyxl` for workbook editing and verification.
- Use `extracted_data/` for per-article Markdown outputs.
- Use `tmp/doc-analyzer-chats.json` as the exported chat source after running the exporter.

## Quality Standard

The expected output is not a shallow extraction.

Each completed row should reflect:

- the article's screening status if relevant
- the full context available in Doc Analyzer conversations
- careful synthesis of the 20 workbook questions
- explicit handling of non-applicable categories
- strong fidelity to the source evidence

When uncertain, be conservative and transparent rather than overconfident.
