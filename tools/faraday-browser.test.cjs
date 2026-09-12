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
            assert.ok(equipment.maxed.shots.some((s) => s.homing));
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
              await page.evaluate(() => __faraday.step(5));
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
                assert.equal(
                  await page.evaluate(() => __faraday.state.stage),
                  i + 1,
                );
                assert.ok(await page.locator("#modal").isHidden());
              }
            }
            await page.click("[data-action=ending]");
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
            await page.click("[data-action=title]");
            await page.reload();
            await page.evaluate(() => __faraday.ready());
            assert.ok(await page.locator("#continueBtn").isHidden());
            await page.click("[data-action=map]");
            assert.equal(await page.locator(".map-stage:disabled").count(), 0);
            await page.click('[data-stage="3"]');
            await page.reload();
            await page.evaluate(() => __faraday.ready());
            await page.click("#continueBtn");
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
      await page.click('[data-note="1"]');
      await page.locator("#turnControl").fill("3");
      await page.locator("#fieldControl").fill("3");
      await page.evaluate(() => __faraday.step(0.2));
      await page.screenshot({ path: path.join(out, "journal.png") });
      await page.click("#modalClose");
      await page.click("#startBtn");
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
