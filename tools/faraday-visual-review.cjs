const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path");
const out = path.resolve(__dirname, "../.preview-tmp/faraday");
(async () => {
  const browser = await chromium.launch({
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1200, height: 950 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/plays/faraday-flight.html?qa");
    await page.evaluate(() => __faraday.ready());
    await page.evaluate(() => __faraday.manual());
    await page.click("#startBtn");
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) __faraday.collect("power");
      __faraday.step(10);
    });
    await page.screenshot({ path: path.join(out, "review-flight.png") });
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) __faraday.collect("star");
      __faraday.step(1);
    });
    await page.screenshot({ path: path.join(out, "review-boost.png") });
    await page.click("#pauseBtn");
    await page.click("#modalContent [data-action=journal]");
    await page.evaluate(() => __faraday.step(0.6));
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-induction.png") });
    await page.click('[data-note="2"]');
    await page.evaluate(() => __faraday.step(0.55));
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-rectifier.png") });
    await page.evaluate(() => __faraday.step(3));
    await page.locator("#speedControl").fill("0");
    await page.evaluate(() => __faraday.step(0.1));
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-hold.png") });
    await page.click("#noteDischarge");
    await page.evaluate(() => __faraday.step(0.05));
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-discharge.png") });
    await page.screenshot({ path: path.join(out, "review-notebook.png") });
    await page.click("#modalClose");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      __faraday.step(3);
    });
    await page.screenshot({ path: path.join(out, "review-phone.png") });
    fs.writeFileSync(
      path.join(out, "visual-review.json"),
      JSON.stringify({ errors }, null, 2),
    );
    console.log({ errors });
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
