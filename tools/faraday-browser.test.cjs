const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { chromium, webkit } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".preview-tmp/faraday");
fs.mkdirSync(out, { recursive: true });
async function server() {
  const s = http.createServer((req, res) => {
    const p = path.resolve(
      root,
      decodeURIComponent(new URL(req.url, "http://local").pathname).replace(
        /^\/+/,
        "",
      ),
    );
    if (
      !p.startsWith(root + path.sep) ||
      !fs.existsSync(p) ||
      !fs.statSync(p).isFile()
    ) {
      res.writeHead(404);
      return res.end();
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css",
        ".webp": "image/webp",
        ".json": "application/json",
      }[path.extname(p)] || "application/octet-stream",
    );
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  return s;
}
async function reachable(l) {
  await l.scrollIntoViewIfNeeded();
  assert.ok(
    await l.evaluate((e) => {
      const r = e.getBoundingClientRect(),
        top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return (
        r.left >= -1 &&
        r.right <= innerWidth + 1 &&
        r.top >= -1 &&
        r.bottom <= innerHeight + 1 &&
        (e === top || e.contains(top))
      );
    }),
    "Control must be visible and hit-testable",
  );
}
async function ready(page, url) {
  await page.goto(url);
  await page.evaluate(() => __faraday.ready());
  await page.evaluate(() => __faraday.manual());
}
async function chapter(page, index) {
  assert.equal(
    await page.locator("body").getAttribute("data-mode"),
    "briefing",
  );
  const levels = require("../assets/faraday-flight/levels.js").levels;
  assert.equal(
    await page.locator("#modalTitle").textContent(),
    levels[index].zone,
  );
  assert.equal(await page.locator(".chapter-crawl p").count(), 3);
  const frozen = await page.evaluate(() => {
    const q = __faraday,
      before = q.state;
    q.step(24);
    return { before, after: q.state };
  });
  assert.equal(frozen.after.stageTime, 0, "Story must not spend combat time");
  assert.equal(frozen.after.player.hp, frozen.before.player.hp);
  assert.equal(frozen.after.shots.length, 0);
  assert.equal(frozen.after.enemies.length, 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#modal").isVisible(), true);
  await reachable(page.locator("#briefingLaunch"));
}
test(
  "Faraday: equipment collection earns overdrive without electricity tokens",
  { timeout: 30000 },
  async () => {
    const s = await server(),
      origin = "http://127.0.0.1:" + s.address().port;
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await ready(page, origin + "/plays/faraday-flight.html?qa");
      await page.click("#startBtn");
      await page.click("#briefingLaunch");
      const result = await page.evaluate(() => {
        const q = __faraday;
        q.collect("capacitor");
        q.collect("heart");
        q.collect("coolant");
        q.pulse();
        q.step(0.25); // Let the special attack's short hit pause finish.
        const otherItems = q.state;
        q.collect("power");
        q.collect("magnet");
        q.collect("power");
        q.step(0.02);
        const partial = q.state;
        q.collect("magnet");
        q.step(0.02);
        return { otherItems, partial, boosted: q.state };
      });
      assert.equal(result.otherItems.fever, 0);
      assert.equal(result.otherItems.stats.parts, 1);
      assert.equal(result.otherItems.stats.pulses, 1);
      assert.equal(result.partial.fever, 75);
      assert.equal(result.partial.feverTime, 0);
      assert.ok(result.boosted.feverTime > 6.9);
      assert.equal(result.boosted.wing, 3);
      assert.equal(result.boosted.magnetLevel, 2);
      assert.equal(result.boosted.stats.parts, 5);
      assert.equal(await page.locator(".score-label").textContent(), "점수");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise((resolve) => s.close(resolve));
    }
  },
);

test(
  "Faraday: fixed missiles, entrance volleys and body damage during overdrive",
  { timeout: 60000 },
  async () => {
    const s = await server(),
      origin = "http://127.0.0.1:" + s.address().port;
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await ready(page, origin + "/plays/faraday-flight.html?qa");
      await page.click("#startBtn");
      await page.click("#briefingLaunch");
      const trajectory = await page.evaluate(() => {
        const q = __faraday;
        q.move(50, q.state.H * 0.76);
        for (let i = 0; i < 8; i++) q.collect("power");
        q.spawnBeam(430);
        q.step(0.2);
        const before = q.state.shots.find((s) => s.side && s.vx > 0);
        q.move(100, q.state.H * 0.76);
        q.step(0.1);
        const after = q.state.shots.find(
          (s) =>
            Math.abs(s.life - (before.life - 0.1)) < 1e-8 && s.vx === before.vx,
        );
        return { before, after };
      });
      assert.ok(
        trajectory.after,
        "Side missiles keep velocity while targets are off their flight paths",
      );
      assert.ok(
        Math.abs(
          trajectory.after.x - trajectory.before.x - trajectory.before.vx * 0.1,
        ) < 1e-7,
      );
      assert.ok(
        Math.abs(
          trajectory.after.y - trajectory.before.y - trajectory.before.vy * 0.1,
        ) < 1e-7,
      );
      await page.reload();
      await page.evaluate(() => __faraday.ready());
      await page.evaluate(() => __faraday.manual());
      await page.click("#startBtn");
      await page.click("#briefingLaunch");
      const entrance = await page.evaluate(() => {
        const q = __faraday;
        for (let i = 0; i < 8; i++) q.collect("power");
        let prematureDamage = false,
          maxEnemies = 0;
        for (let i = 0; i < 12 * 60; i++) {
          q.step(1 / 60);
          const s = q.state;
          maxEnemies = Math.max(maxEnemies, s.enemies.length);
          prematureDamage ||= s.enemies.some(
            (e) => !e.entryVolley && e.hp < e.maxHP,
          );
        }
        return { prematureDamage, maxEnemies, stats: q.state.stats };
      });
      assert.equal(entrance.prematureDamage, false);
      assert.ok(entrance.stats.kills > 0);
      assert.ok(
        entrance.stats.enemyShots >= entrance.stats.kills,
        "Enemies fire before maxed equipment destroys them",
      );
      assert.ok(
        entrance.maxEnemies < 10,
        "First-stage waves leave room instead of accumulating a crowd",
      );
      await page.reload();
      await page.evaluate(() => __faraday.ready());
      await page.evaluate(() => __faraday.manual());
      await page.click("#startBtn");
      await page.click("#briefingLaunch");
      const collision = await page.evaluate(() => {
        const q = __faraday;
        q.step(2.1);
        for (let i = 0; i < 4; i++) q.collect(i % 2 ? "magnet" : "power");
        q.step(0.02);
        const before = q.state.player.hp;
        const id = q.spawnBeam(120);
        const enemy = q.state.enemies.find((e) => e.id === id);
        q.move(enemy.x, enemy.y);
        q.step(0.02);
        return { before, after: q.state.player.hp, fever: q.state.feverTime };
      });
      assert.ok(collision.fever > 0);
      assert.equal(
        collision.after,
        collision.before - 1,
        "Actual body collision hurts during overdrive",
      );
    } finally {
      await browser.close();
      await new Promise((resolve) => s.close(resolve));
    }
  },
);

