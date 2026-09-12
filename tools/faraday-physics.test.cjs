const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  P = require("../assets/faraday-flight/physics.js");
test("Moving magnet EMF is the negative flux derivative, reverses on retreat, and scales with turns/field", () => {
  for (const n of [1, 3, 20])
    for (const b of [0.2, 1, 3])
      for (const omega of [0, 1.3, 3])
        for (const phase of [0.4, 1.9, 3.6, 5.5]) {
          const h = 1e-6,
            flux = (t) =>
              (b * 0.7) /
              Math.pow(
                1 + Math.pow(1.45 + 1.25 * Math.cos(phase + omega * t), 2),
                1.5,
              );
          const expected = (-n * (flux(h) - flux(-h))) / (2 * h),
            actual = P.movingInductionSample(n, b, 0.7, omega, phase).emf;
          assert.ok(Math.abs(actual - expected) < 1e-7);
          assert.ok(
            Math.abs(
              actual + P.movingInductionSample(n, b, 0.7, -omega, phase).emf,
            ) < 1e-10,
          );
        }
});
test("Rectifier charges from either polarity, blocks return current, and keeps stored energy with input stopped", () => {
  const plus = P.capacitorStep(0, 2, 0.02),
    minus = P.capacitorStep(0, -2, 0.02);
  assert.deepEqual(plus, minus);
  assert.ok(plus.voltage > 0 && plus.current > 0);
  let v = 0;
  for (let i = 0; i < 600; i++)
    v = P.capacitorStep(v, Math.sin((i / 60) * 6) * 3, 1 / 60).voltage;
  assert.ok(v > 2.9 && v <= 3);
  for (const source of [0, -1, 1]) {
    const state = P.capacitorStep(v, source, 100);
    assert.equal(state.voltage, v);
    assert.equal(state.current, 0);
    assert.equal(state.energy, 0.5 * 0.08 * v * v);
  }
});
test("Faraday law agrees with an independent centered derivative of flux linkage", () => {
  for (const N of [1, 5, 80])
    for (const B of [0.1, 0.8, 1.9])
      for (const omega of [-5, 0, 3])
        for (const t of [0.03, 0.4, 1.7]) {
          const A = 0.17,
            h = 1e-6,
            fluxLink = (time) => N * B * A * Math.cos(omega * time);
          const expected = -(fluxLink(t + h) - fluxLink(t - h)) / (2 * h),
            actual = P.inductionSample(N, B, A, omega, omega * t).emf;
          assert.ok(
            Math.abs(actual - expected) < 1e-6,
            `${actual} vs ${expected}`,
          );
        }
});
test("Stationary flux cannot continuously generate; extra turns and field scale EMF", () => {
  for (let a = 0; a < 7; a += 0.23)
    assert.equal(Math.abs(P.inductionSample(90, 2, 0.5, 0, a).emf), 0);
  const sample = (n, b) => P.inductionSample(n, b, 0.2, 4, 0.7).emf;
  assert.ok(Math.abs(sample(60, 0.8) - sample(20, 0.8) * 3) < 1e-10);
  assert.ok(Math.abs(sample(20, 1.6) - sample(20, 0.8) * 2) < 1e-10);
  const a = P.inductionSample(3, 0.6, 1, 2, 0.8).emf,
    b = P.inductionSample(3, 0.6, 1, 2, 0.8 + Math.PI).emf;
  assert.ok(Math.abs(a + b) < 1e-12, "Half a turn reverses voltage sign");
});
