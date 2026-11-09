const fs = require("node:fs");
const path = require("node:path");
const { stdout } = require("node:process");
const { chromium } = require("playwright");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");
const TMP_DIR = path.join(ROOT_DIR, "tmp");
const STORAGE_STATE_PATH = path.join(TMP_DIR, "doc-analyzer-storage-state.json");
const SESSION_META_PATH = path.join(TMP_DIR, "doc-analyzer-session-meta.json");
const SIGNIN_URL = "https://docanalyzer.ai/signin/alter";
const APP_URL = "https://docanalyzer.ai/";

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getEmail() {
  loadDotEnv(ENV_PATH);
  const email = process.env.DOC_ANALYZER_EMAIL?.trim();

  if (!email) {
    throw new Error(
      `Falta DOC_ANALYZER_EMAIL en ${ENV_PATH}. Edita el .env y vuelve a ejecutar el script.`
    );
  }

  return email;
}

function getPassword() {
  loadDotEnv(ENV_PATH);
  const password = process.env.DOC_ANALYZER_PASSWORD?.trim();

  if (!password) {
    throw new Error(
      `Falta DOC_ANALYZER_PASSWORD en ${ENV_PATH}. Edita el .env y vuelve a ejecutar el script.`
    );
  }

  return password;
}

async function fillPasswordLogin(page, email, password) {
  const emailInput = page.getByRole("textbox", { name: /e\.g john\.doe@example\.com/i });
  const passwordInput = page.getByRole("textbox", { name: /password/i });
  const submitButton = page.getByRole("button", { name: /sign-in with password/i });

  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();
}

async function isLoggedIn(page) {
  const currentUrl = page.url();
  if (!currentUrl.includes("/signin")) {
    return true;
  }

  const otpInput = page.locator('input[name*="otp" i], input[autocomplete="one-time-code"]').first();
  if (await otpInput.count()) {
    return false;
  }

  return false;
}

async function validateSavedSession() {
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    return false;
  }

  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const page = await context.newPage();

    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    const valid = await isLoggedIn(page);
    await context.close();
    return valid;
  } finally {
    await browser.close();
  }
}

async function run() {
  const email = getEmail();
  const password = getPassword();
  const force = process.argv.includes("--force");
  const checkOnly = process.argv.includes("--check");

  ensureDir(TMP_DIR);

  if (!force && (await validateSavedSession())) {
    console.log(`Sesion existente valida para ${email}.`);
    console.log(`Storage state: ${STORAGE_STATE_PATH}`);
    return;
  }

  if (checkOnly) {
    console.log("No hay una sesion valida guardada.");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(SIGNIN_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    stdout.write("\nIniciando sesion con email y password en /signin/alter...\n\n");
    await fillPasswordLogin(page, email, password);
    await page.waitForURL((url) => !url.toString().includes("/signin"), {
      timeout: 60 * 1000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    if (!(await isLoggedIn(page))) {
      throw new Error(
        "No pude confirmar que la sesion quedara iniciada. Si sigues en /signin, repite el proceso."
      );
    }

    await context.storageState({ path: STORAGE_STATE_PATH });
    fs.writeFileSync(
      SESSION_META_PATH,
      JSON.stringify(
        {
          email,
          savedAt: new Date().toISOString(),
          storageStatePath: STORAGE_STATE_PATH,
        },
        null,
        2
      )
    );

    console.log(`Sesion guardada en ${STORAGE_STATE_PATH}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
