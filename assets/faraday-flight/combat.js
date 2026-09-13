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
      sy = y + r * 0.65,
      warning = easy ? 1 : 0.75,
      aim = Math.atan2(player.y - sy, player.x - x);
    let id, name;
    const shot = (at, bx, by, angle, speed, kind = "orb", extra = {}) =>
      events.push({
        type: "bullet",
        at,
        x: clamp(bx, x - r * 0.75, x + r * 0.75),
        y: clamp(by, y - r * 0.8, y + r * 0.9),
        angle,
        speed,
        kind,
        ...extra,
      });
    const ray = (bx, by, angle, at = warning) =>
      markers.push({
        kind: "ray",
        x: clamp(bx, x - r * 0.75, x + r * 0.75),
        y: by,
        angle,
        start: Math.max(0, at - warning),
        end: at,
      });
    const beam = (at, bx, targetX) =>
      events.push({
        type: "beam",
        at,
        x: clamp(bx, x - r * 0.75, x + r * 0.75),
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
        const gap = [1, 4, 2][Math.floor(volley / 2) % 3],
          columns = easy ? 9 : 12 + phase * 2,
          spacing = (W - 80) / (columns - 1),
          rows = easy ? 2 : phase === 2 ? 4 : 3;
        for (let row = 0; row < rows; row++)
          for (let col = 0; col < columns; col++) {
            if (col === gap || col === gap + 1) continue;
            const bx = x + (col < columns / 2 ? -1 : 1) * r * 0.65,
              angle = Math.atan2(
                Math.max(180 * scale, H * 0.72 - sy),
                40 + col * spacing - bx,
              ),
              at = warning + row * 0.65;
            shot(at, bx, sy, angle, 125 + phase * 8, "ink");
          }
      } else {
        id = "binding-staples";
        name = "제본못 두 줄";
        const targetX = clamp(player.x, 95, W - 95);
        for (const side of [-1, 1]) {
          const bx = x + side * 28 * scale,
            angle = Math.atan2(
              Math.max(130 * scale, player.y - sy),
              targetX + side * 42 - bx,
            );
          ray(bx, sy, angle);
          for (let n = 0; n < (easy ? 3 : 5 + phase); n++)
            for (const offset of easy ? [0] : [-0.22, 0, 0.22])
              shot(warning + n * 0.22, bx, sy, angle + offset, 153, "needle");
        }
      }
    } else if (stage === 1) {
      if (volley % 2 === 0) {
        id = "closing-gates";
        name = "닫혀 오는 문";
        const targetY = Math.max(sy + 160 * scale, H * 0.72),
          count = easy ? 4 : 5 + phase;
        for (const side of [-1, 1]) {
          const bx = x + side * r * 0.7,
            angle = Math.atan2(targetY - sy, x - side * W * 0.32 - bx);
          ray(bx, sy, angle);
          for (let n = 0; n < count; n++)
            for (const offset of easy ? [-0.12, 0.12] : [-0.2, 0, 0.2])
              shot(
                warning + n * 0.24,
                bx,
                sy,
                angle + offset,
                143 + phase * 5,
                "shard",
              );
        }
      } else {
        id = "keyhole-burst";
        name = "열쇠구멍 속사";
        ray(x, sy, aim);
        for (let n = 0; n < (easy ? 5 : 8 + phase * 2); n++)
          for (const offset of easy ? [-0.17, 0.17] : [-0.24, 0, 0.24])
            shot(warning + n * 0.16, x, sy, aim + offset, 171, "needle");
      }
    } else if (stage === 2) {
      if (volley % 2 === 0) {
        id = "compass-spiral";
        name = "회전하는 기호";
        const count = easy ? 10 : 16 + phase * 3,
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
          if (!easy)
            shot(
              warning + n * 0.14,
              x,
              sy,
              PI / 2 + Math.sin(n * 0.5) * 0.65,
              118,
              "glyph",
            );
        }
      } else {
        id = "coordinate-cross";
        name = "교차하는 좌표";
        const left = x - r * 0.7,
          right = x + r * 0.7,
          dy = Math.max(140 * scale, H * 0.6 - sy);
        for (const [bx, tx] of [
          [left, W * 0.86],
          [right, W * 0.14],
        ]) {
          const angle = Math.atan2(dy, tx - bx);
          ray(bx, sy, angle);
          for (let n = 0; n < (easy ? 5 : 7 + phase * 2); n++)
            for (const offset of easy ? [0] : [-0.18, 0, 0.18])
              shot(warning + n * 0.2, bx, sy, angle + offset, 150, "glyph");
        }
      }
    } else if (stage === 3) {
      const turn = volley % 3;
      if (turn === 0) {
        id = "induction-discharge";
        name = "유도 방전";
        beam(0, x, player.x);
        if (phase > 0 && !easy)
          beam(0, x, player.x < W / 2 ? W * 0.75 : W * 0.25);
      } else if (turn === 1) {
        id = "split-sparks";
        name = "갈라지는 불꽃";
        const count = easy ? 3 : 5 + phase;
        for (let i = 0; i < count; i++) {
          const angle = PI / 2 + (i - (count - 1) / 2) * 0.3;
          ray(x, sy, angle);
          for (let row = 0; row < (easy ? 1 : 2); row++)
            shot(
              warning + row * 0.8,
              x,
              sy,
              angle + row * 0.1,
              112 + phase * 8,
              "split",
            );
        }
      } else {
        id = "alternating-terminals";
        name = "양쪽 단자 방전";
        beam(0, x - 40 * scale, W * 0.3);
        beam(easy ? 2.15 : 1.8, x + 40 * scale, W * 0.7);
      }
      if (turn !== 1) {
        const count = easy ? 5 : 9 + phase * 2;
        for (let row = 0; row < (easy ? 1 : 2); row++)
          for (let i = 0; i < count; i++)
            shot(
              warning + row * 0.75,
              x,
              sy,
              0.35 + (i * (PI - 0.7)) / (count - 1),
              122,
              "orb",
            );
      }
    } else {
      if (volley % 2 === 0) {
        id = "record-echo";
        name = "기록의 메아리";
        for (const side of [-1, 1]) {
          const bx = x + side * r * 0.7,
            angle = Math.atan2(
              Math.max(140 * scale, player.y - sy),
              player.x - bx,
            );
          ray(bx, sy, angle);
          for (let n = 0; n < (easy ? 4 : 9 + phase); n++)
            for (const offset of easy ? [0] : [-0.19, 0, 0.19])
              shot(
                warning + n * 0.25,
                bx,
                sy,
                angle + offset,
                easy ? 160 : 166 + phase * 4,
                "echo",
                {
                  hold: 0.38,
                },
              );
        }
        if (!easy && phase > 0)
          for (let n = 0; n < 8; n++)
            shot(
              warning + 1.15,
              x,
              sy,
              0.4 + (n * (PI - 0.8)) / 7,
              146 + phase * 4,
              "shard",
            );
      } else {
        id = "clock-release";
        name = "멈춘 시계";
        const count = easy ? 18 : 28 + phase * 3,
          gapAngle = PI / 2 + (Math.floor(volley / 2) % 2 ? 0.6 : -0.6),
          ring = r * 0.2;
        markers.push({ kind: "clock", x, y: sy, start: 0, end: warning });
        for (let row = 0; row < (easy ? 2 : 3); row++)
          for (let n = 0; n < count; n++) {
            const turn = easy
                ? 0
                : row * 0.16 * (Math.floor(volley / 2) % 2 ? -1 : 1),
              angle = (2 * PI * n) / count + turn,
              distance = Math.abs(
                Math.atan2(
                  Math.sin(angle - gapAngle - turn),
                  Math.cos(angle - gapAngle - turn),
                ),
              );
            if (distance < (easy ? 0.55 : 0.32)) continue;
            shot(
              warning + row * (easy ? 1.1 : 1),
              x + Math.cos(angle) * ring,
              sy + Math.sin(angle) * ring,
              angle,
              (easy ? 120 : 128) + phase * 10,
              "echo",
              { hold: easy ? 0.95 : 0.7 },
            );
          }
      }
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
      origin: { x, y },
      events,
      markers,
      duration,
      recovery:
        ([1.2, 1.15, 1.1, 1, 0.95][stage] - phase * 0.1) * (easy ? 1.4 : 1),
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
    attack.origin.y *= ratio;
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
