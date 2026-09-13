// Read-only deployment smoke test. Analytics and database traffic are blocked.
const { chromium, webkit } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const base = (
    process.argv[2] || "https://jymteacher-1987.github.io/P.H.A.S.E"
  ).replace(/\/$/, ""),
  origin = new URL(base).origin;
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".preview-tmp/faraday");
fs.mkdirSync(out, { recursive: true });
const digest = (b) => crypto.createHash("sha256").update(b).digest("hex");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  const report = { base };
  try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.stack || e.message));
    await context.route("**/*", (r) => {
      const u = new URL(r.request().url());
      if (u.pathname.endsWith("/firebase-config.js"))
        return r.fulfill({
          contentType: "text/javascript",
          body: "window.FIREBASE_CONFIG = {};",
        });
      return r.request().method() === "GET" &&
        (u.origin === origin ||
          [
            "fonts.googleapis.com",
            "fonts.gstatic.com",
            "cdn.jsdelivr.net",
          ].includes(u.hostname))
        ? r.continue()
        : r.abort();
    });
    await context.addInitScript(() =>
      sessionStorage.setItem("visit_counted", "1"),
    );
    await page.goto(base + "/index.html");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#expTotalCount")
          ?.textContent.replace(/\s/g, "") === "20+9",
    );
    report.count = await page.locator("#expTotalCount").innerText();
    await page.screenshot({ path: path.join(out, "site-home.png") });
    await page.goto(base + "/lab.html?play=all");
    await page.waitForFunction(
      () => document.querySelectorAll(".exp-card").length === 9,
    );
    const titles = await page.locator(".exp-card h3").allTextContents();
    const i = titles.findIndex((t) => t.includes("패러데이"));
    assert.ok(i >= 0 && titles[i + 1].includes("잔광"));
    report.order = titles;
    const card = page
      .locator(".exp-card")
      .filter({ has: page.locator("h3", { hasText: "패러데이" }) });
    await card.scrollIntoViewIfNeeded();
    await card.locator("img").evaluate((im) => im.decode());
    await page.screenshot({ path: path.join(out, "site-play-list.png") });
    await card.click();
    await page.waitForURL("**/view.html?id=faraday-flight&src=play");
    const game = page.frameLocator("#expFrame");
    await game.locator("#startBtn:enabled").waitFor({ timeout: 25000 });
    await page.screenshot({ path: path.join(out, "site-game-title.png") });
    await game.locator("#startBtn").click();
    await game.locator("#briefingLaunch").click();
    await game.locator("body[data-mode=play]").waitFor();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(330);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(650);
    await game.locator("#pulseBtn").click();
    await game.locator("#pauseBtn").click();
    await game.locator("[data-action=resume]").click();
    await game.locator("body[data-mode=play]").waitFor();
    await page.screenshot({ path: path.join(out, "site-game-play.png") });
    const files = [
      "plays/faraday-flight.html",
      "assets/faraday-flight/game.js",
      "assets/faraday-flight/style.css",
      "assets/faraday-flight/combat.js",
      "assets/faraday-flight/scoring.js",
      "assets/faraday-flight/physics.js",
      "assets/faraday-flight/induction-diagram.js",
      "assets/faraday-flight/leaderboard.js",
      "assets/faraday-flight/levels.js",
      "assets/faraday-flight/sprites.js",
      "assets/faraday-flight/hero.webp",
      "assets/faraday-flight/fog.webp",
      ...[
        "ending",
        "poverty",
        "symbols",
        "boss",
        "foes-books",
        "foes-gates",
        "foes-symbols",
        "foes-lab",
        "foes-records",
      ].map((n) => "assets/faraday-flight/" + n + ".webp"),
    ];
    report.assets = [];
    for (const file of files) {
      const response = await context.request.get(
        base + "/" + file + "?verify=" + Date.now(),
      );
      assert.equal(response.status(), 200, file);
      const remote = await response.body(),
        local = fs.readFileSync(path.join(root, file));
      const normalize = (b) =>
        file.endsWith(".webp")
          ? b
          : Buffer.from(b.toString("utf8").replace(/\r\n/g, "\n"));
      assert.equal(
        digest(normalize(remote)),
        digest(normalize(local)),
        file + " must match the verified source",
      );
      report.assets.push(file);
    }
    assert.deepEqual(errors, []);
    report.errors = errors;
  } finally {
    await browser.close();
  }
  const safari = await webkit.launch({ headless: true });
  try {
    const context = await safari.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    await page.goto(base + "/plays/faraday-flight.html");
    await page.locator("#startBtn:enabled").waitFor({ timeout: 25000 });
    await page.click("#startBtn");
    await page.click("#briefingLaunch");
    await page.locator("body[data-mode=play]").waitFor();
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(out, "site-webkit-phone.png") });
    assert.deepEqual(errors, []);
    report.webkit = "started";
  } finally {
    await safari.close();
  }
  fs.writeFileSync(
    path.join(out, "deployment-check.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
