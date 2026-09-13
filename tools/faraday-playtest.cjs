// A movement-limited pilot exercises the real simulation without granting equipment or health.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/plays/faraday-flight.html?qa");
    await page.evaluate(() => __faraday.ready());
    await page.evaluate(() => __faraday.manual());
    await page.click("#titleSound");
    await page.click("#startBtn");
    await page.click("#briefingLaunch");
    const report = [];
    for (let stage = 0; stage < 5; stage++) {
      const result = await page.evaluate(() => {
        const api = __faraday,
          dt = 0.1;
        let ticks = 0,
          maxPickups = 0,
          maxParts = 0;
        const pickupKinds = new Set();
        while (api.state.mode === "play" && ticks++ < 1800) {
          const s = api.state,
            p = s.player,
            sc = Math.min(1, Math.max(0.64, s.H / 760));
          const livePickups = s.pickups.filter((item) => !item.dead);
          maxPickups = Math.max(maxPickups, livePickups.length);
          maxParts = Math.max(
            maxParts,
            livePickups.filter((item) =>
              ["power", "magnet", "heart"].includes(item.kind),
            ).length,
          );
          for (const item of livePickups) pickupKinds.add(item.kind);
          const boss = s.enemies.find((e) => e.boss),
            goods = s.pickups.filter(
              (e) =>
                e.kind !== "heat" &&
                e.y > Math.min(s.H * 0.3, p.y - 220) &&
                e.y < s.H - 20,
            );
          goods.sort((a, b) => {
            const weight = (k) =>
              k === "power"
                ? 2.8
                : k === "heart" && p.hp < 4
                  ? 3
                  : k === "magnet"
                    ? 2
                    : 1;
            return (
              Math.hypot(a.x - p.x, a.y - p.y) / weight(a.kind) -
              Math.hypot(b.x - p.x, b.y - p.y) / weight(b.kind)
            );
          });
          let target = goods[0] ||
            boss ||
            s.enemies.filter((e) => e.y > 0).sort((a, b) => b.y - a.y)[0] || {
              x: 240,
            };
          let tx = target.x,
            ty = goods.length
              ? Math.max(s.H * 0.45, Math.min(s.H * 0.83, target.y + 30))
              : s.H * 0.76;
          let best = null;
          for (let ax = -1; ax <= 1; ax++)
            for (let ay = -1; ay <= 1; ay++) {
              const n = Math.hypot(ax, ay) || 1,
                x = Math.max(25, Math.min(455, p.x + (ax / n) * 310 * dt)),
                y = Math.max(
                  s.H * 0.4,
                  Math.min(s.H - 45 * sc, p.y + (ay / n) * 310 * sc * dt),
                );
              let cost = Math.hypot(x - tx, (y - ty) * 0.9) * 0.08;
              for (const b of s.bullets) {
                for (const future of [0, 0.2, 0.45, 0.75]) {
                  const d = Math.hypot(
                    x - (b.x + b.vx * future),
                    y - (b.y + b.vy * future),
                  );
                  cost += (Math.max(0, 55 * sc - d) ** 2 * 0.13) / (1 + future);
                }
              }
              for (const e of s.enemies) {
                const d = Math.hypot(x - e.x, y - e.y);
                cost += Math.max(0, e.r + p.r + 35 * sc - d) ** 2 * 0.3;
              }
              for (const h of s.pickups.filter((h) => h.kind === "heat")) {
                const d = Math.hypot(x - h.x, y - h.y);
                cost += Math.max(0, 44 * sc - d) ** 2 * 0.15;
              }
              for (const b of s.beams.filter(
                (b) => !b.fired && b.delay - b.age < 0.6,
              )) {
                const vx = x - b.origin.x,
                  vy = y - b.origin.y,
                  d = Math.abs(vx * b.direction.y - vy * b.direction.x);
                cost += Math.max(0, 25 * sc - d) ** 2 * 0.3;
              }
              if (!best || cost < best.cost) best = { x, y, cost };
            }
          const threat =
            s.bullets.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 72 * sc) ||
            s.beams.some((b) => !b.fired && b.delay - b.age < 0.25);
          if (s.pulseCharges > 0 && (threat || (boss && s.pulseCharges >= 2)))
            api.pulse();
          api.move(best.x, best.y);
          api.step(dt);
        }
        const s = api.state;
        return {
          mode: s.mode,
          stage: s.stage + 1,
          time: Math.round(s.stageTime),
          score: Math.round(s.score),
          wing: s.wing,
          magnet: s.magnetLevel,
          weapon: s.weapon.name,
          weaponProgress: s.weapon.progress,
          weaponTier: s.weapon.tier,
          hp: s.player.hp,
          damage: s.stats.damage,
          kills: s.stats.kills,
          pulses: s.stats.pulses,
          perfect: s.stats.perfect,
          collectedParts: s.stats.parts,
          patterns: s.stats.bossPatterns,
          settlement: s.stats.settlement,
          maxPickups,
          maxParts,
          pickupKinds: [...pickupKinds].sort(),
          bossHP: s.enemies.find((e) => e.boss)?.hp,
        };
      });
      report.push(result);
      console.log(result);
      await page.screenshot({
        path: path.resolve(
          __dirname,
          "../.preview-tmp/faraday/pilot-stage-" + (stage + 1) + ".png",
        ),
      });
      if (result.mode !== "clear") break;
      if (stage < 4) {
        const candidates = ["spread", "rapid", "power", "friend", "heart"];
        let upgrade;
        for (const id of candidates) {
          if (await page.locator("[data-upgrade=" + id + "]").count()) {
            upgrade = id;
            break;
          }
        }
        await page.locator("[data-upgrade=" + upgrade + "]").click();
        await page.locator("#nextStageBtn").click();
        await page.click("#briefingLaunch");
      }
    }
    fs.writeFileSync(
      path.resolve(__dirname, "../.preview-tmp/faraday/playtest.json"),
      JSON.stringify({ report, errors }, null, 2),
    );
    assert.deepEqual(errors, []);
    assert.equal(report.length, 5, "Pilot reaches all five stages");
    for (const result of report) {
      assert.equal(result.mode, "clear", "Pilot clears stage " + result.stage);
      assert.equal(
        result.pickupKinds.includes("star"),
        false,
        "No electricity tokens appear",
      );
      assert.ok(result.pickupKinds.includes("power"));
      assert.ok(result.pickupKinds.includes("magnet"));
      assert.ok(
        result.maxParts <= 3,
        "At most two supplies plus a dropped coil after damage",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
