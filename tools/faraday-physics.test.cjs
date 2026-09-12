const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  P = require("../assets/faraday-flight/physics.js");
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
