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
  for (const form of G.forms.slice(1)) {
    const earned = G.profile(form.at + 1, 0);
    const hit = G.profile(form.at, 0, {}, earned.progress);
    assert.equal(
      hit.tier,
      earned.tier,
      "Unwound coil reduces output without reverting the unlocked weapon",
    );
    assert.ok(hit.damage < earned.damage);
    assert.ok(G.profile(form.at + 1, 0, {}, hit.progress).damage > hit.damage);
  }
});

for (const engine of ["chromium", "webkit"])
  test(
    `Continuous lasers: bounded damage, attached emitter, no dark frames, saved evolution (${engine})`,
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
            reducedMotion: "reduce",
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
          "Drawing the continuous beam cannot apply repeated damage",
        );
        assert.equal(
          result.after.playerLasers[0].x,
          390,
          "The emitter follows the aircraft immediately",
        );
        await page.keyboard.down("ArrowLeft");
        const continuity = await page.evaluate(() => {
          const q = __faraday,
            samples = [];
          for (let n = 0; n < 60; n++) {
            q.step(1 / 60);
            const s = q.state,
              b = s.playerLasers[0],
              sc = Math.max(0.64, Math.min(1, s.H / 760));
            const canvas = document.getElementById("gameCanvas"),
              c = canvas.getContext("2d");
            if (!b) {
              samples.push({ missing: true });
              continue;
            }
            const pixel = c.getImageData(
              Math.round((b.x / s.W) * canvas.width),
              Math.round(((b.y - 70 * sc) / s.H) * canvas.height),
              1,
              1,
            ).data;
            samples.push({
              count: s.playerLasers.length,
              dx: Math.abs(
                b.x - (s.player.x + 30 * sc * Math.sin(s.player.tilt)),
              ),
              dy: Math.abs(
                b.y - (s.player.y - 30 * sc * Math.cos(s.player.tilt)),
              ),
              brightness:
                pixel[0] * 0.2126 + pixel[1] * 0.7152 + pixel[2] * 0.0722,
            });
          }
          return samples;
        });
        await page.keyboard.up("ArrowLeft");
        assert.ok(
          continuity.every(
            (s) => !s.missing && s.count === 1 && s.dx < 1e-8 && s.dy < 1e-8,
          ),
          "All 60 moving frames keep a single beam attached to the nose",
        );
        assert.ok(
          continuity.every((s) => s.brightness > 200),
          "The laser core never blinks off between damage ticks: " +
            JSON.stringify(
              continuity.filter((s) => s.brightness <= 200).slice(0, 3),
            ),
        );
        const firstBoss = await page.evaluate(() => {
          const q = __faraday,
            before = q.state;
          q.setPlayerHP(1000);
          q.finishWaves();
          q.step(0.1);
          const appeared = q.state;
          q.step(7.1);
          return { before, appeared, after: q.state };
        });
        assert.ok(firstBoss.appeared.enemies.some((e) => e.boss));
        assert.equal(firstBoss.after.feverTime, 0);
        assert.ok(
          firstBoss.appeared.weapon.tier >= firstBoss.before.weapon.tier,
        );
        assert.ok(
          firstBoss.after.weapon.tier >= firstBoss.before.weapon.tier,
          "First boss arrival and overdrive ending must preserve the evolved weapon",
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
        await page.evaluate(() => {
          const data = JSON.parse(
            localStorage.getItem("phase-faraday-flight-v1"),
          );
          data.checkpoint = {
            stage: 1,
            wing: 5,
            magnetLevel: 4,
            weaponProgress: 9,
            score: 12345,
            mode: "normal",
            build: { friend: 1 },
          };
          localStorage.setItem("phase-faraday-flight-v1", JSON.stringify(data));
        });
        await page.reload();
        await page.evaluate(() => {
          __faraday.manual();
          return __faraday.ready();
        });
        await page.click("#continueBtn");
        await page.click("#briefingLaunch");
        const damaged = await page.evaluate(() => {
          const q = __faraday;
          q.move(25, q.state.H * 0.8);
          q.step(2.1);
          const before = q.state;
          q.damage();
          const hit = q.state;
          q.collect("power");
          const recovered = q.state;
          q.collect("magnet");
          const collected = q.state;
          return { before, hit, recovered, collected };
        });
        assert.equal(damaged.before.weapon.tier, 2);
        assert.equal(damaged.hit.wing, damaged.before.wing - 1);
        assert.equal(damaged.hit.weapon.tier, 2);
        assert.ok(damaged.recovered.weapon.damage > damaged.hit.weapon.damage);
        assert.ok(
          damaged.collected.weapon.damage > damaged.recovered.weapon.damage,
        );
        const heat = await page.evaluate(() => {
          const q = __faraday;
          q.setPlayerHP(1000);
          q.collect("heat");
          q.fire();
          q.draw();
          const immediate = q.state;
          q.step(6.8);
          const stopped = q.state;
          const warning = document.getElementById("heatStatus").textContent;
          q.step(0.4);
          const resumed = q.state;
          q.collect("heat");
          q.collect("coolant");
          q.step(0.05);
          const cooled = q.state;
          return { immediate, stopped, resumed, cooled, warning };
        });
        assert.equal(heat.immediate.playerLasers.length, 0);
        assert.ok(heat.stopped.heatTime > 0);
        assert.equal(heat.stopped.playerLasers.length, 0);
        assert.equal(
          heat.stopped.shots.length,
          0,
          "Drone shots also stop while the emitter is overheated",
        );
        assert.match(heat.warning, /발사 중지/);
        assert.equal(heat.resumed.heatTime, 0);
        assert.ok(heat.resumed.playerLasers.length > 0);
        assert.equal(heat.cooled.heatTime, 0);
        assert.ok(heat.cooled.playerLasers.length > 0);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    },
  );
