(function () {
  "use strict";
  const TAU = Math.PI * 2,
    ink = "#a3c6c5",
    active = "#ffe6a1";
  function wire(c, points, color = ink, width = 2.5) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
    c.stroke();
  }
  function label(c, value, x, y, size = 17, color = "#cce6df") {
    c.font = size + 'px "Noto Sans KR",sans-serif';
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = color;
    c.fillText(value, x, y);
  }
  function arrow(c, x, y, angle, color = active) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(-5, -4);
    c.lineTo(-5, 4);
    c.closePath();
    c.fill();
    c.restore();
  }
  function node(c, x, y) {
    c.fillStyle = ink;
    c.beginPath();
    c.arc(x, y, 3, 0, TAU);
    c.fill();
  }
  function coil(c, left, right, y, r, turns, width = 2.5) {
    // One continuous helix; the endpoints are the circuit's two actual terminals.
    c.strokeStyle = "#e2b37e";
    c.lineWidth = width;
    c.beginPath();
    for (let i = 0; i <= 600; i++) {
      const t = i / 600,
        a = -Math.PI / 2 + (turns + 0.5) * TAU * t,
        x = left + (right - left) * t + Math.min(9, r * 0.22) * Math.cos(a),
        yy = y + r * Math.sin(a);
      i ? c.lineTo(x, yy) : c.moveTo(x, yy);
    }
    c.stroke();
  }
  function magnet(c, cx, cy, w = 96, h = 29) {
    c.fillStyle = "#70a3d1";
    c.fillRect(cx - w / 2, cy - h / 2, w / 2, h);
    c.fillStyle = "#d67d73";
    c.fillRect(cx, cy - h / 2, w / 2, h);
    c.strokeStyle = "#f2d6b0";
    c.lineWidth = 1.5;
    c.strokeRect(cx - w / 2, cy - h / 2, w, h);
    label(c, "S", cx - w / 4, cy, h * 0.55, "#fff");
    label(c, "N", cx + w / 4, cy, h * 0.55, "#fff");
  }
  function lamp(c, x, y, r, power) {
    // Monotone display mapping preserves differences beyond the old clipped maximum.
    const light = power > 0 ? Math.pow(power / (power + 4), 0.6) : 0;
    if (light > 0.001) {
      const radius = r * (1.5 + light * 1.7);
      const g = c.createRadialGradient(x, y, r * 0.35, x, y, radius);
      g.addColorStop(0, "rgba(255,233,132," + light * 0.95 + ")");
      g.addColorStop(0.35, "rgba(255,211,99," + light * 0.6 + ")");
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      c.fillStyle = "rgba(255,249,194," + light * 0.95 + ")";
      c.beginPath();
      c.arc(x, y, r - 2, 0, TAU);
      c.fill();
      if (light > 0.35)
        for (let i = 0; i < 8; i++) {
          const a = ((i + 0.5) * TAU) / 8,
            inner = r + 7,
            outer = inner + light * 18;
          wire(
            c,
            [
              [x + Math.cos(a) * inner, y + Math.sin(a) * inner],
              [x + Math.cos(a) * outer, y + Math.sin(a) * outer],
            ],
            "rgba(255,225,132," + light + ")",
            1 + light,
          );
        }
    }
    c.strokeStyle = light > 0.01 ? "#fff1a2" : "#5b858b";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.stroke();
    const d = r / Math.sqrt(2);
    wire(
      c,
      [
        [x - d, y - d],
        [x + d, y + d],
      ],
      light > 0.35 ? "#8d6429" : c.strokeStyle,
      2,
    );
    wire(
      c,
      [
        [x - d, y + d],
        [x + d, y - d],
      ],
      light > 0.35 ? "#8d6429" : c.strokeStyle,
      2,
    );
  }
  function diode(c, a, b, on) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    c.save();
    c.translate(...a);
    c.rotate(Math.atan2(dy, dx));
    const m = length / 2,
      col = on ? active : ink;
    wire(
      c,
      [
        [0, 0],
        [m - 10, 0],
      ],
      col,
    );
    wire(
      c,
      [
        [m + 10, 0],
        [length, 0],
      ],
      col,
    );
    c.strokeStyle = col;
    c.fillStyle = on ? "#b38b40" : "#123d47";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(m - 10, -9);
    c.lineTo(m + 10, 0);
    c.lineTo(m - 10, 9);
    c.closePath();
    c.fill();
    c.stroke();
    wire(
      c,
      [
        [m + 10, -10],
        [m + 10, 10],
      ],
      col,
      2,
    );
    if (on) arrow(c, length * 0.83, 0, 0);
    c.restore();
  }
  function draw(canvas, state) {
    const c = canvas.getContext("2d"),
      {
        sample,
        turns = 1,
        tab = 0,
        voltage = 0,
        current = 0,
        flash = 0,
      } = state;
    c.clearRect(0, 0, 680, 400);
    c.fillStyle = "#092936";
    c.fillRect(0, 0, 680, 400);
    const cap = tab === 2,
      left = cap ? 200 : 280,
      right = cap ? 250 : 340,
      y = 155,
      r = 48,
      center = (left + right) / 2;
    const mx = center - (cap ? 62 : 78) * sample.distance,
      stopped = Math.abs(sample.velocity) < 0.015,
      sign = Math.sign(sample.emf),
      charging = current > 0.012;
    label(c, "구리 코일", center, 21, 18, "#e5c396");
    if (cap) {
      const top = [410, 80],
        bottom = [410, 240],
        plus = [495, 160],
        minus = [325, 160];
      wire(c, [[left, y - r], [left, 45], [410, 45], top]);
      wire(c, [[right, y + r], [270, y + r], [270, 280], [410, 280], bottom]);
      // AC input at top/bottom; two cathodes meet at +, two anodes meet at -.
      diode(c, top, plus, charging && sign > 0);
      diode(c, bottom, plus, charging && sign < 0);
      diode(c, minus, bottom, charging && sign > 0);
      diode(c, minus, top, charging && sign < 0);
      [top, bottom, plus, minus].forEach((p) => node(c, ...p));
      label(c, "~", 425, 73, 21, "#a8d9f0");
      label(c, "~", 425, 250, 21, "#a8d9f0");
      label(c, "+", 504, 145, 19, active);
      label(c, "−", 313, 145, 19, active);
      wire(c, [plus, [530, 160], [530, 110], [590, 110], [590, 155]]);
      wire(c, [minus, [305, 160], [305, 310], [590, 310], [590, 177]]);
      // Wire crossing with a visible bridge: the AC lead is NOT connected to the DC return.
      c.fillStyle = "#092936";
      c.fillRect(294, 270, 22, 15);
      wire(c, [
        [305, 266],
        [305, 288],
      ]);
      for (const [color, width] of [
        ["#092936", 7],
        [ink, 2.5],
      ]) {
        c.strokeStyle = color;
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(292, 280);
        c.lineTo(295, 280);
        c.bezierCurveTo(295, 267, 315, 267, 315, 280);
        c.lineTo(318, 280);
        c.stroke();
      }
      wire(
        c,
        [
          [568, 155],
          [612, 155],
        ],
        "#e0fff0",
        4,
      );
      wire(
        c,
        [
          [568, 177],
          [612, 177],
        ],
        "#e0fff0",
        4,
      );
      label(c, "+", 554, 150, 16, active);
      label(c, "−", 554, 183, 16, active);
      label(c, "축전기", 577, 218, 16, "#ffdfa4");
      // Switched load parallel to the capacitor, never across its dielectric.
      wire(c, [
        [590, 110],
        [645, 110],
        [645, 181],
      ]);
      wire(c, [
        [645, 215],
        [645, 248],
      ]);
      wire(c, [
        [645, 276],
        [645, 310],
        [590, 310],
      ]);
      wire(
        c,
        [
          [645, 181],
          [flash > 0 ? 645 : 661, flash > 0 ? 215 : 207],
        ],
        flash > 0 ? active : ink,
      );
      node(c, 645, 181);
      node(c, 645, 215);
      node(c, 590, 110);
      node(c, 590, 310);
      lamp(c, 645, 262, 14, flash > 0 ? (voltage * voltage) / 4 : 0);
      if (charging) {
        arrow(c, 559, 110, 0);
        arrow(c, 492, 310, Math.PI);
      }
      label(c, "정류기 · 다이오드 4개", 410, 347, 18, "#f1d6a3");
      label(c, "전류가 흐르는 다이오드만 밝게", 410, 372, 13, "#a5c5c4");
      c.fillStyle = "#204b4d";
      c.fillRect(552, 245, 57, 8);
      c.fillStyle = "#a9f2cc";
      c.fillRect(552, 245, 57 * Math.min(1, voltage / 2.2), 8);
      label(
        c,
        flash > 0
          ? "사용 중"
          : voltage < 0.02
            ? "비어 있음"
            : charging
              ? "충전 중"
              : "저장됨",
        578,
        276,
        13,
      );
    } else {
      wire(c, [
        [left, y - r],
        [left, 52],
        [540, 52],
        [540, 124],
      ]);
      wire(c, [
        [540, 186],
        [540, 294],
        [right, 294],
        [right, y + r],
      ]);
      lamp(c, 540, 155, 31, (sample.emf * sample.emf) / 4);
      if (Math.abs(sample.emf) > 0.02) {
        arrow(c, 438, 52, sign > 0 ? 0 : Math.PI, "#afe3f3");
        arrow(c, 438, 294, sign > 0 ? Math.PI : 0, "#afe3f3");
      }
      label(c, "전구", 596, 155, 18);
      label(c, "두 끝을 이어 만든 닫힌 회로", 443, 328, 17);
      label(
        c,
        stopped
          ? "자석이 멈추면 유도 전압 0"
          : "넣을 때 ↔ 뺄 때, 전류 방향이 바뀌어요",
        340,
        371,
        19,
        "#f1d6a3",
      );
    }
    coil(c, left, right, y, r, 4 * turns);
    magnet(c, mx, y);
    wire(
      c,
      [
        [55, y + 82],
        [center - 22, y + 82],
      ],
      "#517f88",
      1.2,
    );
    if (!stopped) arrow(c, mx, y + 82, sample.velocity < 0 ? 0 : Math.PI);
    label(
      c,
      stopped ? "멈춤" : sample.velocity < 0 ? "넣기 →" : "← 빼기",
      cap ? 124 : 180,
      y + 113,
      16,
      "#efd1a0",
    );
    if (cap) label(c, "자석 왕복", 116, 335, 17);
  }
  function miniature(c, x, y, phase, turns) {
    c.save();
    c.translate(x, y);
    c.fillStyle = "#082837d9";
    c.beginPath();
    c.roundRect(-42, -30, 102, 61, 8);
    c.fill();
    const sample = window.FaradayPhysics.movingInductionSample(
      1,
      1,
      1,
      3,
      phase,
    );
    coil(c, 8, 30, 0, 15, Math.min(5, turns), 0.9);
    magnet(c, 18 - 17 * sample.distance, 0, 29, 10);
    c.restore();
  }
  window.FaradayInductionDiagram = { draw, miniature };
})();
