const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");

test(
  "Faraday starts without remote fonts or later chapters; missing chapter art can be retried safely",
  { timeout: 40000 },
  async () => {
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    });
    let releaseBoss, releaseFonts;
    const bossHeld = new Promise((resolve) => (releaseBoss = resolve)),
      fontsHeld = new Promise((resolve) => (releaseFonts = resolve));
    try {
      const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        }),
        requests = [],
        errors = [];
      let failedLab = false;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem(
          "phase-faraday-flight-v1",
          JSON.stringify({ unlocked: 4, sound: false }),
        ),
      );
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname !== "faraday-start.test") {
          await fontsHeld;
          return route.abort().catch(() => {});
        }
        const file = path.resolve(
          root,
          decodeURIComponent(url.pathname).replace(/^\/+/, ""),
        );
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
          return route.abort();
        requests.push(path.basename(file));
        if (file.endsWith("poverty.webp")) await bossHeld;
        if (file.endsWith("foes-lab.webp") && !failedLab) {
          failedLab = true;
          return route.abort();
        }
        return route.fulfill({
          body: fs.readFileSync(file),
          contentType:
            {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".css": "text/css",
              ".webp": "image/webp",
            }[path.extname(file)] || "application/octet-stream",
        });
      });
      await page.goto(
        "https://faraday-start.test/plays/faraday-flight.html?qa",
        { waitUntil: "domcontentloaded" },
      );
      await page.locator("#startBtn:enabled").waitFor({ timeout: 4000 });
      assert.equal(
        await page.locator("body").getAttribute("data-mode"),
        "title",
      );
      assert.equal(
        requests.some((n) =>
          [
            "fog.webp",
            "symbols.webp",
            "ending.webp",
            "enemies.webp",
            "foes-records.webp",
          ].includes(n),
        ),
        false,
      );
      await page.click("#startBtn");
      assert.equal(
        await page.locator("#briefingLaunch").isDisabled(),
        true,
        "Do not launch a chapter with an invisible boss",
      );
      releaseBoss();
      await page.click("#briefingLaunch");
      await page.evaluate(() => {
        __faraday.manual();
        __faraday.step(1);
      });
      const hud = await page.locator("#hud").boundingBox();
      assert.ok(hud.height <= 76, "Compact HUD leaves more room to fly");
      assert.equal(
        await page.locator("#bossPattern").count(),
        0,
        "No textual boss walkthrough overlays",
      );
      assert.ok(
        await page
          .locator("#pauseBtn")
          .evaluate((el) => el.getBoundingClientRect().width >= 28),
      );
      await page.evaluate(() => {
        __faraday.finishWaves();
        __faraday.step(4);
        __faraday.setBossHP(1);
        __faraday.pulse();
        __faraday.step(2.2);
      });
      await page.locator("#nextStageBtn").waitFor({ state: "attached" });
      assert.equal(
        await page
          .locator("#nextStageBtn")
          .evaluate((el) => getComputedStyle(el).position),
        "static",
      );
      assert.equal(
        await page
          .locator("#nextStageBtn")
          .evaluate((el) => el === el.parentElement.lastElementChild),
        true,
        "Departure comes after rewards and history",
      );
      await page.locator(".clear-record summary").click();
      await page.locator("#nextStageBtn").scrollIntoViewIfNeeded();
      const out = path.join(root, ".preview-tmp/faraday");
      fs.mkdirSync(out, { recursive: true });
      await page.screenshot({
        path: path.join(out, "clear-departure-bottom.png"),
      });

      // Direct chapter entry must request that chapter, recover one failed asset,
      // and keep the current chapter's launch button separate from old requests.
      await page.goto(
        "https://faraday-start.test/plays/faraday-flight.html?qa",
        { waitUntil: "domcontentloaded" },
      );
      await page.locator("#startBtn:enabled").waitFor();
      await page.click("#startScreen [data-action=map]");
      await page.click('[data-stage="3"]');
      await page
        .locator("#briefingLaunch")
        .filter({ hasText: "다시 준비" })
        .waitFor();
      assert.equal(
        await page.locator("body").getAttribute("data-mode"),
        "briefing",
      );
      await page.click("#briefingLaunch");
      await page
        .locator("#briefingLaunch")
        .filter({ hasText: "4장 출발" })
        .waitFor();
      await page.click("#briefingLaunch");
      const state = await page.evaluate(() => __faraday.state);
      assert.equal(state.mode, "play");
      assert.equal(state.stage, 3);
      assert.ok(
        state.loadedImages.includes("boss") &&
          state.loadedImages.includes("foes-lab"),
      );
      assert.deepEqual(errors, []);
    } finally {
      releaseBoss();
      releaseFonts();
      await browser.close();
    }
  },
);
