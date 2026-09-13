const { test } = require("node:test"),
  assert = require("node:assert/strict");
const G = require("../assets/faraday-flight/weapons.js");
const { chromium, webkit } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");

test("Every additional coil or magnet improves output beyond the old caps; all six forms remain useful", () => {
  const tiers = new Set();
  const dps = (p) =>
    (p.damage * (p.beams ? p.beams * p.beamPower : p.lanes)) / p.interval;
  for (const build of [{}, { spread: 4, power: 4, rapid: 4 }]) {
    for (let coil = 1; coil <= 50; coil++)
      for (let magnet = 0; magnet <= 50; magnet++) {
        const p = G.profile(coil, magnet, build);
        tiers.add(p.tier);
        for (const next of [
          G.profile(coil + 1, magnet, build),
          G.profile(coil, magnet + 1, build),
        ]) {
          assert.ok(next.damage > p.damage);
          assert.ok(
            dps(next) > dps(p),
            "Changing form cannot lower total firepower",
          );
        }
        assert.ok(
          (p.beams || p.lanes) <= 3,
          "Growth changes weapon form rather than flooding the screen",
        );
      }
  }
  assert.equal(tiers.size, 6);
  assert.equal(G.profile(8, 6).tier, 2);
  assert.equal(G.profile(20, 20).tier, 5);
  assert.ok(G.profile(30, 30).width > G.profile(20, 20).width);
});

for (const engine of ["chromium", "webkit"])
  test(
    `Laser pulses: one hit per target, limited penetration, fixed aim, saved growth (${engine})`,
    { timeout: 60000 },
    async () => {
      const browser = await (engine === "webkit" ? webkit : chromium).launch({
        headless: true,
        ...(engine === "chromium" && process.platform === "win32"
          ? { channel: "msedge" }
          : {}),
      });
      try {
        const page = await browser.newPage({
            viewport: { width: 390, height: 844 },
          }),
          errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.hostname !== "faraday-weapons.test") return route.abort();
          const file = path.resolve(
            root,
            decodeURIComponent(url.pathname).replace(/^\/+/, ""),
          );
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
            return route.abort();
          return route.fulfill({
            body: fs.readFileSync(file),
            contentType:
              {
                ".js": "text/javascript",
                ".html": "text/html; charset=utf-8",
                ".css": "text/css",
                ".webp": "image/webp",
              }[path.extname(file)] || "application/octet-stream",
          });
        });
        await page.goto(
          "https://faraday-weapons.test/plays/faraday-flight.html?qa",
        );
        await page.evaluate(() => {
          __faraday.manual();
          return __faraday.ready();
        });
        await page.click("#startBtn");
        await page.click("#briefingLaunch");
        const result = await page.evaluate(() => {
          const q = __faraday;
          for (let n = 0; n < 9; n++) q.collect(n % 2 ? "magnet" : "power");
          q.move(240, 650);
          const ids = [
            q.spawnTarget(240, 470),
            q.spawnTarget(240, 370),
            q.spawnTarget(240, 270),
            q.spawnTarget(380, 450),
          ];
          q.fire();
          const before = q.state;
          q.move(390, 650);
          for (let n = 0; n < 30; n++) q.draw();
          const after = q.state;
          return { ids, before, after };
        });
        assert.equal(result.before.weapon.tier, 2);
        const hp = (s) =>
          result.ids.map((id) => s.enemies.find((e) => e.id === id).hp);
        const hit = hp(result.before);
        assert.ok(hit[0] < 100 && hit[1] < 100);
        assert.equal(hit[2], 100);
        assert.equal(hit[3], 100);
        assert.deepEqual(
          hp(result.after),
          hit,
          "Drawing afterglow cannot apply repeated damage",
        );
        assert.equal(
          result.after.playerLasers[0].x,
          240,
          "Beam stays on its firing axis after movement",
        );
        await page.evaluate(() =>
          localStorage.setItem(
            "phase-faraday-flight-v1",
            JSON.stringify({
              sound: false,
              unlocked: 4,
              checkpoint: {
                stage: 4,
                wing: 20,
                magnetLevel: 24,
                score: 12345,
                mode: "normal",
                build: {},
              },
            }),
          ),
        );
        await page.reload();
        await page.evaluate(() => {
          __faraday.manual();
          return __faraday.ready();
        });
        await page.click("#continueBtn");
        await page.click("#briefingLaunch");
        const continued = await page.evaluate(() => {
          const q = __faraday;
          q.fire();
          const before = q.state;
          q.collect("power");
          q.collect("magnet");
          return { before, after: q.state };
        });
        assert.equal(continued.before.wing, 20);
        assert.equal(continued.before.magnetLevel, 24);
        assert.equal(continued.before.weapon.tier, 5);
        assert.equal(continued.before.score, 12345);
        assert.ok(
          continued.after.weapon.damage > continued.before.weapon.damage,
        );
        assert.ok(
          continued.after.weapon.mastery > continued.before.weapon.mastery,
        );
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    },
  );
