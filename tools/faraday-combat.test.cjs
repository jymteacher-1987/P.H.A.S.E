const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../assets/faraday-flight/combat.js"),
  S = require("../assets/faraday-flight/scoring.js");
const context = {
  phase: 0,
  volley: 0,
  x: 240,
  y: 190,
  r: 42,
  W: 480,
  H: 760,
  scale: 1,
  player: { x: 240, y: 590 },
  easy: false,
};
test("Each boss has its own attack vocabulary, bounded sequences and a readable windup", () => {
  const identities = [];
  for (let stage = 0; stage < 5; stage++) {
    const ids = new Set();
    for (const easy of [false, true])
      for (const phase of [0, 1, 2])
        for (let volley = 0; volley < 6; volley++) {
          const p = C.bossAttack({ ...context, stage, phase, volley, easy });
          ids.add(p.id);
          assert.ok(p.events.length > 0 && p.events.length <= 100);
          assert.ok(
            p.recovery >= 0.74,
            "Every sequence leaves a breathing interval",
          );
          for (const e of p.events) {
            assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
            assert.ok(
              Math.abs(e.x - context.x) <= context.r * 0.76,
              "Every primary missile starts on a boss hardpoint",
            );
            assert.ok(
              Math.abs(e.y - context.y) <= context.r,
              "Missiles cannot materialize below or outside the boss",
            );
            assert.ok(e.at >= 0 && e.at < p.duration);
            if (e.type === "bullet") {
              assert.ok(
                e.at >= 0.75,
                "Bullet sequence must announce its first shot",
              );
              assert.ok(
                Number.isFinite(e.angle) && e.speed >= 100 && e.speed <= 180,
              );
            } else
              assert.equal(
                stage,
                3,
                "The generator owns the bosses' telegraphed beams",
              );
          }
          for (let i = 1; i < p.events.length; i++)
            assert.ok(p.events[i].at >= p.events[i - 1].at);
        }
    assert.ok(ids.size >= 2);
    for (const earlier of identities)
      for (const id of ids) assert.equal(earlier.has(id), false);
    identities.push(ids);
  }
});
test("Dense printing rows spread from the boss, and the two gate cannons cross their streams", () => {
  const p = C.bossAttack({ ...context, stage: 0 });
  const xs = p.events
    .filter((e) => e.at === p.events[0].at)
    .map((e) => e.x + (context.H * 0.72 - e.y) / Math.tan(e.angle))
    .sort((a, b) => a - b);
  assert.ok(
    xs.some((x, i) => i && x - xs[i - 1] > 90),
    "A navigable gap remains in each dense row",
  );
  assert.ok(p.events.length >= 30);
  const gate = C.bossAttack({ ...context, stage: 1 });
  for (const e of gate.events) {
    const hitX = e.x + (context.H * 0.72 - e.y) / Math.tan(e.angle);
    assert.ok(e.x < context.x ? hitX > context.x : hitX < context.x);
  }
});
test("Recorded aim is immutable, while clock bullets wait before spreading through a gap", () => {
  const player = { x: 120, y: 590 },
    p = C.bossAttack({ ...context, stage: 4, player });
  const first = structuredClone(p.events);
  player.x = 430;
  assert.deepEqual(p.events, first);
  for (const e of p.events) {
    assert.ok(e.hold > 0);
  }
  assert.ok(
    p.events.some(
      (e) => Math.abs(e.x + (590 - e.y) / Math.tan(e.angle) - 120) < 1e-8,
    ),
  );
  assert.ok(p.events.length >= 48);
  const ring = C.bossAttack({ ...context, stage: 4, volley: 1 });
  assert.ok(ring.events.every((e) => e.hold >= 0.7));
  assert.ok(ring.events.some((e) => Math.sin(e.angle) < 0));
  assert.ok(ring.events.some((e) => Math.sin(e.angle) > 0));
});
test("Light enemies shoot straight, scouts aim quickly, and armored enemies use wider attacks", () => {
  const player = { x: 420, y: 650 };
  for (let stage = 0; stage < 5; stage++) {
    const make = (kind) => C.smallVolley({ ...context, stage, kind, player });
    const light = make(0),
      scout = make(2),
      armor = make(1);
    assert.ok(light.every((s) => s.angle === Math.PI / 2));
    assert.ok(scout[0].angle < Math.PI / 2);
    assert.ok(scout[0].speed > light[0].speed);
    assert.ok(armor.length >= 2);
  }
});

test("Rotating the screen preserves the pending attack's aiming point and timing", () => {
  const attack = C.bossAttack({ ...context, stage: 4 }),
    original = structuredClone(attack);
  C.resizeAttack(attack, 0.45);
  assert.equal(attack.duration, original.duration);
  assert.equal(attack.origin.y, context.y * 0.45);
  for (const e of attack.events) {
    const old = original.events[attack.events.indexOf(e)],
      projectedX = e.x + (context.player.y * 0.45 - e.y) / Math.tan(e.angle),
      originalX = old.x + (context.player.y - old.y) / Math.tan(old.angle);
    assert.ok(Math.abs(projectedX - originalX) < 1e-8);
  }
});
test("Stage settlement adds remaining hearts and clear bonuses once, without counting combat twice", () => {
  const stats = {
    defeats: { light: 4, armored: 2, boss: 1 },
    parts: 2,
    perfect: 1,
    damage: 2,
    points: { defeat: 2820, parts: 200, perfect: 350 },
  };
  const r = S.settle({ stage: 0, hp: 3, maxHP: 5, stats, previous: 1234 });
  assert.equal(r.stageTotal, 4470);
  assert.equal(r.bonus, 1100);
  assert.equal(r.total, 5704);
  const flawless = S.settle({
    stage: 0,
    hp: 5,
    maxHP: 5,
    stats: { ...stats, damage: 0 },
    previous: 1234,
  });
  assert.equal(
    flawless.total - r.total,
    1150,
    "Two more hearts plus the 750-point no-hit bonus",
  );
  const final = S.settle({ stage: 4, hp: 100, maxHP: 5, stats, previous: 0 });
  assert.equal(final.rows.find((r) => r.id === "hearts").points, 1000);
  assert.equal(final.rows.find((r) => r.id === "clear").points, 1500);
});
