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
    await page
      .locator(".chapter-crawl")
      .evaluate((el) =>
        el.getAnimations().forEach((a) => (a.currentTime = 8000)),
      );
    await page.screenshot({ path: path.join(out, "review-chapter.png") });
    await page.click("#briefingLaunch");
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
    await page.click('[data-note="1"]');
    await page.evaluate(() => __faraday.step(0.55));
    await page.locator("#turnControl").fill("1");
    await page.locator("#fieldControl").fill("1");
    await page.evaluate(() => __faraday.draw());
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-lamp-weak.png") });
    await page.locator("#turnControl").fill("3");
    await page.locator("#fieldControl").fill("3");
    await page.evaluate(() => __faraday.draw());
    await page
      .locator("#noteCanvas")
      .screenshot({ path: path.join(out, "review-lamp-strong.png") });
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
    for (let stage = 0; stage < 5; stage++) {
      const artPage = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      artPage.on("pageerror", (e) => errors.push(e.message));
      await artPage.addInitScript(() =>
        localStorage.setItem(
          "phase-faraday-flight-v1",
          JSON.stringify({ unlocked: 4, sound: false }),
        ),
      );
      await artPage.goto("http://127.0.0.1:4173/plays/faraday-flight.html?qa");
      await artPage.evaluate(() => {
        __faraday.manual();
        return __faraday.ready();
      });
      await artPage.click("[data-action=map]");
      await artPage.click('[data-stage="' + stage + '"]');
      await artPage
        .locator(".chapter-crawl")
        .evaluate((el) => el.getAnimations().forEach((a) => a.finish()));
      await artPage.screenshot({
        path: path.join(out, "review-chapter-" + (stage + 1) + ".png"),
      });
      await artPage.click("#briefingLaunch");
      await artPage.evaluate(() => {
        __faraday.setPlayerHP(100);
        __faraday.move(28, __faraday.state.H * 0.8);
        __faraday.step(22);
      });
      await artPage.screenshot({
        path: path.join(out, "review-foes-" + (stage + 1) + ".png"),
      });
      await artPage.evaluate(() => {
        __faraday.finishWaves();
        __faraday.step(8);
      });
      await artPage.screenshot({
        path: path.join(out, "review-new-boss-" + (stage + 1) + ".png"),
      });
      if (stage === 4) {
        await artPage.evaluate(() => {
          __faraday.setBossHP(1);
          __faraday.collect("capacitor");
          __faraday.pulse();
          __faraday.step(2);
        });
        await artPage.click("[data-action=ending]");
        await artPage
          .locator(".ending-scene img")
          .evaluate((img) => img.decode());
        await artPage.screenshot({ path: path.join(out, "review-ending.png") });
      }
      await artPage.close();
    }
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
