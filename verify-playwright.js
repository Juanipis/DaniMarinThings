const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
  console.log("Loaded:", await page.title());

  await page.waitForTimeout(5000);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
