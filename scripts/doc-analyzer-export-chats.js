const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "..");
const TMP_DIR = path.join(ROOT_DIR, "tmp");
const STORAGE_STATE_PATH = path.join(TMP_DIR, "doc-analyzer-storage-state.json");
const EXPORT_PATH = path.join(TMP_DIR, "doc-analyzer-chats.json");
const CHATS_URL = "https://docanalyzer.ai/app/chats";
const LOGIN_SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "doc-analyzer-login.js");

function runNodeScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Fallo la ejecucion de ${path.basename(scriptPath)}.`);
  }
}

async function hasValidSession() {
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    return false;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const page = await context.newPage();
    await page.goto("https://docanalyzer.ai/app/chats", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(4000);
    return page.url().includes("/app/chats");
  } catch {
    return false;
  } finally {
    await browser.close();
  }
}

async function ensureSession() {
  if (await hasValidSession()) {
    return;
  }

  if (!fs.existsSync(LOGIN_SCRIPT_PATH)) {
    throw new Error(
      `No existe ${LOGIN_SCRIPT_PATH}. No puedo reautenticar la sesion automaticamente.`
    );
  }

  console.log("Sesion inexistente o expirada. Intentando iniciar sesion automaticamente...");
  runNodeScript(LOGIN_SCRIPT_PATH, ["--force"]);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildHeaders(capturedHeaders) {
  const headers = {
    apikey: capturedHeaders.apikey,
    authorization: capturedHeaders.authorization,
    "x-client-info": capturedHeaders["x-client-info"],
    "accept-profile": capturedHeaders["accept-profile"] || "public",
    referer: "https://docanalyzer.ai/",
  };

  return Object.fromEntries(Object.entries(headers).filter(([, value]) => Boolean(value)));
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Fallo GET ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function captureSupabaseContext(page) {
  let threadListUrl = null;
  let authHeaders = null;

  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("supabase.co/rest/v1/threads")) {
      return;
    }

    if (url.includes("hidden=eq.false") && !threadListUrl) {
      threadListUrl = url;
    }

    if (!authHeaders) {
      const headers = request.headers();
      if (headers.apikey && headers.authorization) {
        authHeaders = headers;
      }
    }
  });

  await page.goto(CHATS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);

  if (!threadListUrl || !authHeaders) {
    throw new Error("No pude capturar la URL o los headers autenticados de Supabase.");
  }

  return {
    threadListUrl,
    headers: buildHeaders(authHeaders),
  };
}

async function run() {
  await ensureSession();

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const page = await context.newPage();
    const supabase = await captureSupabaseContext(page);

    const threads = await fetchJson(supabase.threadListUrl, supabase.headers);
    const documents = await fetchJson(
      "https://mcadqzjdbezemazytgxg.supabase.co/rest/v1/documents" +
        "?select=owner,docid,id,bucket,category,name,filename,mime,size,status,insight,metadata,permissions,updated_at,created_at,pinned" +
        "&order=created_at.desc&offset=0&limit=501",
      supabase.headers
    );
    const documentsById = new Map(documents.map((document) => [document.docid, document]));
    const chats = [];

    for (const thread of threads) {
      const queriesUrl =
        "https://mcadqzjdbezemazytgxg.supabase.co/rest/v1/queries" +
        "?select=qid,seq,owner,prompt,context,code,errored,ack,answer,retryable,traceid,payload,liked,answered_at,docids,created_at" +
        `&thread=eq.${encodeURIComponent(thread.tid)}`;

      const queries = await fetchJson(queriesUrl, supabase.headers);
      const relatedDocIds = uniqueBy(
        queries.flatMap((query) => query.docids || []),
        (docid) => docid
      );
      chats.push({
        thread,
        documents: relatedDocIds
          .map((docid) => documentsById.get(docid))
          .filter(Boolean),
        queries: uniqueBy(
          queries.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)),
          (query) => query.qid
        ),
      });
    }

    const output = {
      exportedAt: new Date().toISOString(),
      count: chats.length,
      chats,
    };

    fs.writeFileSync(EXPORT_PATH, JSON.stringify(output, null, 2));
    console.log(`Chats exportados en ${EXPORT_PATH}`);
    console.log(`Total chats: ${chats.length}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