test(
  "Faraday: equipment, real beam collisions, special, five boss transitions and ending in Chromium and WebKit",
  { timeout: 180000 },
  async (t) => {
    const s = await server(),
      origin = "http://127.0.0.1:" + s.address().port;
    try {
      for (const name of ["chromium", "webkit"])
        await t.test(name, { timeout: 85000 }, async () => {
          const browser = await (name === "webkit" ? webkit : chromium).launch({
            headless: true,
            ...(name === "chromium" && process.platform === "win32"
              ? { channel: "msedge" }
              : {}),
          });
          try {
            const context = await browser.newContext({
                viewport: { width: 390, height: 844 },
              }),
              page = await context.newPage(),
              errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            await context.route("**/*", (r) =>
              new URL(r.request().url()).origin === origin
                ? r.continue()
                : r.abort(),
            );
            await ready(page, origin + "/plays/faraday-flight.html?qa");
            await reachable(page.locator("#startBtn"));
            await page.screenshot({
              path: path.join(out, name + "-title.png"),
            });
            await page.click("#startBtn");
            await chapter(page, 0);
            await page.click("#briefingLaunch");
            const equipment = await page.evaluate(() => {
              const q = __faraday;
              q.step(2.1);
              q.collect("power");
              const coil = q.state;
              q.damage();
              const hit = q.state;
              q.collect("magnet");
              const magnetic = q.state;
              q.collect("heat");
              const hot = q.state;
              q.collect("coolant");
              const cool = q.state;
              for (let i = 0; i < 8; i++) q.collect("power");
              q.step(0.2);
              const maxed = q.state;
              return { coil, hit, magnetic, hot, cool, maxed };
            });
            assert.equal(equipment.coil.wing, 2);
            assert.equal(equipment.hit.wing, 1);
            assert.equal(equipment.hit.player.hp, 4);
            assert.ok(equipment.hit.pickups.some((p) => p.kind === "power"));
            assert.equal(equipment.magnetic.magnetLevel, 1);
            assert.equal(equipment.hot.heatTime, 7);
            assert.ok(
              Math.abs(
                equipment.hot.generator.emf -
                  equipment.magnetic.generator.emf * 0.6,
              ) < 1e-8,
            );
            assert.equal(equipment.cool.heatTime, 0);
            assert.equal(equipment.maxed.wing, 8);
            assert.ok(
              equipment.maxed.shots.some((s) => s.heavy),
              "Final coil unlocks a heavy center missile",
            );
            assert.ok(equipment.maxed.shots.some((s) => s.side));
            assert.ok(equipment.maxed.shots.every((s) => !s.homing));
            // The beam is aimed through the real player's collider; no call to hurt is used here.
            const beam = await page.evaluate(() => {
              const q = __faraday;
              q.step(1.5);
              const before = q.state.player.hp;
              q.spawnBeam(q.state.player.x);
              q.step(1.45);
              return { before, after: q.state.player.hp };
            });
            assert.equal(beam.after, beam.before - 1);
            const pulse = await page.evaluate(() => {
              const q = __faraday;
              q.spawnBeam();
              q.step(1.16);
              q.collect("capacitor");
              const before = q.state.pulseCharges;
              q.pulse();
              return { before, state: q.state };
            });
            assert.equal(pulse.state.pulseCharges, pulse.before - 1);
            assert.equal(pulse.state.beams.length, 0);
            assert.equal(pulse.state.bullets.length, 0);
            assert.ok(pulse.state.stats.perfect > 0);
            await page.keyboard.press("Escape");
            const paused = await page.evaluate(() => {
              const t = __faraday.state.stageTime;
              __faraday.step(2);
              return [t, __faraday.state.stageTime];
            });
            assert.equal(paused[0], paused[1]);
            await page.keyboard.press("Escape");
            // These are explicit transition fixtures, not a difficulty/completion claim.
            for (let i = 0; i < 5; i++) {
              await page.evaluate(() => {
                __faraday.setPlayerHP(30);
                __faraday.finishWaves();
                __faraday.step(0.1);
              });
              const entry = await page.evaluate(() => {
                const q = __faraday,
                  e = q.state.enemies.find((e) => e.boss);
                q.pulse();
                return {
                  before: e.hp,
                  after: q.state.enemies.find((e) => e.boss).hp,
                };
              });
              assert.equal(
                entry.before,
                entry.after,
                "Boss cannot die during entrance",
              );
              const motion = await page.evaluate(() => {
                const q = __faraday;
                q.setPlayerHP(100);
                q.setBossHP(100000);
                let previous = q.state.enemies.find((e) => e.boss).x,
                  maxStep = 0,
                  maxEscorts = 0;
                for (let frame = 0; frame < 18 * 60; frame++) {
                  q.step(1 / 60, false);
                  const s = q.state,
                    boss = s.enemies.find((e) => e.boss);
                  maxStep = Math.max(maxStep, Math.abs(boss.x - previous));
                  previous = boss.x;
                  maxEscorts = Math.max(
                    maxEscorts,
                    s.enemies.filter((e) => e.escort).length,
                  );
                }
                q.draw();
                return { maxStep, maxEscorts };
              });
              assert.ok(
                motion.maxStep <= 1.501,
                "Boss resumes from its paused position without teleporting",
              );
              assert.ok(
                motion.maxEscorts >= 1 && motion.maxEscorts <= 2,
                "Boss escorts appear without accumulating",
              );
              if (i === 1) {
                await page.evaluate(() => {
                  __faraday.collect("capacitor");
                  __faraday.pulse();
                });
                assert.equal(
                  await page.evaluate(
                    () =>
                      __faraday.state.enemies.find((e) => e.boss).armorClosed,
                  ),
                  false,
                );
              }
              await page.screenshot({
                path: path.join(out, name + "-boss-" + (i + 1) + ".png"),
              });
              await page.evaluate(() => {
                __faraday.setBossHP(1);
                __faraday.collect("capacitor");
                __faraday.pulse();
                __faraday.step(2);
              });
              assert.equal(
                await page.evaluate(() => __faraday.state.mode),
                "clear",
              );
              if (i < 4) await page.locator(".clear-record summary").click();
              assert.equal(
                await page.evaluate(() => __faraday.state.enemies.length),
                0,
                "Defeating the boss also clears its escorts",
              );
              assert.ok(await page.locator(".history-card").isVisible());
              assert.ok(
                (await page.locator(".history-card p").innerText()).length > 40,
              );
              await page.screenshot({
                path: path.join(out, name + "-clear-" + (i + 1) + ".png"),
              });
              if (i < 4) {
                const b = page.locator("[data-upgrade]").first();
                await reachable(b);
                await b.click();
                await page.locator("#nextStageBtn").click();
                await chapter(page, i + 1);
                await page.click("#briefingLaunch");
                assert.equal(
                  await page.evaluate(() => __faraday.state.stage),
                  i + 1,
                );
                assert.ok(await page.locator("#modal").isHidden());
              }
            }
            await page.click("[data-action=ending]");
            await page
              .locator(".ending-scene img")
              .evaluate((img) => img.decode());
            assert.match(
              await page.locator(".ending-story").innerText(),
              /왕립학회 회장직을 두 번/,
            );
            assert.match(
              await page.locator(".ending-story").innerText(),
              /왕립연구소의 크리스마스 강연/,
            );
            assert.match(
              await page.locator(".ending-story").innerText(),
              /말년에는.*햄프턴 코트/,
            );
            assert.match(
              await page.locator(".ending-story").innerText(),
              /1867년/,
            );
            assert.match(
              await page.locator("#modalContent").innerText(),
              /5 \/ 5/,
            );
            assert.equal(
              await page.evaluate(() => __faraday.state.save.checkpoint),
              null,
            );
            await page.screenshot({
              path: path.join(out, name + "-ending.png"),
            });
            await page.click("#modalContent [data-action=map]");
            await page.click("#modalClose");
            assert.equal(
              await page.locator("#modalTitle").innerText(),
              "양초 하나가 밝힌 세상",
            );
            assert.equal(await page.locator("#modal").isVisible(), true);
            await page.click("#modalContent [data-action=map]");
            await page.keyboard.press("Escape");
            assert.equal(
              await page.locator("#modalTitle").innerText(),
              "양초 하나가 밝힌 세상",
            );
            await page.click("[data-action=title]");
            await page.reload();
            await page.evaluate(() => __faraday.ready());
            assert.ok(await page.locator("#continueBtn").isHidden());
            await page.click("[data-action=map]");
            assert.equal(await page.locator(".map-stage:disabled").count(), 0);
            await page.click('[data-stage="3"]');
            await page.click("#briefingLaunch");
            await page.reload();
            await page.evaluate(() => __faraday.ready());
            await page.click("#continueBtn");
            await page.click("#briefingLaunch");
            assert.equal(await page.evaluate(() => __faraday.state.stage), 3);
            assert.deepEqual(errors, []);
          } finally {
            await browser.close();
          }
        });
    } finally {
      await new Promise((r) => s.close(r));
    }
  },
);
test(
  "Faraday: tiny phone controls, touch and keyboard, journal, blocked storage and audio",
  { timeout: 90000 },
  async () => {
    const s = await server(),
      origin = "http://127.0.0.1:" + s.address().port,
      browser = await webkit.launch({ headless: true });
    try {
      const context = await browser.newContext({
          viewport: { width: 320, height: 460 },
          hasTouch: true,
        }),
        page = await context.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await context.route("**/*", (r) =>
        new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
      );
      await context.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("blocked", "SecurityError");
          },
        });
        window.AudioContext = undefined;
        window.webkitAudioContext = undefined;
        delete CanvasRenderingContext2D.prototype.roundRect;
      });
      await ready(page, origin + "/plays/faraday-flight.html?qa");
      assert.match(await page.locator("#loadStatus").innerText(), /이번 실행/);
      for (const viewport of [
        { width: 320, height: 460 },
        { width: 568, height: 210 },
        { width: 667, height: 310 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(viewport);
        await reachable(page.locator("#startBtn"));
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.screenshot({
          path: path.join(
            out,
            "tiny-" + viewport.width + "x" + viewport.height + ".png",
          ),
        });
      }
      await page.setViewportSize({ width: 320, height: 460 });
      await page.click("[data-action=help]");
      assert.match(await page.locator("#modalContent").innerText(), /과열/);
      await page.click("[data-action=close]");
      await page.click("[data-action=journal]");
      await page.locator("#speedControl").fill("0");
      await page.evaluate(() => __faraday.step(0.2));
      assert.equal(
        await page.evaluate(() => Math.abs(__faraday.noteState.sample.emf)),
        0,
      );
      await page.click('[data-note="1"]');
      await page.locator("#turnControl").fill("3");
      await page.locator("#fieldControl").fill("3");
      await page.evaluate(() => __faraday.step(0.2));
      await page.screenshot({ path: path.join(out, "journal.png") });
      await page.click('[data-note="2"]');
      await page.evaluate(() => __faraday.step(3));
      const charged = await page.evaluate(() => __faraday.noteState.voltage);
      assert.ok(charged > 1);
      await page.locator("#speedControl").fill("0");
      await page.evaluate(() => __faraday.step(3));
      assert.equal(
        await page.evaluate(() => __faraday.noteState.voltage),
        charged,
      );
      assert.equal(await page.evaluate(() => __faraday.noteState.current), 0);
      await page.locator("#noteDischarge").click();
      await page.evaluate(() => __faraday.step(0.3));
      assert.ok(
        (await page.evaluate(() => __faraday.noteState.voltage)) <
          charged * 0.3,
      );
      await page.screenshot({ path: path.join(out, "journal-discharge.png") });
      await page.click("#modalClose");
      await page.click("#startBtn");
      for (const viewport of [
        { width: 320, height: 460 },
        { width: 568, height: 210 },
      ]) {
        await page.setViewportSize(viewport);
        await reachable(page.locator("#briefingLaunch"));
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator(".chapter-crawl")
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await page.setViewportSize({ width: 320, height: 460 });
      await page.click("#briefingLaunch");
      const before = await page.evaluate(() => __faraday.state.player.x);
      await page.keyboard.down("ArrowRight");
      await page.evaluate(() => __faraday.step(0.2));
      await page.keyboard.up("ArrowRight");
      assert.ok(
        (await page.evaluate(() => __faraday.state.player.x)) > before + 40,
      );
      const touch = await page.evaluate(() => {
        const c = gameCanvas,
          r = c.getBoundingClientRect(),
          q = __faraday,
          start = q.state.player.x;
        function send(type, x, id = 7) {
          c.dispatchEvent(
            new PointerEvent(type, {
              pointerId: id,
              pointerType: "touch",
              clientX: x,
              clientY: r.top + r.height * 0.7,
              bubbles: true,
              buttons: type === "pointerup" ? 0 : 1,
            }),
          );
        }
        send("pointerdown", r.left + r.width * 0.5);
        send("pointermove", r.left + r.width * 0.25);
        pulseBtn.dispatchEvent(
          new PointerEvent("pointerdown", {
            pointerId: 8,
            pointerType: "touch",
            bubbles: true,
          }),
        );
        q.step(0.2);
        const end = q.state.player.x;
        send("pointerup", r.left + r.width * 0.25);
        return { start, end, pulses: q.state.stats.pulses };
      });
      assert.ok(touch.end < touch.start - 50);
      assert.equal(touch.pulses, 1);
      await page.click("#pauseBtn");
      await page.locator("#volume").fill("0");
      await page.click("[data-action=resume]");
      await page.evaluate(() => __faraday.setPlayerHP(1));
      await page.evaluate(() => {
        __faraday.step(2);
        __faraday.damage();
      });
      assert.equal(await page.evaluate(() => __faraday.state.mode), "failed");
      await page.click("[data-action=retry-easy]");
      assert.equal(await page.evaluate(() => __faraday.state.player.hp), 7);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await new Promise((r) => s.close(r));
    }
  },
);
