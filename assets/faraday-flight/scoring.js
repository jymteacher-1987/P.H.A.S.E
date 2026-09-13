(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FaradayScoring = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function settle({ stage, hp, maxHP, stats, previous }) {
    const hearts = Math.max(0, Math.min(maxHP, Math.floor(hp))),
      d = stats.defeats,
      rows = [
        {
          id: "defeat",
          label: "적 격파",
          detail: `일반 ${d.light}×35 · 장갑 ${d.armored}×90 · 보스 ${d.boss}×2,500`,
          points: stats.points.defeat,
        },
        {
          id: "parts",
          label: "부품 수집",
          detail: `${stats.parts}개 · 코일·자석 100점부터, 축전기 80점`,
          points: stats.points.parts,
        },
        {
          id: "perfect",
          label: "PERFECT 차단",
          detail: `${stats.perfect}회 × 350점`,
          points: stats.points.perfect,
        },
        {
          id: "clear",
          label: "스테이지 통과",
          detail: `${stage + 1}장 · 1장은 500점, 이후 장마다 +250점`,
          points: 500 + stage * 250,
        },
        {
          id: "hearts",
          label: "남은 하트",
          detail: `${hearts}개 × 200점`,
          points: hearts * 200,
        },
        {
          id: "flawless",
          label: "무피격 비행",
          detail:
            stats.damage === 0
              ? "한 번도 피해를 받지 않았어요"
              : `피격 ${stats.damage}회 · 무피격이면 750점`,
          points: stats.damage === 0 ? 750 : 0,
        },
      ],
      stageTotal = rows.reduce((sum, row) => sum + row.points, 0),
      bonus = rows.slice(3).reduce((sum, row) => sum + row.points, 0);
    return { rows, stageTotal, bonus, previous, total: previous + stageTotal };
  }
  return { settle };
});
