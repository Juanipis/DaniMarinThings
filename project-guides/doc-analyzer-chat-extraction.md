# Doc Analyzer Chat Extraction Guide

## Purpose

Use this guide when the user provides a list of articles or documents and wants information extracted from existing Doc Analyzer chats into Markdown files.

## Required files

- `scripts/doc-analyzer-login.js`
- `scripts/doc-analyzer-export-chats.js`
- `.env`
- `tmp/doc-analyzer-chats.json` after export

## Output directory

Write generated files to:

```text
extracted_data/
```

Create the directory if it does not exist.

## Commands

```bash
npm run docanalyzer:chats:export
```

## Operational sequence

1. Identify the list of requested articles/documents.
2. Identify exactly what the user wants extracted from the chats.
3. Run the chat export command.
4. Let the exporter reauthenticate automatically if the session is expired or missing.
5. Read `tmp/doc-analyzer-chats.json`.
6. Match requested articles against:
   - `thread.title`
   - `documents[].name`
   - `documents[].filename`
   - `queries[].prompt`
   - `queries[].answer`
7. Consolidate multiple matching chats for the same article when appropriate.
8. Write one Markdown file per article in `extracted_data/`.

## Output shape

Use a structure like:

```md
# <Article>

## Fuente
- Chat title: ...
- Documento: ...
- Thread ID: ...

## Extraccion
...
```

## Matching rules

- Prefer exact or near-exact matches on related document names.
- Use thread title as a secondary signal.
- Use prompt/answer content only as a fallback signal.
- Do not merge unrelated chats because of vague titles like `Untitled Chat`.
- If no reliable match exists, still create the file and state that no matching chat was found.
