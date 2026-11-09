# Doc Analyzer Login Guide

## Purpose

Use this guide when work requires an authenticated Doc Analyzer session.

## Required files

- `.env`
- `scripts/doc-analyzer-login.js`
- `tmp/doc-analyzer-storage-state.json` after successful login

## Expected environment

The `.env` file should contain:

```env
DOC_ANALYZER_EMAIL=...
DOC_ANALYZER_PASSWORD=...
```

## Commands

```bash
npm run docanalyzer:login
npm run docanalyzer:login:force
npm run docanalyzer:session:check
```

## Behavior

- The login flow uses `https://docanalyzer.ai/signin/alter`.
- A successful login stores session state in `tmp/doc-analyzer-storage-state.json`.
- If a later task needs Doc Analyzer access, check or refresh the session instead of assuming the stored session is still valid.

## Reuse pattern

Use the saved session in Playwright contexts:

```js
const context = await browser.newContext({
  storageState: "tmp/doc-analyzer-storage-state.json",
});
```
