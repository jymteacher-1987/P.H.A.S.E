(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FaradayWeapons = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const forms = [
    { at: 0, name: "스파크 미사일", color: "#b6fff0", interval: 0.165 },
    { at: 3, name: "트윈 미사일", color: "#a9c8ff", interval: 0.165 },
    {
      at: 9,
      name: "펄스 레이저",
      color: "#6cefff",
      interval: 0.18,
      width: 7,
      beams: 1,
      power: 3.3,
      pierce: 2,
    },
    {
      at: 17,
      name: "쌍열 레이저",
      color: "#b9a2ff",
      interval: 0.2,
      width: 8,
      beams: 2,
      power: 2,
      pierce: 2,
    },
    {
      at: 26,
      name: "플라스마 캐논",
      color: "#ffd18a",
      interval: 0.22,
      width: 19,
      beams: 1,
      power: 4.8,
      pierce: 3,
    },
    {
      at: 32,
      name: "오로라 캐논",
      color: "#94ffe0",
      interval: 0.24,
      width: 27,
      beams: 1,
      power: 5.5,
      pierce: 4,
    },
  ];
  const count = (value) =>
    Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
  // Diminishing returns keep late collection useful without runaway special-attack charging.
  const strength = (value, knee) =>
    Math.min(value, knee) + Math.log2(1 + Math.max(0, value - knee));
  function profile(wing, magnetLevel, build = {}, unlockedProgress = 0) {
    const coils = Math.max(1, count(wing)),
      magnets = count(magnetLevel),
      spread = count(build.spread),
      power = count(build.power),
      progress = Math.max(
        count(unlockedProgress),
        coils - 1 + magnets + spread * 2 + power * 2,
      );
    let tier = forms.length - 1;
    while (forms[tier].at > progress) tier--;
    const form = forms[tier],
      mastery = Math.max(0, progress - forms[5].at),
      damage =
        1 +
        strength(coils - 1, 7) * 0.08 +
        strength(magnets, 6) * 0.17 +
        power * 0.25;
    return {
      ...form,
      tier,
      progress,
      mastery,
      next: forms[tier + 1]?.at ?? null,
      damage,
      lanes: tier === 0 ? 1 : Math.min(3, 2 + Math.floor((progress - 3) / 3)),
      width: form.width
        ? form.width +
          Math.min(5, strength(magnets, 6) * 0.3) +
          Math.min(5, Math.log2(1 + mastery))
        : 0,
      beamPower: (form.power || 0) * (1 + spread * 0.055),
      interval: form.interval * Math.pow(0.88, count(build.rapid)),
    };
  }
  return { profile, strength, count, forms };
});
