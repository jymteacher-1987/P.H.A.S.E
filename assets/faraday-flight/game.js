(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    P = window.FaradayPhysics,
    L = window.FaradayLevels.levels,
    U = window.FaradayLevels,
    atlas = window.FaradaySprites;
  const canvas = $("gameCanvas"),
    ctx = canvas.getContext("2d"),
    deck = $("flightDeck"),
    audio = new window.FlightAudio();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp = (a, b, t) => a + (b - a) * t,
    clone = (v) => JSON.parse(JSON.stringify(v)),
    fmt = (v) => Math.floor(v).toLocaleString("ko-KR");
  const SAVE_KEY = "phase-faraday-flight-v1",
    IMAGES = {},
    keys = new Set(),
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let save = {
      best: 0,
      unlocked: 0,
      stars: Array(L.length).fill(0),
      checkpoint: null,
      sound: true,
      volume: 0.45,
      mode: "normal",
      notes: [],
    },
    storageOK = true;
  function validBuild(b) {
    const result = {};
    for (const u of U.upgrades)
      result[u.id] = clamp(Math.floor(Number(b?.[u.id]) || 0), 0, u.max);
    return result;
  }
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (data && typeof data === "object") {
      save.best = clamp(Number(data.best) || 0, 0, 999999999);
      save.unlocked = clamp(
        Math.floor(Number(data.unlocked) || 0),
        0,
        L.length - 1,
      );
      save.stars = Array.from({ length: L.length }, (_, i) =>
        clamp(Math.floor(Number(data.stars?.[i]) || 0), 0, 3),
      );
      save.sound = data.sound !== false;
      save.volume = clamp(
        Number.isFinite(Number(data.volume)) ? Number(data.volume) : 0.45,
        0,
        1,
      );
      save.mode = data.mode === "easy" ? "easy" : "normal";
      save.notes = Array.isArray(data.notes)
        ? data.notes.filter((n) => ["coil", "magnet", "capacitor"].includes(n))
        : [];
      const c = data.checkpoint;
      if (c && Number.isInteger(c.stage) && c.stage >= 0 && c.stage < L.length)
        save.checkpoint = {
          stage: c.stage,
          build: validBuild(c.build),
          score: clamp(Number(c.score) || 0, 0, 99999999),
          wing: clamp(Number(c.wing) || 1, 1, 8),
          mode: c.mode === "easy" ? "easy" : "normal",
          magnetLevel: clamp(Number(c.magnetLevel) || 0, 0, 6),
          pulseCharges: clamp(Number(c.pulseCharges) || 0, 0, 3),
        };
    }
  } catch {
    storageOK = false;
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      storageOK = false;
    }
  }
  let manualClock = false;
  let W = 480,
    H = 780,
    scale = 1,
    dpr = 1,
    time = 0,
    last = 0,
    accumulator = 0,
    mode = "loading",
    stage = 0,
    level = L[0],
    difficulty = save.mode;
  let build = validBuild({}),
    entry = null,
    score = 0,
    wing = 1,
    collected = 0,
    combo = 0,
    comboTimer = 0,
    fever = 0,
    feverTime = 0,
    stageTime = 0,
    waveClock = 1,
    waveIndex = 0,
    pickupClock = 4,
    bossStarted = false,
    finishClock = 0;
  let enemies = [],
    shots = [],
    bullets = [],
    pickups = [],
    beams = [],
    effects = [],
    particles = [],
    texts = [],
    surfaces = [],
    player = null,
    beamId = 0,
    seed = 4421,
    shake = 0,
    hitStop = 0,
    messageTime = 0,
    shootTimer = 0,
    friendTimer = 0,
    uiClock = 0;
  let rotorAngle = 0,
    magnetLevel = 0,
    heatTime = 0,
    pulseCharges = 1,
    charge = 0,
    pulseLinks = [];
  let stats = {
      kills: 0,
      spawned: 0,
      damage: 0,
      pulses: 0,
      perfect: 0,
      stars: 0,
    },
    runStats = { pulses: 0, perfect: 0 },
    pointer = {
      id: null,
      active: false,
      x: 240,
      y: 600,
      offsetX: 0,
      offsetY: 0,
    },
    modalOrigin = "title",
    lastFocus = null,
    journalTab = 0,
    loadPromise;
  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function setMode(value) {
    mode = value;
    document.body.dataset.mode = value;
  }
  function maxHP() {
    return (difficulty === "easy" ? 7 : 5) + build.heart;
  }
  function generator() {
    return P.inductionSample(
      1 + (wing - 1 + build.spread) * 0.16,
      (1 + magnetLevel * 0.16 + build.power * 0.15) * (heatTime > 0 ? 0.6 : 1),
      1,
      3 + build.rapid * 0.45,
      rotorAngle,
    );
  }
  function cooldown() {
    return 100;
  }
  function resize() {
    const oldH = H,
      rect = deck.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    H = clamp((W * rect.height) / Math.max(1, rect.width), 220, 1100);
    scale = clamp(H / 760, 0.64, 1);
    if (player) {
      const ratio = H / oldH;
      player.y *= ratio;
      pointer.y *= ratio;
      for (const list of [enemies, shots, bullets, pickups, particles, texts])
        for (const e of list) e.y *= ratio;
      for (const b of beams) {
        b.origin.y *= ratio;
        b.target.y *= ratio;
        b.direction = P.normalize({
          x: b.target.x - b.origin.x,
          y: b.target.y - b.origin.y,
        });
      }
      setupSurfaces();
    }
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(deck);
  else window.addEventListener("resize", resize);
  resize();
  audio.enabled = save.sound;
  audio.volume = save.volume;
  function updateSoundUI() {
    const text = save.sound ? "♪ 소리 켬" : "♪ 소리 끔";
    $("titleSound").textContent = text;
    $("soundBtn").textContent = save.sound ? "♪" : "♩";
    $("soundBtn").setAttribute(
      "aria-label",
      save.sound ? "소리 끄기" : "소리 켜기",
    );
    $("soundBtn").title = save.sound ? "소리 끄기" : "소리 켜기";
  }
  function toggleSound() {
    save.sound = !save.sound;
    audio.setEnabled(save.sound);
    if (mode !== "play") audio.pause();
    persist();
    updateSoundUI();
    const b = $("pauseSound");
    if (b) b.textContent = save.sound ? "♪ 소리 켬" : "♪ 소리 끔";
  }
  function updateSide() {
    $("bestScore").textContent = fmt(save.best);
    const done = save.stars.filter(Boolean).length;
    $("recordCaption").textContent = done
      ? done + "개의 하늘을 날았어요"
      : "첫 비행을 기다리고 있어요";
    $("sideStages").innerHTML = L.map(
      (l, i) =>
        '<div class="stage-row ' +
        (save.stars[i] ? "finished " : "") +
        (i === stage ? "active" : "") +
        '"><b>' +
        String(i + 1).padStart(2, "0") +
        "</b><span>" +
        l.name +
        '</span><span class="dots">' +
        (save.stars[i] ? "✦".repeat(save.stars[i]) : l.boss ? "◇" : "·") +
        "</span></div>",
    ).join("");
  }
  function say(text, duration = 3, big = false) {
    $("message").textContent = text;
    $("message").className = "message visible" + (big ? " big" : "");
    messageTime = duration;
    $("statusAnnouncer").textContent = text;
  }
  function burst(x, y, color, count = 14, speed = 130) {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2,
        v = speed * (0.3 + random() * 0.7);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.3 + random() * 0.5,
        max: 0.8,
        r: 1.2 + random() * 2.5,
        color,
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }
  function floatText(x, y, text, color = "#f9edb5", size = 17) {
    texts.push({ x, y, text, color, size, life: 1.2, max: 1.2 });
  }
  function effectRing(x, y, color, size = 65) {
    effects.push({ type: "ring", x, y, color, size, life: 0.5, max: 0.5 });
  }
  function checkpoint() {
    save.checkpoint = {
      stage,
      build: clone(build),
      score,
      wing,
      mode: difficulty,
      magnetLevel,
      pulseCharges,
    };
    entry = clone(save.checkpoint);
    persist();
  }
  function newFlight(index = 0, restore = null) {
    closeModal(false);
    difficulty = restore?.mode || save.mode;
    stage = index;
    build = validBuild(restore?.build);
    score = restore?.score || 0;
    wing = restore?.wing || 1;
    magnetLevel = restore?.magnetLevel || 0;
    pulseCharges = restore ? clamp(restore.pulseCharges ?? 1, 0, 3) : 1;
    runStats = { pulses: 0, perfect: 0 };
    startStage(index);
  }
  function startStage(index) {
    closeModal(false);
    stage = index;
    level = L[index];
    stageTime = 0;
    charge = 0;
    heatTime = 0;
    pulseLinks = [];
    rotorAngle = 0;
    waveClock = 1.1;
    waveIndex = 0;
    pickupClock = 3;
    bossStarted = false;
    finishClock = 0;
    enemies = [];
    shots = [];
    bullets = [];
    pickups = [];
    beams = [];
    effects = [];
    particles = [];
    texts = [];
    combo = 0;
    comboTimer = 0;
    fever = 0;
    feverTime = 0;
    collected = 0;
    shake = 0;
    hitStop = 0;
    shootTimer = 0;
    friendTimer = 0;
    seed = 4421 + stage * 1987;
    stats = {
      kills: 0,
      spawned: 0,
      damage: 0,
      pulses: 0,
      perfect: 0,
      stars: 0,
    };
    player = {
      x: W / 2,
      y: H * 0.78,
      hp: maxHP(),
      r: 9 * scale,
      inv: 2,
      shield: 0,
      tilt: 0,
    };
    if (stage === 0)
      pickups.push({
        x: W / 2,
        y: H * 0.45,
        kind: "power",
        age: 0,
        vy: 85 * scale,
      });
    pointer.active = false;
    pointer.id = null;
    pointer.x = player.x;
    pointer.y = player.y;
    keys.clear();
    setupSurfaces();
    checkpoint();
    $("startScreen").hidden = true;
    $("hud").hidden = false;
    $("playControls").hidden = false;
    $("bossHud").hidden = true;
    $("stageNumber").textContent =
      "STAGE " + String(stage + 1).padStart(2, "0") + " / " + L.length;
    $("stageName").textContent = level.name;
    setMode("play");
    audio.stage = stage;
    audio.boss = false;
    audio.start();
    say(level.intro, 3.2, true);
    updateHUD();
    updateSide();
    canvas.focus?.();
  }
  function setupSurfaces() {
    surfaces = [];
  }
  function usePulse() {
    if (mode !== "play" || !player || pulseCharges < 1 || player.shield > 0.02)
      return false;
    const perfect = beams.some(
      (b) =>
        !b.fired &&
        b.source.hp > 0 &&
        b.delay - b.age < 0.36 &&
        b.delay - b.age > 0,
    );
    pulseCharges--;
    stats.pulses++;
    runStats.pulses++;
    if (perfect) {
      stats.perfect++;
      runStats.perfect++;
      score += 350;
    }
    player.shield = 0.7;
    player.inv = Math.max(player.inv, 0.8);
    pulseLinks = [];
    const targets = enemies
        .filter((e) => e.hp > 0 && e.y > -15 && e.y < H)
        .sort((a, b) => a.y - b.y),
      damage =
        (perfect ? 53 : 38) *
        (1 + build.resonance * 0.35) *
        (1 + magnetLevel * 0.09);
    for (const e of targets) {
      pulseLinks.push({
        a: { x: player.x, y: player.y - 20 * scale },
        b: { x: e.x, y: e.y },
        life: 0.58,
      });
      damageEnemy(e, damage, true);
    }
    for (const b of bullets) burst(b.x, b.y, "#ffe4a6", 3, 65);
    bullets = [];
    beams = [];
    fever = Math.min(100, fever + (perfect ? 20 : 10));
    audio.effect(perfect ? "perfect" : "counter");
    effectRing(player.x, player.y, "#ffdbae", Math.max(W, H));
    burst(player.x, player.y, "#c3ffff", 36, 260);
    floatText(
      player.x,
      player.y - 68 * scale,
      perfect ? "PERFECT PULSE!" : "SPARK STORM!",
      "#ffe6a7",
      perfect ? 29 : 24,
    );
    shake = reduced ? 0 : 5;
    hitStop = 0.06;
    if (!save.notes.includes("capacitor")) {
      save.notes.push("capacitor");
      persist();
      say("축전기에 모아둔 전기를 한 번에!", 2.2);
    }
    updateHUD();
    return true;
  }
  function addEnemy(kind, x, y, pattern = "straight", extra = {}) {
    const baseHP = [2, 7, 4][kind] * (1 + stage * 0.15);
    const e = {
      id: ++beamId,
      kind,
      x,
      y,
      baseX: x,
      vx: 0,
      vy: (48 + stage * 2 + kind * 5) * level.speed * scale,
      age: 0,
      phase: random() * 6.28,
      r: (kind === 1 ? 22 : 17) * scale,
      hp: baseHP,
      maxHP: baseHP,
      shoot: 1.8 + random() * 1.2,
      pattern,
      flash: 0,
      beamClock: 3 + random() * 2,
      boss: false,
      ...extra,
    };
    enemies.push(e);
    stats.spawned++;
    return e;
  }
  function spawnWave() {
    const pattern = level.patterns[waveIndex % level.patterns.length],
      n = stage === 0 ? 4 : 5;
    waveIndex++;
    if (pattern === "turret") {
      const x = [120, 360, 240][waveIndex % 3];
      addEnemy(1, x, -40, "turret", { targetY: H * 0.22, vy: 80 * scale });
      if (stage > 2) {
        addEnemy(0, x - 65, -85, "sine");
        addEnemy(0, x + 65, -85, "sine");
      }
      return;
    }
    if (pattern === "gate") {
      const gap = waveIndex % 2 ? 150 : 330;
      for (let i = 0; i < 6; i++) {
        const x = 45 + i * 78;
        if (Math.abs(x - gap) < 60) continue;
        addEnemy(i % 3 === 0 ? 1 : 0, x, -30 - i * 8, "straight");
      }
      return;
    }
    if (pattern === "spiral") {
      for (let i = 0; i < 5; i++)
        addEnemy(i % 2 ? 2 : 0, 80 + i * 80, -35 - i * 30, "sine", {
          phase: i * 0.8,
          vy: 63 * scale,
        });
      return;
    }
    if (pattern === "swarm") {
      for (let i = 0; i < 7; i++)
        addEnemy(0, 60 + i * 60, -30 - Math.abs(i - 3) * 25, "sine", {
          hp: 1.8,
          maxHP: 1.8,
          vy: 80 * scale,
          shoot: 8,
        });
      return;
    }
    for (let i = 0; i < n; i++) {
      const x =
        pattern === "sine" ? 75 + i * 78 : W / 2 + (i - (n - 1) / 2) * 65;
      addEnemy(
        stage > 2 && i === 2 ? 2 : 0,
        x,
        -35 - (pattern === "vee" ? Math.abs(i - (n - 1) / 2) * 40 : i * 18),
        pattern,
        { phase: waveIndex * 0.7, shoot: stage === 0 ? 4.8 : 2.3 + random() },
      );
    }
  }
  function spawnBoss() {
    bossStarted = true;
    audio.boss = true;
    bullets = [];
    beams = [];
    for (const e of enemies) e.hp = 0;
    const hp = level.bossHP * (difficulty === "easy" ? 0.82 : 1);
    const e = addEnemy(2, W / 2, -110, "boss", {
      boss: true,
      r: 42 * scale,
      hp,
      maxHP: hp,
      shoot: 2.4,
      beamClock: 2.8,
      vy: 155 * scale,
      baseX: W / 2,
      phase: 0,
      entered: false,
      supply: 7,
      supplyCount: 0,
    });
    $("bossHud").hidden = false;
    $("bossName").textContent = level.boss;
    say(
      level.boss +
        "\n" +
        [
          "주먹탄 사이로 날아요!",
          "문이 열릴 때 집중 공격!",
          "넓어지는 틈으로 날아요!",
          "충전 공격을 폭풍으로 끊어요!",
          "마지막 기록을 지켜라!",
        ][stage],
      2.4,
      true,
    );
    audio.effect("warning");
    return e;
  }
  function shoot() {
    if (!player) return;
    const lanes =
        wing >= 8
          ? 5
          : clamp(1 + Math.floor((wing - 1) / 2) + build.spread, 1, 5),
      damage =
        (1 + (wing - 1) * 0.08 + build.power * 0.25 + magnetLevel * 0.17) *
        (heatTime > 0 ? 0.7 : 1) *
        (feverTime > 0 ? 1.35 : 1);
    for (let i = 0; i < lanes; i++) {
      const offset = i - (lanes - 1) / 2;
      shots.push({
        x: player.x + offset * 11 * scale,
        y: player.y - 27 * scale,
        vx: offset * (wing >= 4 ? 44 : 25),
        vy: -560 * scale,
        r: 3.5 * scale,
        damage,
        life: 2,
        homing: wing >= 6 && Math.abs(offset) > 0,
        heavy: wing >= 8 && offset === 0,
      });
    }
    if (feverTime > 0) {
      for (const s of [-1, 1])
        shots.push({
          x: player.x + s * 14,
          y: player.y - 20,
          vx: s * 115,
          vy: -550 * scale,
          r: 4 * scale,
          damage: damage * 0.7,
          life: 2,
        });
    }
    audio.effect("shot");
  }
  function enemyBullet(e, angle, speed = 95) {
    const slow = difficulty === "easy" ? 0.72 : 1;
    bullets.push({
      x: e.x,
      y: e.y + e.r,
      vx: Math.cos(angle) * speed * level.speed * scale * slow,
      vy: Math.sin(angle) * speed * level.speed * scale * slow,
      r: (e.boss ? 5.5 : 4.8) * scale,
      color: e.kind === 2 ? "#ffad89" : "#fa92c3",
      life: 10,
    });
  }
  function launchBeam(e, offset = 0) {
    const origin = { x: e.x, y: e.y + e.r + 3 },
      target = { x: clamp(player.x + offset, 15, W - 15), y: player.y },
      direction = P.normalize({
        x: target.x - origin.x,
        y: target.y - origin.y,
      });
    beams.push({
      id: ++beamId,
      source: e,
      origin,
      target,
      direction,
      age: 0,
      delay: difficulty === "easy" ? 1.7 : 1.4,
      duration: 0.32,
      fired: false,
      path: null,
      perfect: false,
    });
    audio.effect("warning");
  }
  function fireBeam(b) {
    if (b.source.hp <= 0) return;
    b.fired = true;
    const targets = [
      { x: player.x, y: player.y, r: player.r + 3, kind: "player" },
    ];
    b.path = P.trace(b.origin, b.direction, [], targets, 1800, 0);
    if (b.path.hit?.kind === "player") hurt();
  }
  function damageEnemy(e, damage, counter = false) {
    if (e.hp <= 0 || (e.boss && !e.entered)) return;
    if (e.boss && e.armorClosed && !counter) damage *= 0.22;
    if (counter) {
      e.openUntil = e.age + 2;
      e.armorClosed = false;
    }
    e.hp -= damage;
    e.flash = 0.075;
    if (e.hp <= 0) {
      stats.kills++;
      score +=
        (e.boss ? 2500 : e.kind === 1 ? 90 : 35) *
        (1 + Math.min(3, Math.floor(combo / 10)) * 0.5);
      burst(
        e.x,
        e.y,
        e.boss ? "#ffd697" : e.kind === 0 ? "#bc9bfa" : "#85e6f8",
        e.boss ? 70 : 14,
        e.boss ? 260 : 125,
      );
      effectRing(e.x, e.y, e.boss ? "#fff0b2" : "#b2eff3", e.boss ? 190 : 45);
      audio.effect(e.boss ? "clear" : "kill");
      if (e.boss) {
        finishClock = 1.8;
        for (let i = 0; i < 22; i++)
          pickups.push({
            x: e.x + (random() - 0.5) * 170,
            y: e.y + (random() - 0.5) * 75,
            kind: "star",
            age: 0,
            vy: 70 * scale,
          });
        beams = [];
        bullets = [];
        shake = reduced ? 0 : 9;
      } else {
        const count = level.bonus ? 3 : e.kind === 1 ? 3 : 1;
        for (let i = 0; i < count; i++)
          pickups.push({
            x: e.x + (i - (count - 1) / 2) * 14,
            y: e.y,
            kind: "star",
            age: 0,
            vy: 85 * scale,
          });
        if (stats.kills % 5 === 0)
          pickups.push({
            x: e.x,
            y: e.y - 20,
            kind:
              stats.kills % 30 === 0
                ? "heart"
                : stats.kills % 20 === 0
                  ? "capacitor"
                  : stats.kills % 10 === 0
                    ? "magnet"
                    : "power",
            age: 0,
            vy: 63 * scale,
          });
      }
      if (counter)
        floatText(e.x, e.y - 25, "+" + Math.floor(damage), "#ffe5a8", 22);
    }
  }
  function hurt() {
    if (mode !== "play" || player.inv > 0 || feverTime > 0) return;
    player.hp--;
    player.inv = 1.3;
    stats.damage++;
    combo = 0;
    comboTimer = 0;
    fever = Math.max(0, fever - 10);
    if (wing > 1) {
      wing--;
      floatText(
        player.x,
        player.y - 45 * scale,
        "코일 한 겹이 풀렸어요",
        "#ffd2ad",
        16,
      );
      pickups.push({
        x: clamp(player.x + 60, 35, W - 35),
        y: player.y - 130 * scale,
        kind: "power",
        age: 0,
        vy: 45 * scale,
      });
    }
    shake = reduced ? 0 : 6;
    audio.effect("hit");
    burst(player.x, player.y, "#ffc2bb", 18, 130);
    if (player.hp <= 0) failStage();
  }
  function collect(item) {
    item.dead = true;
    stats.stars += item.kind === "star" ? 1 : 0;
    if (item.kind !== "heat") audio.effect("collect");
    switch (item.kind) {
      case "star":
        combo++;
        comboTimer = 2.6;
        collected++;
        fever = Math.min(100, fever + (level.bonus ? 2.6 : 2));
        score += Math.round(
          20 *
            (1 + Math.min(4, Math.floor(combo / 8)) * 0.5) *
            (1 + build.magnet * 0.1),
        );
        if (combo % 10 === 0)
          floatText(
            player.x,
            player.y - 48 * scale,
            combo + " COMBO",
            "#ffe4ac",
            21,
          );
        break;
      case "power":
        wing = Math.min(8, wing + 1);
        score += 100;
        floatText(
          player.x,
          player.y - 50 * scale,
          wing >= 8
            ? "최대 코일!"
            : wing === 6
              ? "추적 미사일 장착!"
              : wing === 4
                ? "확산 미사일 장착!"
                : "코일 +1 · 미사일 강화",
          "#fff1b7",
          20,
        );
        audio.effect("level");
        if (!save.notes.includes("coil")) {
          save.notes.push("coil");
          persist();
          say("코일을 더 감으면 유도 전압이 커져요", 2.4);
        }
        break;
      case "magnet":
        magnetLevel = Math.min(6, magnetLevel + 1);
        score += 100;
        floatText(
          player.x,
          player.y - 50 * scale,
          "자석 강화 · 피해 증가!",
          "#ffc9a6",
          20,
        );
        if (!save.notes.includes("magnet")) {
          save.notes.push("magnet");
          persist();
          say("더 강한 자석 · 같은 회전에서 더 큰 유도 전압", 2.6);
        }
        break;
      case "capacitor":
        pulseCharges = Math.min(3, pulseCharges + 1);
        score += 80;
        floatText(
          player.x,
          player.y - 50 * scale,
          "충전된 축전기 +1",
          "#b4f7ff",
          20,
        );
        say("스파크 폭풍 준비! SPACE / ϟ 버튼", 2.2);
        break;
      case "heart":
        player.hp = Math.min(maxHP(), player.hp + 2);
        floatText(player.x, player.y - 50 * scale, "체력 +2", "#ffc1bc", 20);
        break;
      case "heat":
        heatTime = 7;
        audio.effect("hit");
        floatText(
          player.x,
          player.y - 50 * scale,
          "자석 과열! 7초간 출력 감소",
          "#ffad99",
          19,
        );
        say("뜨거운 파편을 피해요 · 열은 자석을 약하게 할 수 있어요", 2.5);
        break;
      case "coolant":
        heatTime = 0;
        floatText(player.x, player.y - 50 * scale, "냉각 완료!", "#b0f1ff", 19);
        break;
    }
    burst(
      item.x,
      item.y,
      item.kind === "heat"
        ? "#ff846c"
        : item.kind === "heart"
          ? "#ffb8b8"
          : "#f7e1a2",
      6,
      60,
    );
  }
  function update(dt) {
    time += dt;
    if (typeof noteSpeed !== "undefined") noteAngle += noteSpeed * 3 * dt;
    if (mode !== "play") {
      animateEffects(dt);
      return;
    }
    if (hitStop > 0) {
      hitStop -= dt;
      return;
    }
    stageTime += dt;
    rotorAngle += (3 + build.rapid * 0.45) * dt;
    heatTime = Math.max(0, heatTime - dt);
    const g = generator();
    if (pulseCharges < 3) {
      charge += Math.abs(g.emf) * 1.55 * (1 + build.cooldown * 0.2) * dt;
      if (charge >= 100) {
        charge -= 100;
        pulseCharges++;
        audio.effect("level");
        floatText(
          player.x,
          player.y - 45 * scale,
          "축전기 충전 완료",
          "#b6f8ef",
          16,
        );
      }
    } else charge = Math.min(charge, 99);
    for (const link of pulseLinks) link.life -= dt;
    pulseLinks = pulseLinks.filter((l) => l.life > 0);
    audio.stage = stage;
    player.inv = Math.max(0, player.inv - dt);
    player.shield = Math.max(0, player.shield - dt);
    shake = Math.max(0, shake - dt * 22);
    if (messageTime > 0) {
      messageTime -= dt;
      if (messageTime <= 0) $("message").classList.remove("visible");
    }
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (feverTime > 0) {
      feverTime = Math.max(0, feverTime - dt);
      if (!feverTime) {
        fever = 0;
        say("좋은 비행이었어요!", 1.4);
      }
    } else if (fever >= 100) {
      feverTime = 7;
      audio.effect("fever");
      say("OVERDRIVE!\n7초 동안 더 빠르고 강하게", 2.5, true);
      bullets = [];
      burst(player.x, player.y, "#ffe39d", 40, 230);
    }
    let dx =
        (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) -
        (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0),
      dy =
        (keys.has("ArrowDown") || keys.has("s") ? 1 : 0) -
        (keys.has("ArrowUp") || keys.has("w") ? 1 : 0),
      oldX = player.x;
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      player.x += (dx / n) * 310 * dt;
      player.y += (dy / n) * 310 * scale * dt;
      pointer.active = false;
    } else if (pointer.active) {
      const t = 1 - Math.exp(-18 * dt);
      player.x = lerp(player.x, pointer.x, t);
      player.y = lerp(player.y, pointer.y, t);
    }
    player.x = clamp(player.x, 22, W - 22);
    player.y = clamp(player.y, Math.max(86 * scale, H * 0.2), H - 38 * scale);
    player.tilt = lerp(
      player.tilt,
      clamp((player.x - oldX) * 0.05, -0.3, 0.3),
      0.17,
    );
    shootTimer -= dt;
    if (shootTimer <= 0) {
      shoot();
      shootTimer =
        0.165 * Math.pow(0.88, build.rapid) * (feverTime > 0 ? 0.6 : 1);
    }
    friendTimer -= dt;
    if (build.friend && friendTimer <= 0) {
      for (let i = 0; i < build.friend; i++)
        shots.push({
          x: player.x + (i === 0 ? -52 : 52) * scale,
          y: player.y + 5 * scale,
          vx: i === 0 ? 12 : -12,
          vy: -490 * scale,
          r: 3 * scale,
          damage: 0.65 * (1 + build.power * 0.25),
          life: 2,
        });
      friendTimer = 0.22;
    }
    if (stageTime < level.duration) {
      waveClock -= dt;
      if (waveClock <= 0) {
        spawnWave();
        waveClock = level.rate * (difficulty === "easy" ? 1.1 : 1);
      }
      pickupClock -= dt;
      if (pickupClock <= 0) {
        const x = 75 + random() * 330;
        for (let i = 0; i < (level.bonus ? 9 : 5); i++)
          pickups.push({
            x: x + Math.sin(i * 0.8) * 30,
            y: -20 - i * 27,
            kind: "star",
            age: 0,
            vy: 90 * scale,
          });
        if (stageTime > 7 && stageTime < 12)
          pickups.push({
            x: W / 2,
            y: -10,
            kind: "capacitor",
            age: 0,
            vy: 75 * scale,
          });
        if (stage >= 2 && waveIndex % 2 === 0)
          pickups.push({
            x: 55 + random() * 370,
            y: -45,
            kind: "heat",
            age: 0,
            vy: 58 * scale,
          });
        if (stage >= 3 && waveIndex % 5 === 0)
          pickups.push({
            x: W * 0.5,
            y: -25,
            kind: "coolant",
            age: 0,
            vy: 65 * scale,
          });
        pickupClock = level.bonus ? 2.1 : 6.2;
      }
    } else if (level.boss && !bossStarted) spawnBoss();
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      const charging = beams.some(
        (b) => b.source === e && b.age < b.delay + b.duration,
      );
      if (e.boss) {
        const targetY = Math.max(110 * scale, H * 0.265);
        if (e.y < targetY) e.y = Math.min(targetY, e.y + e.vy * dt);
        else {
          e.entered = true;
          e.supply -= dt;
          if (e.supply <= 0) {
            e.supplyCount++;
            pickups.push({
              x: clamp(e.x + (e.supplyCount % 2 ? 75 : -75), 45, W - 45),
              y: e.y + e.r + 20,
              kind:
                player.hp <= 2
                  ? "heart"
                  : wing < 8
                    ? "power"
                    : e.supplyCount % 2
                      ? "magnet"
                      : "capacitor",
              age: 0,
              vy: 95 * scale,
            });
            e.supply = 8;
          }
          if (!charging) e.x = W / 2 + Math.sin(e.age * 0.62) * 135;
          e.phase = e.hp / e.maxHP < 0.34 ? 2 : e.hp / e.maxHP < 0.67 ? 1 : 0;
          e.armorClosed =
            stage === 1 && e.age % 5 < 2.7 && !(e.openUntil > e.age);
          e.shoot -= dt;
          e.beamClock -= dt;
          if (e.shoot <= 0 && !charging) {
            const count =
              stage === 0
                ? 4
                : stage === 2
                  ? 7 + e.phase
                  : stage === L.length - 1
                    ? 8 + e.phase * 2
                    : 5 + e.phase;
            for (let i = 0; i < count; i++) {
              const angle =
                Math.PI / 2 +
                (i - (count - 1) / 2) * (stage === 2 ? 0.23 : 0.19) +
                Math.sin(e.age) * (stage === 2 ? 0.38 : 0.12);
              enemyBullet(e, angle, 85 + e.phase * 14);
            }
            e.shoot = (stage === L.length - 1 ? 1.55 : 2.15) - e.phase * 0.2;
          }
          if (e.beamClock <= 0 && !charging) {
            launchBeam(e);
            if (stage === 3 && e.phase > 0)
              launchBeam(e, e.phase === 1 ? 95 : -95);
            e.beamClock = stage === 0 ? 7 : stage === L.length - 1 ? 3.9 : 4.8;
          }
        }
      } else if (e.pattern === "turret") {
        if (e.y < e.targetY) e.y += e.vy * dt;
        else if (e.age > 9) e.y += 50 * scale * dt;
        if (level.beams && e.y >= e.targetY && e.age > 1 && !charging) {
          e.beamClock -= dt;
          if (e.beamClock <= 0) {
            launchBeam(e);
            e.beamClock = 4.4;
          }
        }
      } else {
        e.y += e.vy * dt;
        if (e.pattern === "sine")
          e.x = clamp(
            e.baseX + Math.sin(e.age * 1.65 + e.phase) * 38,
            24,
            W - 24,
          );
        else if (e.pattern === "vee")
          e.x = e.baseX + Math.sin(e.age * 0.7) * 12;
      }
      if (
        !e.boss &&
        e.kind !== 1 &&
        e.y > 50 * scale &&
        e.y < player.y - 90 * scale
      ) {
        e.shoot -= dt;
        if (e.shoot <= 0 && !(stage === 0 && stageTime < 9)) {
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          enemyBullet(e, a, stage === 0 ? 75 : 88);
          if (e.kind === 2 && stage > 3) {
            enemyBullet(e, a - 0.25, 84);
            enemyBullet(e, a + 0.25, 84);
          }
          e.shoot = 3.6 + random();
        }
      }
      if (
        Math.hypot(e.x - player.x, e.y - player.y) < e.r + player.r &&
        e.y > 0
      )
        hurt();
      if (e.y > H + 100) e.hp = 0;
    }
    for (const s of shots) {
      if (s.homing) {
        const target = enemies
          .filter((e) => e.hp > 0 && e.y < s.y)
          .sort(
            (a, b) =>
              Math.hypot(a.x - s.x, a.y - s.y) -
              Math.hypot(b.x - s.x, b.y - s.y),
          )[0];
        if (target) {
          const n = P.normalize({ x: target.x - s.x, y: target.y - s.y });
          s.vx = lerp(s.vx, n.x * 480 * scale, 0.06);
          s.vy = lerp(s.vy, n.y * 480 * scale, 0.06);
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let blocked = false;
      for (const surface of surfaces)
        if (P.pointSegmentDistance(s, surface.a, surface.b) < 8 * scale) {
          blocked = true;
          break;
        }
      if (blocked) {
        s.life = 0;
        burst(s.x, s.y, "#b6dbd5", 3, 30);
        continue;
      }
      for (const e of enemies) {
        if (e.hp > 0 && Math.hypot(s.x - e.x, s.y - e.y) < e.r + s.r) {
          damageEnemy(e, s.damage * (s.heavy ? 1.7 : 1));
          if (s.heavy) {
            effectRing(s.x, s.y, "#ffd492", 48 * scale);
            for (const other of enemies)
              if (
                other !== e &&
                Math.hypot(other.x - s.x, other.y - s.y) < 55 * scale
              )
                damageEnemy(other, s.damage * 0.7);
          }
          s.life = 0;
          break;
        }
      }
    }
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (Math.hypot(b.x - player.x, b.y - player.y) < b.r + player.r) {
        if (player.shield > 0) {
          b.life = 0;
          burst(b.x, b.y, "#c7ffe3", 4, 45);
        } else {
          hurt();
          b.life = 0;
        }
      }
    }
    for (const b of beams) {
      b.age += dt;
      if (b.source.hp <= 0 && !b.fired) {
        b.age = b.delay + b.duration + 1;
        continue;
      }
      if (!b.fired && b.age >= b.delay) fireBeam(b);
    }
    for (const item of pickups) {
      item.age += dt;
      const distance = Math.hypot(item.x - player.x, item.y - player.y),
        range = (feverTime > 0 ? 500 : 68 + build.magnet * 35) * scale;
      if (distance < range && item.kind !== "heat") {
        const n = P.normalize({ x: player.x - item.x, y: player.y - item.y });
        const v = 240 + Math.max(0, range - distance) * 3;
        item.x += n.x * v * dt;
        item.y += n.y * v * dt;
      } else item.y += item.vy * dt;
      if (distance < 22 * scale) collect(item);
    }
    enemies = enemies.filter((e) => e.hp > 0);
    shots = shots.filter(
      (s) => s.life > 0 && s.y > -40 && s.x > -30 && s.x < W + 30,
    );
    bullets = bullets.filter(
      (b) => b.life > 0 && b.y < H + 30 && b.x > -30 && b.x < W + 30,
    );
    beams = beams.filter((b) => b.age < b.delay + b.duration);
    pickups = pickups.filter((p) => !p.dead && p.y < H + 40);
    animateEffects(dt);
    if (finishClock > 0) {
      finishClock -= dt;
      if (finishClock <= 0 && mode === "play") clearStage();
    } else if (
      stageTime > level.duration &&
      !level.boss &&
      enemies.length === 0 &&
      mode === "play"
    ) {
      finishClock = 1.3;
      bullets = [];
      beams = [];
    }
    uiClock -= dt;
    if (uiClock <= 0) {
      updateHUD();
      uiClock = 0.08;
    }
  }
  function animateEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.08, dt);
      p.vy *= Math.pow(0.08, dt);
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const t of texts) {
      t.y -= 30 * dt;
      t.life -= dt;
    }
    texts = texts.filter((t) => t.life > 0);
    for (const e of effects) e.life -= dt;
    effects = effects.filter((e) => e.life > 0);
  }
  function updateHUD() {
    if (!player) return;
    $("health").innerHTML = Array.from(
      { length: maxHP() },
      (_, i) =>
        "<span" + (i >= player.hp ? ' class="empty-heart"' : "") + ">♥</span>",
    ).join(" ");
    $("health").setAttribute(
      "aria-label",
      "체력 " + player.hp + " / " + maxHP(),
    );
    $("score").textContent = fmt(score);
    $("stageProgress").style.width =
      Math.min(100, (stageTime / level.duration) * 100) + "%";
    const boss = enemies.find((e) => e.boss);
    if (boss)
      $("bossHealth").style.width =
        Math.max(0, (boss.hp / boss.maxHP) * 100) + "%";
    $("weaponLevel").textContent =
      "GEAR " +
      String(wing).padStart(2, "0") +
      (combo >= 8
        ? "  ×" + (1 + Math.min(4, Math.floor(combo / 8)) * 0.5).toFixed(1)
        : "");
    $("feverBar").style.width =
      (feverTime > 0 ? (feverTime / 7) * 100 : fever) + "%";
    $("feverLabel").textContent =
      feverTime > 0
        ? "OVERDRIVE  " + feverTime.toFixed(1) + "s"
        : "전지를 모아 오버드라이브!";
    const ready = pulseCharges > 0;
    $("pulseBtn").classList.toggle("ready", ready);
    $("pulseBtn").setAttribute("aria-disabled", String(!ready));
    $("pulseLabel").textContent = ready
      ? "폭풍 ×" + pulseCharges
      : Math.floor(charge) + "%";
    $("pulseHint").textContent = ready ? "SPACE / 누르기" : "발전기로 충전 중";
    $("pulseRing").style.strokeDashoffset = String(
      289 * (1 - (ready ? 1 : charge / 100)),
    );
    $("gearStatus").textContent =
      "코일 " +
      wing +
      " · 자석 " +
      (magnetLevel + 1) +
      (heatTime > 0 ? " · 과열 " + heatTime.toFixed(0) + "s" : "");
  }

  function drawSprite(name, index, x, y, size, angle = 0, alpha = 1) {
    const image = IMAGES[name],
      f = atlas[name]?.[index];
    if (!image || !f) return;
    const ratio = size / (f.base || 400);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      image,
      f.x,
      f.y,
      f.w,
      f.h,
      (f.x - f.ax) * ratio,
      (f.y - f.ay) * ratio,
      f.w * ratio,
      f.h * ratio,
    );
    ctx.restore();
  }
  function glow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function pathStroke(segments, color, width, dash = []) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();
    for (const s of segments) {
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function starShape(x, y, r, color, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2,
        rr = i % 2 ? r * 0.32 : r;
      const xx = Math.cos(a) * rr,
        yy = Math.sin(a) * rr;
      i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawWorld() {
    ctx.fillStyle = "#0b4b60";
    ctx.fillRect(0, 0, W, H);
    const world = IMAGES.world;
    if (world) {
      const iw = W,
        ih = (world.height / world.width) * iw,
        offset =
          (time * (mode === "play" ? (feverTime > 0 ? 75 : 22) : 10)) %
          (ih * 2),
        segments = Math.ceil(H / ih) + 3;
      for (let i = -1; i < segments; i++) {
        const y = i * ih + (offset % ih);
        ctx.save();
        if ((i + Math.floor(offset / ih)) % 2 !== 0) {
          ctx.translate(0, y + ih);
          ctx.scale(1, -1);
          ctx.drawImage(world, 0, 0, iw, ih);
        } else ctx.drawImage(world, 0, y, iw, ih);
        ctx.restore();
      }
    }
    const shades = [
      "#062e4428",
      "#33465e3a",
      "#8d43224c",
      "#132d675b",
      "#354a4730",
    ];
    ctx.fillStyle = shades[level?.palette || 0];
    ctx.fillRect(0, 0, W, H);
    if (mode === "play") {
      ctx.fillStyle = "#03253220";
      ctx.fillRect(0, 0, W, H);
      if (stage === 4) {
        for (let j = 0; j < 3; j++) {
          const fy = ((time * 13 + j * H * 0.4) % (H + 160)) - 80;
          const fog = ctx.createLinearGradient(0, fy - 65, 0, fy + 65);
          fog.addColorStop(0, "transparent");
          fog.addColorStop(0.5, "#d1e6e61c");
          fog.addColorStop(1, "transparent");
          ctx.fillStyle = fog;
          ctx.fillRect(0, fy - 65, W, 130);
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = (i * 137.5 + Math.sin(time * 0.15 + i) * 20) % W,
        y = ((i * 89 + time * (18 + (i % 3) * 9)) % (H + 30)) - 15;
      ctx.globalAlpha = 0.16 + (Math.sin(time + i) + 1) * 0.1;
      starShape(x, y, i % 3 === 0 ? 3 : 1.8, "#effff6");
    }
    ctx.globalAlpha = 1;
  }
  function drawGenerator() {
    if (!player || H < 370) return;
    const x = 45,
      y = H - 193 * scale,
      r = 22 * scale;
    ctx.save();
    ctx.fillStyle = "#082837c9";
    ctx.beginPath();
    ctx.roundRect(12, y - r - 13, 91 * scale, 62 * scale, 10);
    ctx.fill();
    ctx.strokeStyle = "#d9a778";
    ctx.lineWidth = 1.6 * scale;
    const turns = 5 + Math.min(6, wing + build.spread);
    for (let i = 0; i < turns; i++) {
      ctx.beginPath();
      ctx.ellipse(
        x + (i - (turns - 1) / 2) * 3 * scale,
        y,
        5 * scale,
        18 * scale,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.translate(x, y);
    ctx.rotate(rotorAngle);
    ctx.fillStyle = heatTime > 0 ? "#ff7c51" : "#df8576";
    ctx.fillRect(-16 * scale, -5 * scale, 16 * scale, 10 * scale);
    ctx.fillStyle = "#70add4";
    ctx.fillRect(0, -5 * scale, 16 * scale, 10 * scale);
    ctx.font = "bold " + 7 * scale + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText("N", -8 * scale, 0);
    ctx.fillText("S", 8 * scale, 0);
    ctx.restore();
    ctx.fillStyle = "#e6c493";
    ctx.font = 8 * scale + "px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("발전 중", 18, y + r + 14 * scale);
    const power = Math.abs(generator().emf);
    glow(82 * scale, y, 7 * scale, "#d8ffb0" + (power > 1.5 ? "b0" : "25"));
  }

  function draw() {
    if ($("noteCanvas")) drawNote();
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawWorld();
    ctx.save();
    if (shake > 0 && !reduced)
      ctx.translate(
        Math.sin(time * 80) * shake,
        Math.cos(time * 110) * shake * 0.65,
      );
    if (mode === "title" || mode === "loading") {
      const landscape = H < 370,
        x = landscape ? W * 0.25 : W * 0.5,
        y = landscape ? H * 0.65 : H * 0.455,
        size = landscape ? 135 : clamp(H * 0.31, 125, 240);
      glow(x, y, size * 0.7, "#72ffe126");
      for (let i = 0; i < 7; i++) {
        const a = time * 0.35 + i * 0.9;
        starShape(
          x + Math.cos(a) * size * 0.72,
          y + Math.sin(a) * size * 0.37,
          4 + (i % 3),
          "#f9e6aacc",
          time * 0.4,
        );
      }
      drawSprite(
        "hero",
        Math.floor(time * 11) % 8,
        x,
        y + Math.sin(time * 1.7) * 7,
        size,
        Math.sin(time * 0.7) * 0.045,
      );
      ctx.restore();
      return;
    }

    for (const b of beams) {
      if (b.source.hp <= 0 && !b.fired) continue;
      if (!b.fired) {
        const route = P.trace(b.origin, b.direction, surfaces, [], 1800, 6);
        const remaining = b.delay - b.age;
        pathStroke(
          route.segments,
          remaining < 0.3 ? "#ffddaabb" : "#ffe59a70",
          remaining < 0.3 ? 2.2 : 1.2,
          [7, 8],
        );
        const end = route.segments[route.segments.length - 1]?.b;
        glow(b.origin.x, b.origin.y, 17 + b.age * 12, "#ffe79388");
        ctx.strokeStyle = "#ffd88f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          b.origin.x,
          b.origin.y,
          18 * scale,
          -Math.PI / 2,
          -Math.PI / 2 + (b.age / b.delay) * Math.PI * 2,
        );
        ctx.stroke();
        if (remaining < 0.5) {
          ctx.fillStyle = "#ffedb9";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", b.origin.x, b.origin.y + 4);
        }
      } else if (b.path) {
        const a = clamp((b.delay + b.duration - b.age) / b.duration, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        for (const s of b.path.segments) {
          const color = s.reflected ? "#bbffe5" : "#ffe19a";
          pathStroke([s], s.reflected ? "#68ffd552" : "#ffc8723b", 20 * scale);
          pathStroke([s], color, 7 * scale);
          pathStroke([s], "#fffdeb", 2.5 * scale);
          glow(
            s.b.x,
            s.b.y,
            30 * scale,
            s.reflected ? "#baffdc88" : "#ffe39866",
          );
        }
        ctx.restore();
      }
    }
    for (const item of pickups) {
      const r = item.kind === "star" ? 8 * scale : 15 * scale;
      glow(
        item.x,
        item.y,
        r * 2.6,
        item.kind === "heat"
          ? "#ff563536"
          : item.kind === "magnet"
            ? "#ffb58030"
            : "#ffe49f24",
      );
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.sin(item.age * 2) * 0.07);
      if (item.kind === "star") {
        ctx.fillStyle = "#4c4b32";
        ctx.beginPath();
        ctx.roundRect(-r * 0.6, -r, r * 1.2, r * 2, 2);
        ctx.fill();
        ctx.fillStyle = "#ffe0a2";
        ctx.fillRect(-r * 0.45, -r * 0.78, r * 0.9, r * 1.55);
        ctx.fillRect(-r * 0.2, -r * 1.2, r * 0.4, r * 0.3);
        ctx.fillStyle = "#74552e";
        ctx.font = "bold " + 10 * scale + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ϟ", 0, 0);
      } else if (item.kind === "magnet") {
        ctx.fillStyle = "#e88672";
        ctx.fillRect(-r, -r * 0.55, r, r * 1.1);
        ctx.fillStyle = "#659ac8";
        ctx.fillRect(0, -r * 0.55, r, r * 1.1);
        ctx.strokeStyle = "#ffeed0";
        ctx.lineWidth = 1;
        ctx.strokeRect(-r, -r * 0.55, r * 2, r * 1.1);
        ctx.font = "bold " + 9 * scale + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff1dc";
        ctx.fillText("N", -r * 0.5, 0);
        ctx.fillText("S", r * 0.5, 0);
      } else if (item.kind === "heat") {
        ctx.fillStyle = "#832d2b";
        ctx.strokeStyle = "#ff9b73";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -r - 3);
        ctx.lineTo(r + 3, r);
        ctx.lineTo(-r - 3, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffe2b1";
        ctx.font = "bold " + 18 * scale + "px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", 0, r * 0.6);
      } else {
        ctx.fillStyle = "#183443ed";
        ctx.strokeStyle =
          item.kind === "heart"
            ? "#ffaaa9"
            : item.kind === "capacitor"
              ? "#adefff"
              : "#ffe0a0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-r, -r, r * 2, r * 2, 5);
        ctx.fill();
        ctx.stroke();
        if (item.kind === "power") {
          ctx.strokeStyle = "#eaae75";
          ctx.lineWidth = 2 * scale;
          for (let j = 0; j < 5; j++) {
            ctx.beginPath();
            ctx.ellipse(
              (j - 2) * 4 * scale,
              0,
              4 * scale,
              9 * scale,
              0,
              0,
              Math.PI * 2,
            );
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "bold " + 19 * scale + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            { capacitor: "ϟ", heart: "♥", coolant: "❄" }[item.kind] || "ϟ",
            0,
            1,
          );
        }
      }
      ctx.restore();
    }

    for (const s of shots) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      const r = (s.heavy ? 5 : s.homing ? 3.8 : 3.2) * scale,
        len = (s.heavy ? 20 : 15) * scale;
      ctx.fillStyle = s.heavy ? "#ffbb82" : s.homing ? "#bdc8ff" : "#b6fff0";
      ctx.beginPath();
      ctx.moveTo(0, -len / 2 - 3 * scale);
      ctx.lineTo(r, -len / 2 + 3 * scale);
      ctx.lineTo(r, len / 2);
      ctx.lineTo(-r, len / 2);
      ctx.lineTo(-r, -len / 2 + 3 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#496272";
      ctx.fillRect(-r * 0.42, -len * 0.1, r * 0.84, len * 0.4);
      ctx.fillStyle = s.homing ? "#92aaf0" : "#e4b17a";
      ctx.beginPath();
      ctx.moveTo(-r, len * 0.12);
      ctx.lineTo(-r * 1.8, len * 0.55);
      ctx.lineTo(-r, len * 0.5);
      ctx.moveTo(r, len * 0.12);
      ctx.lineTo(r * 1.8, len * 0.55);
      ctx.lineTo(r, len * 0.5);
      ctx.fill();
      ctx.fillStyle = feverTime > 0 ? "#ffc076" : "#8cf1ee";
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, len / 2);
      ctx.lineTo(0, len / 2 + (8 + Math.sin(time * 60) * 3) * scale);
      ctx.lineTo(r * 0.7, len / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const e of enemies) {
      if (e.boss) {
        glow(e.x, e.y, 90 * scale, "#0613275c");
        drawSprite(
          level.bossArt,
          level.bossArt === "boss"
            ? Math.floor(e.age * 8) % 8
            : stage === 1
              ? e.armorClosed
                ? Math.floor(e.age * 6) % 2
                : 2 + (Math.floor(e.age * 6) % 2)
              : Math.floor(e.age * 7) % 4,
          e.x,
          e.y,
          Math.min(205 * scale, H * 0.49),
          Math.sin(e.age * 0.5) * 0.025,
          e.flash > 0 ? 0.7 : 1,
        );
        glow(e.x, e.y, 18 * scale, e.armorClosed ? "#ff7e5544" : "#83ffdf55");
        if (e.armorClosed) {
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "#ffc09a";
          ctx.fillText("장갑 닫힘", e.x, e.y + e.r + 20 * scale);
        }
      } else {
        drawSprite(
          "enemies",
          e.kind * 4 + [0, 2, 3, 2, 1, 2][Math.floor(e.age * 10) % 6],
          e.x,
          e.y,
          (e.kind === 1 ? 88 : 77) * scale,
          Math.sin(e.age * 1.7) * 0.05,
          e.flash > 0 ? 0.65 : 1,
        );
        if (e.kind === 1) {
          ctx.fillStyle = "#07293b";
          ctx.fillRect(
            e.x - 18 * scale,
            e.y + 28 * scale,
            36 * scale,
            3 * scale,
          );
          ctx.fillStyle = "#7fe7e6";
          ctx.fillRect(
            e.x - 18 * scale,
            e.y + 28 * scale,
            (36 * scale * e.hp) / e.maxHP,
            3 * scale,
          );
        }
      }
    }
    for (const b of bullets) {
      glow(b.x, b.y, b.r * 2.3, b.color + "44");
      ctx.fillStyle = "#482b53";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 1.7 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe3de";
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player) {
      if (feverTime > 0) {
        glow(player.x, player.y, 100 * scale, "#ffd57434");
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = "#ffeab7" + ["45", "30", "25", "15"][i];
          ctx.lineWidth = (15 - i * 2) * scale;
          ctx.beginPath();
          ctx.moveTo(player.x + (i - 1.5) * 18 * scale, player.y + 27 * scale);
          ctx.lineTo(player.x + (i - 1.5) * 20 * scale, player.y + 150 * scale);
          ctx.stroke();
        }
      }
      const alpha = player.inv > 0 ? 0.55 + Math.sin(time * 16) * 0.2 : 1;
      drawSprite(
        "hero",
        Math.floor(time * (feverTime > 0 ? 16 : 12)) % 8,
        player.x,
        player.y,
        101 * scale,
        player.tilt,
        alpha,
      );
      for (let i = 0; i < build.friend; i++) {
        drawSprite(
          "enemies",
          4 + (Math.floor(time * 10 + i) % 4),
          player.x + (i === 0 ? -52 : 52) * scale,
          player.y + 25 * scale + Math.sin(time * 5 + i) * 4,
          50 * scale,
          0,
          0.94,
        );
      }
      ctx.fillStyle = "#f7fff5";
      ctx.beginPath();
      ctx.arc(player.x, player.y, 2.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const link of pulseLinks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, link.life / 0.58);
      ctx.strokeStyle = "#9efbff";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(link.a.x, link.a.y);
      for (let j = 1; j <= 12; j++) {
        const q = j / 12;
        ctx.lineTo(
          lerp(link.a.x, link.b.x, q) +
            (j === 12 ? 0 : Math.sin(j * 5.7 + time * 30) * 13 * scale),
          lerp(link.a.y, link.b.y, q),
        );
      }
      ctx.stroke();
      ctx.strokeStyle = "#fff9d6";
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();
      ctx.restore();
    }
    drawGenerator();
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const e of effects) {
      const t = 1 - e.life / e.max;
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = (1 - t) * 0.6;
      ctx.lineWidth = (1 - t) * 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * t, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of texts) {
      ctx.save();
      ctx.globalAlpha = clamp((t.life / t.max) * 2, 0, 1);
      ctx.font = "900 " + t.size * scale + 'px "Noto Sans KR",sans-serif';
      ctx.textAlign = "center";
      ctx.shadowColor = "#053544";
      ctx.shadowBlur = 8;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
    ctx.restore();
  }
  function frame(timestamp) {
    const delta = Math.min(0.05, (timestamp - last) / 1000 || 0);
    last = timestamp;
    if (!manualClock) accumulator += delta;
    while (accumulator >= 1 / 60) {
      update(1 / 60);
      accumulator -= 1 / 60;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function showModal(html, origin = mode) {
    lastFocus = document.activeElement;
    modalOrigin = origin;
    $("modalContent").innerHTML = html;
    $("modal").hidden = false;
    $("modalClose").hidden = false;
    if (mode === "play") {
      setMode("paused");
      audio.pause();
      keys.clear();
      pointer.active = false;
    }
    $("modal").querySelector(".modal-card").focus();
  }
  function closeModal(resume = true) {
    $("modal").hidden = true;
    $("modalContent").innerHTML = "";
    if (resume && mode === "paused") {
      setMode("play");
      audio.start();
    }
    if (lastFocus?.isConnected) lastFocus.focus();
  }
  function pause() {
    if (mode === "play") showPause();
    else if (mode === "paused") closeModal();
  }
  function showPause() {
    showModal(
      '<span class="eyebrow">TAKE A LITTLE BREATH</span><h2 id="modalTitle">엔진을 쉬어가요</h2><p>' +
        String(stage + 1).padStart(2, "0") +
        " · " +
        level.name +
        '<br>현재 비행은 잠시 멈춰 있어요.</p><button class="primary" data-action="resume">계속 비행하기 →</button><div class="pause-options"><button id="pauseSound" class="secondary" data-action="sound">' +
        (save.sound ? "♪ 소리 켬" : "♪ 소리 끔") +
        '</button><button class="secondary" data-action="journal">발명 노트</button></div><label class="volume-label">음량<input id="volume" type="range" min="0" max="100" value="' +
        Math.round(save.volume * 100) +
        '" aria-label="소리 크기"></label><button class="secondary" data-action="retry">이 스테이지 다시 날기</button><button class="text-btn" data-action="title">시작 화면으로 · 진행은 저장돼요</button>',
    );
  }
  function toTitle() {
    closeModal(false);
    setMode("title");
    audio.pause();
    $("hud").hidden = true;
    $("playControls").hidden = true;
    $("message").classList.remove("visible");
    $("startScreen").hidden = false;
    $("continueBtn").hidden = !save.checkpoint;
    if (save.checkpoint)
      $("continueBtn").textContent =
        save.checkpoint.stage + 1 + "스테이지부터 이어서 비행";
    updateSide();
  }
  function grade() {
    return stats.damage === 0 ? 3 : stats.damage <= 2 ? 2 : 1;
  }
  function clearStage() {
    if (mode !== "play") return;
    setMode("clear");
    audio.pause();
    audio.effect("clear");
    const stars = grade(),
      bonus = 500 + stars * 250;
    score += bonus;
    save.best = Math.max(save.best, Math.floor(score));
    save.stars[stage] = Math.max(save.stars[stage], stars);
    save.unlocked = Math.max(save.unlocked, Math.min(L.length - 1, stage + 1));
    persist();
    updateSide();
    const starHTML =
        '<div class="result-stars" aria-label="별 ' +
        stars +
        '개">' +
        Array.from(
          { length: 3 },
          (_, i) =>
            "<span" + (i >= stars ? ' class="unearned"' : "") + ">✦</span>",
        ).join("") +
        "</div>",
      head =
        '<span class="eyebrow">SKY ' +
        String(stage + 1).padStart(2, "0") +
        ' CLEARED</span><h2 id="modalTitle">' +
        level.name +
        " 통과!</h2>" +
        starHTML +
        '<div class="result-stats"><div><span>비행 점수</span><b>' +
        fmt(score) +
        "</b></div><div><span>펄스 사용</span><b>" +
        stats.pulses +
        "</b></div><div><span>모은 전지</span><b>" +
        stats.stars +
        '</b></div></div><div class="history-card"><span>발견의 기록</span><strong>' +
        level.lesson +
        "</strong><p>" +
        level.story +
        '</p><a href="' +
        level.source +
        '" target="_blank" rel="noopener noreferrer">역사 기록 ↗</a></div><p class="result-fact">' +
        level.fact +
        "</p>";
    if (stage === L.length - 1) {
      save.checkpoint = null;
      persist();
      showModal(
        head +
          '<button class="primary" data-action="ending">구름도시의 아침을 만나러 →</button>',
        "clear",
      );
    } else {
      const choices = U.choices(build, stage);
      showModal(
        head +
          '<div class="upgrade-label">다음 하늘로 가져갈 발명 하나</div><div class="upgrades">' +
          choices
            .map(
              (u) =>
                '<button class="upgrade" data-upgrade="' +
                u.id +
                '"><span class="upgrade-icon">' +
                u.icon +
                "</span><span><b>" +
                u.name +
                "</b><small>" +
                u.desc +
                '</small></span><span class="upgrade-arrow">→</span></button>',
            )
            .join("") +
          "</div>",
        "clear",
      );
    }
    $("modalClose").hidden = true;
  }
  function selectUpgrade(id) {
    if (mode !== "clear") return;
    const u = U.upgrades.find((u) => u.id === id);
    if (!u || build[id] >= u.max) return;
    build[id]++;
    audio.effect("level");
    startStage(stage + 1);
  }
  function failStage() {
    if (mode !== "play") return;
    setMode("failed");
    audio.pause();
    audio.effect("fail");
    save.best = Math.max(save.best, Math.floor(score));
    persist();
    updateSide();
    showModal(
      '<span class="eyebrow">YOUR NEXT FLIGHT AWAITS</span><h2 id="modalTitle">조금 쉬었다 다시!</h2><p>' +
        level.name +
        '까지 잘 날아왔어요.<br>이번 스테이지의 시작부터 다시 도전해요.</p><div class="result-stats"><div><span>비행 점수</span><b>' +
        fmt(score) +
        "</b></div><div><span>펄스 사용</span><b>" +
        stats.pulses +
        "</b></div><div><span>현재 하늘</span><b>" +
        String(stage + 1).padStart(2, "0") +
        '</b></div></div><p class="result-fact">' +
        (stage < 2
          ? "비행기 몸체 가운데 작은 점이 피격 위치예요. 날개 끝은 닿아도 괜찮아요."
          : level.tip) +
        '</p><button class="primary" data-action="retry">한 번 더 비행 →</button>' +
        (difficulty === "normal"
          ? '<button class="secondary" data-action="retry-easy">이번에는 여유롭게 · 느린 공격</button>'
          : "") +
        '<button class="text-btn" data-action="title">시작 화면으로</button>',
      "failed",
    );
    $("modalClose").hidden = true;
  }
  function ending() {
    setMode("ending");
    showModal(
      '<span class="eyebrow">THE CITY IS ALIGHT</span><div class="ending-badge">✧</div><h2 id="modalTitle">패러데이가 아침을 데려왔어요.</h2><p>다섯 개의 어려움 너머로, 기록은 남았어요.<br>이번에는 여러분이 발견을 이어갈 차례예요.</p><div class="result-stats"><div><span>최종 점수</span><b>' +
        fmt(score) +
        "</b></div><div><span>완주</span><b>5 / 5</b></div><div><span>모은 훈장</span><b>" +
        save.stars.reduce((a, b) => a + b, 0) +
        ' / 15</b></div></div><p class="result-fact">코일을 감고, 자석을 돌리고, 전기를 모았어요. 코일을 지나는 자기장의 변화로 전기를 만든다. 패러데이와 함께 기억할 작은 발견이에요.</p><button class="primary" data-action="map">별 세 개를 향해 다시 날기 →</button><button class="secondary" data-action="title">시작 화면으로</button>',
      "ending",
    );
    $("modalClose").hidden = true;
  }
  function showMap() {
    const origin = mode;
    showModal(
      '<span class="eyebrow">FIVE SKIES, ONE BRIGHT IDEA</span><h2 id="modalTitle">5개의 하늘</h2><p>통과한 하늘은 언제든 다시 날 수 있어요.</p><div class="stage-grid">' +
        L.map(
          (l, i) =>
            '<button class="map-stage" data-stage="' +
            i +
            '" ' +
            (i > save.unlocked ? "disabled" : "") +
            "><span>" +
            String(i + 1).padStart(2, "0") +
            (l.boss ? " ◇" : "") +
            "</span><b>" +
            l.name +
            "</b><small>" +
            (i > save.unlocked
              ? "앞의 하늘을 통과하세요"
              : save.stars[i]
                ? "✦".repeat(save.stars[i])
                : "첫 비행을 기다려요") +
            "</small></button>",
        ).join("") +
        '</div><p class="science-detail">스테이지를 골라 시작하면 그 하늘에 맞는 기본 장비를 받아요. 최고 기록과 별 훈장은 이 기기에 저장돼요.</p>',
      origin,
    );
  }
  function showHelp() {
    showModal(
      '<span class="eyebrow">READY FOR TAKEOFF</span><h2 id="modalTitle">비행은 간단해요</h2><div class="help-row"><strong>① 움직이면, 패러데이도 함께</strong>마우스나 손가락을 누른 채 움직이세요.<br><small>키보드는 방향키 / W A S D. 공격은 자동이에요.</small></div><div class="help-row"><strong>② 전지와 부품을 모아요</strong>코일 ◎ 탄 수·미사일 강화 · 자석 N/S 피해 증가<br><small>♥ 체력 회복 · ϟ 축전기 충전 · 빨간 △ 과열 파편은 피하세요. 작은 전지를 연속으로 모으면 오버드라이브!</small></div><div class="help-row"><strong>③ 충전된 전기로 돌파해요</strong>축전기가 있으면 ϟ 스파크 폭풍 / SPACE.<br><small>노란 예고선이 번쩍일 때 쓰면 PERFECT! 적 탄환을 지우고 큰 피해를 줘요. 축전기는 발전기로도 충전돼요.</small></div><div class="help-row"><strong>④ 날개 끝은 닿아도 괜찮아요</strong>몸체 가운데 흰 점에 적이나 탄환이 닿지 않게 피하세요.</div><button class="secondary" data-action="close">준비됐어요</button>',
    );
  }
  let noteSpeed = 1,
    noteAngle = 0,
    noteTurns = 1,
    noteField = 1;
  function showJournal(tab = 0) {
    journalTab = tab;
    noteSpeed = 1;
    noteTurns = 1;
    noteField = 1;
    const descriptions = [
      [
        "자기장이 바뀌면 전기가 생겨요",
        "코일 속에서 자석을 돌리면 코일을 지나는 자기장이 변해요. 속도를 0으로 내려보세요. 멈춘 자석만으로는 계속 발전하지 않아요.",
      ],
      [
        "코일과 자석으로 출력을 키워요",
        "같은 조건이라면 코일을 더 많이 감거나 더 강한 자석을 쓰면 유도 전압이 커져요. 두 조절기를 움직여 확인해 보세요.",
      ],
      [
        "만든 전기를 모아뒀다가, 한 번에!",
        "축전기는 전기 에너지를 잠시 저장하는 부품이에요. 게임에서는 충전된 축전기를 모아 스파크 폭풍을 사용해요.",
      ],
    ];
    showModal(
      '<span class="eyebrow">FARADAY’S LITTLE LABORATORY</span><h2 id="modalTitle">발명 노트</h2><div class="journal-tabs">' +
        ["발전", "코일 · 자석", "축전기"]
          .map(
            (t, i) =>
              '<button data-note="' +
              i +
              '" class="' +
              (i === tab ? "selected" : "") +
              '">' +
              t +
              "</button>",
          )
          .join("") +
        '</div><canvas id="noteCanvas" width="680" height="400" aria-label="' +
        descriptions[tab][0] +
        ' 실험"></canvas>' +
        (tab === 0
          ? '<label class="journal-caption">자석의 회전 속도 <span id="speedValue">1배</span><input type="range" id="speedControl" min="0" max="3" step="0.1" value="1" aria-label="자석 회전 속도"></label>'
          : tab === 1
            ? '<label class="journal-caption">코일 감은 수<input type="range" id="turnControl" min="1" max="3" step="1" value="1" aria-label="코일 감은 수"></label><label class="journal-caption">자석의 세기<input type="range" id="fieldControl" min="1" max="3" step="0.1" value="1" aria-label="자석의 세기"></label>'
            : "") +
        "<p><strong>" +
        descriptions[tab][0] +
        "</strong><br>" +
        descriptions[tab][1] +
        '</p><p class="science-detail">' +
        (tab === 0
          ? "정확하게는 코일을 통과하는 자기선속이 변할 때 유도 전압이 생겨요. 회로가 닫혀 있으면 전류가 흐를 수 있어요."
          : tab === 1
            ? "코일의 간격만 벌어졌다고 항상 출력이 줄지는 않아요. 게임의 충돌은 코일 일부가 풀려 유효한 감은 수가 감소하는 상황이에요. 높은 온도는 자석의 성질을 약화시킬 수 있어요."
            : "발전기의 전기 에너지는 자석을 움직이는 바람과 엔진의 일에서 와요. 자석이 에너지를 무한히 만들어 내지는 않아요.") +
        '</p><p class="science-detail">패러데이는 1831년 전자기 유도를 발견했어요. 비행기·미사일·탄막을 지우는 펄스는 그 발견에서 상상한 게임 장비이며 실제로 그가 만든 무기는 아니에요. 미사일 종류와 피해량은 게임의 강화 규칙이에요.</p><a class="science-source" href="https://openstax.org/books/physics/pages/20-3-electromagnetic-induction" target="_blank" rel="noopener noreferrer">원리 · OpenStax 전자기 유도 ↗</a><a class="science-source" href="https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus" target="_blank" rel="noopener noreferrer">역사 · 왕립연구소의 패러데이 실험 장치 ↗</a>',
    );
    drawNote();
  }
  function drawNote() {
    const c = $("noteCanvas");
    if (!c) return;
    const n = c.getContext("2d");
    n.clearRect(0, 0, 680, 400);
    n.fillStyle = "#092936";
    n.fillRect(0, 0, 680, 400);
    const gen = P.inductionSample(
        noteTurns,
        noteField,
        1,
        noteSpeed * 3,
        noteAngle,
      ),
      cx = 265,
      cy = 175;
    n.strokeStyle = "#7b9f9d";
    n.lineWidth = 3;
    n.beginPath();
    n.moveTo(160, 185);
    n.lineTo(105, 185);
    n.lineTo(105, 305);
    n.lineTo(560, 305);
    n.lineTo(560, 185);
    n.lineTo(370, 185);
    n.stroke();
    n.strokeStyle = "#dfa96e";
    n.lineWidth = 4;
    for (let i = 0; i < 7 + noteTurns * 4; i++) {
      n.beginPath();
      n.ellipse(
        cx + (i - (6 + noteTurns * 4) / 2) * 12,
        cy,
        16,
        65,
        0,
        0,
        Math.PI * 2,
      );
      n.stroke();
    }
    n.save();
    n.translate(cx, cy);
    n.rotate(noteAngle);
    n.fillStyle = "#d98270";
    n.fillRect(-68, -17, 68, 34);
    n.fillStyle = "#649fce";
    n.fillRect(0, -17, 68, 34);
    n.strokeStyle = "#ffdbb5";
    n.lineWidth = 2;
    n.strokeRect(-68, -17, 136, 34);
    n.font = "bold 20px sans-serif";
    n.textAlign = "center";
    n.textBaseline = "middle";
    n.fillStyle = "#fff4e1";
    n.fillText("N", -34, 0);
    n.fillText("S", 34, 0);
    n.restore();
    const brightness = Math.min(1, Math.abs(gen.emf) / 9);
    n.fillStyle = "#b9ffbf";
    n.globalAlpha = 0.15 + brightness * 0.75;
    n.beginPath();
    n.arc(560, 175, 35, 0, Math.PI * 2);
    n.fill();
    n.globalAlpha = 1;
    n.strokeStyle = "#c5e5cd";
    n.lineWidth = 2;
    n.beginPath();
    n.arc(560, 175, 25, 0, Math.PI * 2);
    n.stroke();
    n.font = '21px "Noto Sans KR",sans-serif';
    n.fillStyle = "#efce9e";
    n.textAlign = "center";
    n.fillText("구리 코일", 265, 72);
    n.fillStyle = "#d9ede1";
    n.fillText(
      noteSpeed === 0 ? "회전 멈춤 · 유도 전압 0" : "자석 회전 → 자기장 변화",
      340,
      355,
    );
    n.font = '16px "Noto Sans KR",sans-serif';
    n.fillStyle = "#a8ccc5";
    n.fillText("닫힌 회로", 175, 333);
    n.fillText("전구", 560, 125);
    if (journalTab === 2) {
      n.fillStyle = "#0b2d3df5";
      n.fillRect(395, 80, 250, 188);
      n.strokeStyle = "#d6f9ef";
      n.lineWidth = 6;
      n.beginPath();
      n.moveTo(475, 130);
      n.lineTo(475, 230);
      n.moveTo(515, 130);
      n.lineTo(515, 230);
      n.moveTo(440, 180);
      n.lineTo(475, 180);
      n.moveTo(515, 180);
      n.lineTo(550, 180);
      n.stroke();
      n.fillStyle = "#ffe0a0";
      n.font = "22px sans-serif";
      n.fillText("+", 453, 117);
      n.fillText("−", 537, 117);
      n.font = '20px "Noto Sans KR",sans-serif';
      n.fillText("축전기", 495, 262);
    }
    if ($("speedValue"))
      $("speedValue").textContent =
        noteSpeed === 0 ? "멈춤" : noteSpeed.toFixed(1) + "배";
  }

  deck.addEventListener("pointerdown", (e) => {
    if (mode !== "play" || e.target !== canvas) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    pointer = {
      id: e.pointerId,
      active: true,
      x: player.x,
      y: player.y,
      offsetX: player.x - x,
      offsetY: player.y - y,
    };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
  });
  canvas.addEventListener("pointermove", (e) => {
    if (mode !== "play" || pointer.id !== e.pointerId) return;
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * W + pointer.offsetX;
    pointer.y = ((e.clientY - r.top) / r.height) * H + pointer.offsetY;
  });
  function release(e) {
    if (pointer.id === e.pointerId) {
      pointer.id = null;
      pointer.active = false;
    }
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  $("pulseBtn").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    usePulse();
  });
  $("pulseBtn").addEventListener("click", (e) => {
    if (e.detail === 0) usePulse();
  });
  $("pauseBtn").addEventListener("click", pause);
  $("soundBtn").addEventListener("click", toggleSound);
  $("startBtn").addEventListener("click", () => newFlight());
  $("continueBtn").addEventListener("click", () => {
    if (save.checkpoint) newFlight(save.checkpoint.stage, save.checkpoint);
  });
  $("modalClose").addEventListener("click", () => closeModal());
  document.addEventListener("keydown", (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "Escape" || k === "p") {
      if (!$("modal").hidden) {
        if (!["clear", "failed", "ending"].includes(mode)) closeModal();
      } else if (mode === "play") showPause();
      e.preventDefault();
      return;
    }
    if (e.target instanceof HTMLInputElement) return;
    if (
      mode === "play" &&
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
        " ",
      ].includes(k)
    ) {
      e.preventDefault();
      if (k === " ") {
        if (!e.repeat) usePulse();
      } else keys.add(k);
    }
    if (k === "Tab" && !$("modal").hidden) {
      const focusable = [
        ...$("modal").querySelectorAll(
          "button:not([hidden]):not(:disabled),a,input",
        ),
      ].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0],
        end = focusable[focusable.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement.classList.contains("modal-card"))
      ) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && document.activeElement === end) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener("keyup", (e) =>
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key),
  );
  window.addEventListener("blur", () => {
    keys.clear();
    pointer.active = false;
    if (mode === "play") showPause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") showPause();
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.modeChoice) {
      save.mode = b.dataset.modeChoice;
      difficulty = save.mode;
      persist();
      updateModeChoice();
    }
    if (b.dataset.upgrade) selectUpgrade(b.dataset.upgrade);
    if (b.dataset.stage !== undefined) {
      const s = Number(b.dataset.stage);
      if (s <= save.unlocked) {
        const startingBuild = validBuild({
          spread: Math.min(2, Math.floor(s / 3)),
          power: Math.floor(s / 4),
          resonance: Math.floor(s / 4),
        });
        newFlight(s, {
          stage: s,
          build: startingBuild,
          score: 0,
          wing: Math.min(5, 1 + Math.floor(s / 2)),
          mode: save.mode,
        });
      }
    }
    if (b.dataset.note !== undefined) showJournal(Number(b.dataset.note));
    switch (b.dataset.action) {
      case "back-lab":
        window.top.location.assign(new URL("../lab.html?play=all", location.href).href);
        break;
      case "sound":
        toggleSound();
        break;
      case "journal":
        showJournal();
        break;
      case "map":
        showMap();
        break;
      case "help":
        showHelp();
        break;
      case "close":
      case "resume":
        closeModal();
        break;
      case "title":
        toTitle();
        break;
      case "retry":
      case "retry-easy": {
        const c = clone(entry || save.checkpoint);
        if (c) {
          if (b.dataset.action === "retry-easy") c.mode = "easy";
          newFlight(c.stage, c);
        }
        break;
      }
      case "ending":
        ending();
        break;
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "volume") {
      save.volume = Number(e.target.value) / 100;
      audio.setVolume(save.volume);
      persist();
    }
    if (e.target.id === "speedControl") noteSpeed = Number(e.target.value);
    if (e.target.id === "turnControl") noteTurns = Number(e.target.value);
    if (e.target.id === "fieldControl") noteField = Number(e.target.value);
  });
  function updateModeChoice() {
    for (const b of document.querySelectorAll("[data-mode-choice]")) {
      const selected = b.dataset.modeChoice === save.mode;
      b.classList.toggle("selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    }
  }
  function loadImages() {
    return Promise.all(
      [
        "hero",
        "enemies",
        "boss",
        "world",
        "poverty",
        "gate",
        "symbols",
        "fog",
      ].map(
        (name) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              IMAGES[name] = image;
              resolve();
            };
            image.onerror = () => reject(new Error(name));
            image.src =
              "../assets/faraday-flight/" +
              name +
              ".webp?v=" +
              (window.FaradayImageVersions?.[name] || "1");
          }),
      ),
    );
  }
  updateSide();
  updateModeChoice();
  updateSoundUI();
  loadPromise = loadImages()
    .then(() => {
      setMode("title");
      draw();
      $("startBtn").disabled = false;
      $("startText").textContent = "첫 비행 시작";
      $("continueBtn").hidden = !save.checkpoint;
      if (save.checkpoint)
        $("continueBtn").textContent =
          save.checkpoint.stage + 1 + "스테이지부터 이어서 비행";
      if (!storageOK)
        $("loadStatus").textContent =
          "이 환경에서는 진행 기록이 이번 실행 동안만 유지돼요.";
    })
    .catch(() => {
      $("loadStatus").innerHTML =
        '그림을 불러오지 못했어요. <button class="text-btn" onclick="location.reload()">다시 불러오기</button>';
      $("startText").textContent = "그림을 기다리고 있어요";
    });
  // QA is opt-in by URL and exposes local simulation fixtures. No remote scores exist.
  if (new URLSearchParams(location.search).has("qa"))
    window.__faraday = {
      manual(value = true) {
        manualClock = value;
        accumulator = 0;
      },
      ready: () => loadPromise,
      get state() {
        return {
          mode,
          stage,
          stageTime,
          score,
          wing,
          build: clone(build),
          player: player && clone(player),
          stats: clone(stats),
          enemies: enemies.map((e) => ({ ...e })),
          beams: beams.map((b) => ({ ...b, source: { ...b.source } })),
          bullets: bullets.map((b) => ({ ...b })),
          shots: shots.map((b) => ({ ...b })),
          pickups: pickups.map((p) => ({ ...p })),
          W,
          H,
          save: clone(save),
          sprites: atlas,
          feverTime,
          magnetLevel,
          heatTime,
          pulseCharges,
          charge,
          rotorAngle,
          generator: generator(),
        };
      },
      step(seconds) {
        for (let i = 0; i < seconds * 60; i++) update(1 / 60);
        draw();
      },
      move(x, y) {
        if (player) {
          player.x = x;
          player.y = y;
          pointer.active = false;
        }
      },
      pulse: usePulse,
      spawnBeam(x = 240) {
        const e = addEnemy(1, x, H * 0.18, "turret", {
          targetY: H * 0.18,
          hp: 100,
          maxHP: 100,
          beamClock: 99,
        });
        launchBeam(e);
        return e.id;
      },
      damage: hurt,
      collect(kind) {
        if (player) collect({ x: player.x, y: player.y, kind, dead: false });
      },
      setPlayerHP(n) {
        if (player) player.hp = n;
      },
      setBossHP(n) {
        const e = enemies.find((e) => e.boss);
        if (e) e.hp = n;
      },
      finishWaves() {
        stageTime = level.duration + 0.1;
        enemies = enemies.filter((e) => e.boss);
      },
      draw,
      physics: P,
    };
})();
