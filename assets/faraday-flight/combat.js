(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FaradayCombat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const PI = Math.PI,
    clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  // These are fictional enemy attacks. All aimed shots lock their direction before firing.
  function bossAttack({
    stage,
    phase,
    volley,
    x,
    y,
    r,
    W,
    H,
    scale,
    player,
    easy,
  }) {
    const events = [],
      markers = [],
      sy = y + r + 8 * scale,
      warning = easy ? 1 : 0.75,
      aim = Math.atan2(player.y - sy, player.x - x);
    let id,
      name,
      hint,
      recovery = 2.1;
    const shot = (at, bx, by, angle, speed, kind = "orb", extra = {}) =>
      events.push({
        type: "bullet",
        at,
        x: bx,
        y: by,
        angle,
        speed,
        kind,
        ...extra,
      });
    const ray = (bx, by, angle, at = warning) =>
      markers.push({
        kind: "ray",
        x: bx,
        y: by,
        angle,
        start: Math.max(0, at - warning),
        end: at,
      });
    const beam = (at, bx, targetX) =>
      events.push({
        type: "beam",
        at,
        x: bx,
        y: sy,
        target: {
          x: clamp(targetX, 25, W - 25),
          y: Math.max(sy + 120 * scale, player.y),
        },
      });
    if (stage === 0) {
      if (volley % 2 === 0) {
        id = "type-lines";
        name = "활자 찍기";
        hint = "활자 줄의 빈틈으로 이동";
        const gap = [1, 4, 2][Math.floor(volley / 2) % 3],
          spacing = (W - 80) / 7,
          rows = phase === 2 && !easy ? 3 : 2;
        markers.push({
          kind: "gap",
          x: 40 + (gap - 0.5) * spacing,
          width: spacing * 2,
          y: sy + 30 * scale,
          start: 0,
          end: warning + (rows - 1) * 0.65,
        });
        for (let row = 0; row < rows; row++)
          for (let col = 0; col < 8; col++) {
            if (col === gap || col === gap + 1) continue;
            const bx = 40 + col * spacing,
              at = warning + row * 0.65;
            if (row === 0) ray(bx, sy, PI / 2, at);
            shot(at, bx, sy, PI / 2, 118 + phase * 8, "ink");
          }
      } else {
        id = "binding-staples";
        name = "제본못 두 줄";
        hint = "조준한 두 줄 사이로 피하기";
        const targetX = clamp(player.x, 95, W - 95);
        for (const side of [-1, 1]) {
          const bx = x + side * 28 * scale,
            angle = Math.atan2(
              Math.max(130 * scale, player.y - sy),
              targetX + side * 42 - bx,
            );
          ray(bx, sy, angle);
          for (let n = 0; n < (phase > 0 ? 3 : 2); n++)
            shot(warning + n * 0.22, bx, sy, angle, 153, "needle");
        }
      }
      recovery = 2.25 - phase * 0.1;
    } else if (stage === 1) {
      if (volley % 2 === 0) {
        id = "closing-gates";
        name = "닫혀 오는 문";
        hint = "모이는 탄을 보고 바깥쪽으로";
        const targetY = Math.max(sy + 160 * scale, H * 0.72),
          count = easy ? 3 : 3 + phase;
        for (const side of [-1, 1]) {
          const bx = side < 0 ? 38 : W - 38,
            angle = Math.atan2(targetY - sy, W / 2 - bx);
          ray(bx, sy, angle);
          for (let n = 0; n < count; n++)
            shot(warning + n * 0.27, bx, sy, angle, 143 + phase * 5, "shard");
        }
      } else {
        id = "keyhole-burst";
        name = "열쇠구멍 속사";
        hint = "한 번 조준한 위치로 연속 사격";
        ray(x, sy, aim);
        for (let n = 0; n < (easy ? 3 : 4 + phase); n++)
          shot(warning + n * 0.19, x, sy, aim, 171, "needle");
      }
      recovery = 1.95 - phase * 0.1;
    } else if (stage === 2) {
      if (volley % 2 === 0) {
        id = "compass-spiral";
        name = "회전하는 기호";
        hint = "회전 방향을 읽고 틈을 따라가기";
        const count = easy ? 8 : 10 + phase * 2,
          direction = Math.floor(volley / 2) % 2 ? -1 : 1;
        markers.push({ kind: "compass", x, y: sy, start: 0, end: warning });
        for (let n = 0; n < count; n++) {
          const angle = PI / 2 + direction * (-0.9 + (1.8 * n) / (count - 1));
          shot(warning + n * 0.14, x - 18 * scale, sy, angle, 126, "glyph");
          shot(
            warning + n * 0.14,
            x + 18 * scale,
            sy,
            PI - angle,
            126,
            "glyph",
          );
        }
      } else {
        id = "coordinate-cross";
        name = "교차하는 좌표";
        hint = "X자로 만나는 탄줄의 바깥을 보기";
        const left = W * 0.25,
          right = W * 0.75,
          dy = Math.max(140 * scale, H * 0.6 - sy);
        for (const [bx, tx] of [
          [left, right],
          [right, left],
        ]) {
          const angle = Math.atan2(dy, tx - bx);
          ray(bx, sy, angle);
          for (let n = 0; n < (easy ? 4 : 5 + phase); n++)
            shot(warning + n * 0.2, bx, sy, angle, 150, "glyph");
        }
      }
      recovery = 1.75 - phase * 0.1;
    } else if (stage === 3) {
      const turn = volley % 3;
      if (turn === 0) {
        id = "induction-discharge";
        name = "유도 방전";
        hint = "노란 예고선을 피하거나 폭풍으로 끊기";
        beam(0, x, player.x);
        if (phase > 0 && !easy)
          beam(0, x, player.x < W / 2 ? W * 0.75 : W * 0.25);
      } else if (turn === 1) {
        id = "split-sparks";
        name = "갈라지는 불꽃";
        hint = "큰 불꽃이 갈라지기 전에 거리 벌리기";
        const count = easy ? 2 : 3;
        for (let i = 0; i < count; i++) {
          const angle = PI / 2 + (i - (count - 1) / 2) * 0.55;
          ray(x, sy, angle);
          shot(warning, x, sy, angle, 112 + phase * 8, "split");
        }
      } else {
        id = "alternating-terminals";
        name = "양쪽 단자 방전";
        hint = "먼저 켜지는 예고선부터 피하기";
        beam(0, x - 40 * scale, W * 0.3);
        beam(easy ? 2.15 : 1.8, x + 40 * scale, W * 0.7);
      }
      recovery = 1.9 - phase * 0.1;
    } else {
      if (volley % 2 === 0) {
        id = "record-echo";
        name = "기록의 메아리";
        hint = "기록된 위치를 벗어나면 같은 길로 다시 날아와요";
        for (const side of [-1, 1]) {
          const bx = x + side * 45 * scale,
            angle = Math.atan2(
              Math.max(140 * scale, player.y - sy),
              player.x - bx,
            );
          ray(bx, sy, angle);
          for (let n = 0; n < (easy ? 3 : 4 + phase); n++)
            shot(warning + n * 0.38, bx, sy, angle, 160, "echo", {
              hold: 0.38,
            });
        }
      } else {
        id = "clock-release";
        name = "멈춘 시계";
        hint = "잠시 멈춘 탄이 퍼져 나가요 · 빈 방향 찾기";
        const count = easy ? 12 : 16,
          gapAngle = PI / 2 + (Math.floor(volley / 2) % 2 ? 0.6 : -0.6),
          ring = 34 * scale;
        markers.push({ kind: "clock", x, y: sy, start: 0, end: warning });
        for (let row = 0; row < (phase > 0 && !easy ? 2 : 1); row++)
          for (let n = 0; n < count; n++) {
            const angle = (2 * PI * n) / count,
              distance = Math.abs(
                Math.atan2(
                  Math.sin(angle - gapAngle),
                  Math.cos(angle - gapAngle),
                ),
              );
            if (distance < 0.62) continue;
            shot(
              warning + row * 1.1,
              x + Math.cos(angle) * ring,
              sy + Math.sin(angle) * ring,
              angle,
              120 + phase * 10,
              "echo",
              { hold: easy ? 0.95 : 0.7 },
            );
          }
      }
      recovery = 1.65 - phase * 0.12;
    }
    events.sort((a, b) => a.at - b.at);
    const duration = Math.max(
      ...events.map(
        (e) => e.at + (e.type === "beam" ? (easy ? 2.1 : 1.8) : 0.65),
      ),
    );
    return {
      id,
      name,
      hint,
      events,
      markers,
      duration,
      recovery: recovery * (easy ? 1.25 : 1),
      elapsed: 0,
      cursor: 0,
    };
  }

  function smallVolley({ kind, stage, volley, x, y, r, player, easy, scale }) {
    const sy = y + r,
      aim = Math.atan2(player.y - sy, player.x - x),
      shots = [];
    const add = (angle, speed, skin = "orb", bx = x, extra = {}) =>
      shots.push({ x: bx, y: sy, angle, speed, kind: skin, ...extra });
    if (kind === 0) {
      // Light enemies fire straight; weaving under them is different from baiting an aimed shot.
      add(
        PI / 2,
        113 + stage * 5,
        stage === 0 ? "ink" : stage === 2 ? "glyph" : "orb",
      );
      if (stage >= 3 && !easy)
        add(PI / 2, 113 + stage * 5, "orb", x + 17 * scale);
    } else if (kind === 2) {
      // Scouts lead with fast, fixed aim. Later variants split or pause before departure.
      add(
        aim,
        157 + stage * 5,
        stage === 3 && volley % 2 === 1
          ? "split"
          : stage === 4
            ? "echo"
            : "needle",
        x,
        stage === 4 ? { hold: 0.45 } : {},
      );
    } else if (stage === 1) {
      for (const side of [-1, 1])
        add(aim - side * 0.2, 125, "shard", x + side * 24 * scale);
    } else if (stage === 2) {
      for (const angle of [PI / 4, PI / 2, (PI * 3) / 4])
        add(angle, 121, "glyph");
    } else if (stage === 4) {
      for (const side of [-1, 0, 1])
        add(aim + side * 0.3, 137, "echo", x, { hold: 0.65 });
    } else {
      for (const side of [-1, 0, 1])
        add(PI / 2 + side * 0.3, 107 + stage * 7, stage === 0 ? "ink" : "orb");
    }
    return shots;
  }
  function resizeAttack(attack, ratio) {
    for (const point of [...attack.events, ...attack.markers]) {
      point.y *= ratio;
      if (point.target) point.target.y *= ratio;
      if (point.angle !== undefined)
        point.angle = Math.atan2(
          Math.sin(point.angle) * ratio,
          Math.cos(point.angle),
        );
    }
  }
  return { bossAttack, smallVolley, resizeAttack };
});
