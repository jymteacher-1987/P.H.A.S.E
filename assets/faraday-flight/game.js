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
          charge: clamp(Number(c.charge) || 0, 0, 99.99),
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
    fever = 0,
    feverTime = 0,
    stageTime = 0,
    waveClock = 1,
    waveIndex = 0,
    pickupClock = 4,
    partsUntilDrop = 7,
    lastPartDrop = -6,
    capacitorDropped = false,
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
    worldDistance = 0,
    boostVisual = 0,
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
      parts: 0,
      enemyShots: 0,
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
    return P.movingInductionSample(
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
      charge,
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
    charge = clamp(Number(restore?.charge) || 0, 0, 99.99);
    runStats = { pulses: 0, perfect: 0 };
    startStage(index);
  }
  function startStage(index) {
    closeModal(false);
    stage = index;
    level = L[index];
    stageTime = 0;
    capacitorDropped = false;
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
    fever = 0;
    feverTime = 0;
    shake = 0;
    hitStop = 0;
    shootTimer = 0;
    friendTimer = 0;
    seed = 4421 + stage * 1987;
    partsUntilDrop = 6 + Math.floor(random() * 4);
    lastPartDrop = -6;
    stats = {
      kills: 0,
      spawned: 0,
      damage: 0,
      pulses: 0,
      perfect: 0,
      parts: 0,
      enemyShots: 0,
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
    $("hud").hidden = true;
    $("playControls").hidden = true;
    $("bossHud").hidden = true;
    $("stageNumber").textContent =
      "STAGE " + String(stage + 1).padStart(2, "0") + " / " + L.length;
    $("stageName").textContent = level.name;
    setMode("briefing");
    audio.stage = stage;
    audio.boss = false;
    audio.pause();
    $("message").classList.remove("visible");
    updateHUD();
    updateSide();
    showChapter();
  }
  function showChapter() {
    showModal(
      '<section class="chapter-intro"><header><span class="eyebrow">패러데이의 삶 · ' +
        String(stage + 1).padStart(2, "0") +
        ' / 05</span><h2 id="modalTitle">' +
        level.zone +
        '</h2><span class="chapter-location">' +
        level.name +
        '</span></header><div class="chapter-window"><article class="chapter-crawl">' +
        level.chapter.map((text) => "<p>" + text + "</p>").join("") +
        '</article></div><footer><button id="chapterMotion" class="text-btn" data-action="chapter-motion" aria-pressed="false">글 멈추기 Ⅱ</button>' +
        '<button id="briefingLaunch" class="primary" data-action="launch">' +
        (stage + 1) +
        "장 출발 →</button></footer></section>",
      "briefing",
    );
    $("modalClose").hidden = true;
    $("chapterMotion").hidden = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }
  function launchChapter() {
    if (mode !== "briefing") return;
    closeModal(false);
    keys.clear();
    pointer.active = false;
    setMode("play");
    $("hud").hidden = false;
    $("playControls").hidden = false;
    audio.start();
    say(level.intro, 3.2, true);
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
    // Small craft take one hit, including a weakened shot; armored craft retain health.
    const baseHP = kind === 1 ? [13, 30, 55, 85, 125][stage] : 0.4;
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
      entryVolley: false,
      volleys: 0,
      ...extra,
    };
    enemies.push(e);
    stats.spawned++;
    return e;
  }
  function spawnWave() {
    // Leave room to dodge even when several enemies survive the previous wave.
    const limit = [8, 9, 10, 11, 12][stage];
    const alive = enemies.filter((e) => e.hp > 0 && !e.boss).length;
    if (alive > limit - 3) return;
    const pattern = level.patterns[waveIndex % level.patterns.length],
      n = Math.min(stage < 3 ? 4 : 5, limit - alive);
    waveIndex++;
    if (pattern === "turret") {
      addEnemy(1, waveIndex % 2 ? 145 : 335, -35, "turret", {
        targetY: H * 0.22,
        vy: 85 * scale,
      });
      for (const [i, x] of [95, 385].entries())
        addEnemy(i === 1 ? 2 : 0, x, -95 - i * 35, "sine");
      return;
    }
    if (pattern === "gate") {
      const gap = waveIndex % 2 ? 1 : 3;
      for (let i = 0; i < 4; i++) {
        const x = 65 + i * 116;
        if (i === gap) continue;
        addEnemy(i % 3 === 0 ? 1 : 0, x, -30 - i * 8, "straight");
      }
      return;
    }
    if (pattern === "spiral") {
      for (let i = 0; i < n; i++)
        addEnemy(
          i % 2 ? 2 : 0,
          75 + (i * 330) / (n - 1),
          -35 - i * 40,
          "sine",
          {
            phase: i * 0.8,
            vy: 63 * scale,
          },
        );
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
      const x = 58 + (i * (W - 116)) / (n - 1);
      addEnemy(
        (i + waveIndex) % 5 === 0 ? 1 : (i + waveIndex) % 3 === 0 ? 2 : 0,
        x,
        -35 - (pattern === "vee" ? Math.abs(i - (n - 1) / 2) * 40 : i * 18),
        pattern,
        {
          phase: waveIndex * 0.7,
          shoot: difficulty === "easy" ? 2.8 : 1.3 + random() * 0.5,
        },
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
      supply: 14,
      supplyCount: 0,
      escortClock: 3,
      escortWave: 0,
      motionTime: 0,
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
        side: Math.abs(offset) > 0,
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
  function enemyBullet(e, angle, speed = 95, kind = "orb") {
    stats.enemyShots++;
    const slow = difficulty === "easy" ? 0.72 : 1;
    bullets.push({
      x: e.x,
      y: e.y + e.r,
      vx: Math.cos(angle) * speed * level.speed * scale * slow,
      vy: Math.sin(angle) * speed * level.speed * scale * slow,
      r: (e.boss ? 5.5 : 4.8) * scale,
      color: e.kind === 2 ? "#ffad89" : "#fa92c3",
      life: 10,
      age: 0,
      kind,
    });
  }
  function enemyVolley(e) {
    const aim = Math.atan2(player.y - e.y, player.x - e.x);
    const slow = difficulty === "easy";
    const count =
      e.kind === 1
        ? !slow && stage >= 3
          ? 5
          : 3
        : e.kind === 2 && !slow && stage >= 2
          ? 2
          : 1;
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * (e.kind === 1 ? 0.24 : 0.15);
      const kind =
        stage >= 3 && e.kind === 2 && e.volleys % 3 === 1 && i === 0
          ? "split"
          : e.kind === 2
            ? "needle"
            : "orb";
      enemyBullet(
        e,
        angle,
        e.kind === 2 ? 110 + stage * 7 : 90 + stage * 7,
        kind,
      );
    }
    e.volleys++;
    e.shoot =
      (slow ? 3.8 : 3.3 - stage * (e.kind === 1 ? 0.22 : 0.15)) +
      (e.kind === 1 ? 0.35 : 0);
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
    if (e.hp <= 0 || e.y < 24 * scale || (e.boss ? !e.entered : !e.entryVolley))
      return;
    if (e.boss && e.armorClosed && !counter) damage *= 0.22;
    if (counter) {
      e.openUntil = e.age + 2;
      e.armorClosed = false;
    }
    e.hp -= damage;
    e.flash = 0.075;
    if (e.hp <= 0) {
      stats.kills++;
      score += e.boss ? 2500 : e.kind === 1 ? 90 : 35;
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
        for (const other of enemies) if (other !== e) other.hp = 0;
        beams = [];
        bullets = [];
        shake = reduced ? 0 : 9;
      } else {
        partsUntilDrop--;
        if (partsUntilDrop <= 0 && canDropPart()) {
          const roll = random();
          pickups.push({
            x: e.x,
            y: e.y - 20,
            kind: roll < 0.45 ? "power" : roll < 0.9 ? "magnet" : "heart",
            age: 0,
            vy: 63 * scale,
          });
          lastPartDrop = stageTime;
          partsUntilDrop = 6 + Math.floor(random() * 4);
        }
      }
      if (counter)
        floatText(e.x, e.y - 25, "+" + Math.floor(damage), "#ffe5a8", 22);
    }
  }
  function canDropPart() {
    return (
      stageTime - lastPartDrop >= 6 &&
      pickups.filter(
        (p) => !p.dead && ["power", "magnet", "heart"].includes(p.kind),
      ).length < 2
    );
  }
  function hurt() {
    if (mode !== "play" || player.inv > 0) return;
    player.hp--;
    player.inv = 1.3;
    stats.damage++;
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
    if (["power", "magnet", "capacitor"].includes(item.kind)) stats.parts++;
    if (item.kind === "power" || item.kind === "magnet")
      fever = Math.min(100, fever + 25);
    if (item.kind !== "heat") audio.effect("collect");
    switch (item.kind) {
      case "power":
        wing = Math.min(8, wing + 1);
        score += Math.round(100 * (1 + build.magnet * 0.1));
        floatText(
          player.x,
          player.y - 50 * scale,
          wing >= 8
            ? "최대 코일!"
            : wing === 6
              ? "직선 연장포 장착!"
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
        score += Math.round(100 * (1 + build.magnet * 0.1));
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
          say("더 강한 자석 · 같은 움직임에서 더 큰 유도 전압", 2.6);
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
    if (mode === "play" || mode === "title") {
      boostVisual = lerp(
        boostVisual,
        mode === "play" && feverTime > 0 ? 1 : 0,
        1 - Math.exp(-dt * 6),
      );
      worldDistance += dt * (mode === "play" ? 48 + boostVisual * 230 : 10);
    }
    if ($("noteCanvas")) {
      noteAngle += noteSpeed * 3 * dt;
      if (journalTab === 2) {
        const sample = noteSample();
        const c = P.capacitorStep(noteCapVoltage, sample.emf, dt);
        noteCapVoltage = c.voltage;
        noteCurrent = c.current;
        if (notePulseTime > 0) noteCapVoltage *= Math.exp(-dt / 0.22);
        notePulseTime = Math.max(0, notePulseTime - dt);
      }
    }
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
      charge += Math.abs(g.emf) * 0.22 * (1 + build.cooldown * 0.2) * dt;
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
      player.x += (dx / n) * 310 * (1 + boostVisual * 0.22) * dt;
      player.y += (dy / n) * 310 * (1 + boostVisual * 0.22) * scale * dt;
      pointer.active = false;
    } else if (pointer.active) {
      const t = 1 - Math.exp(-(18 + boostVisual * 5) * dt);
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
        waveClock =
          (level.rate + (waveIndex % 3 === 0 ? 1.1 : 0)) *
          (difficulty === "easy" ? 1.15 : 1);
      }
      pickupClock -= dt;
      if (pickupClock <= 0) {
        if (
          (stage === 1 || stage === 3) &&
          !capacitorDropped &&
          stageTime > level.duration * 0.55
        ) {
          capacitorDropped = true;
          pickups.push({
            x: W / 2,
            y: -10,
            kind: "capacitor",
            age: 0,
            vy: 75 * scale,
          });
        }
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
        pickupClock = 12;
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
          e.escortClock -= dt;
          if (
            e.escortClock <= 0 &&
            !charging &&
            !enemies.some((other) => !other.boss && other.hp > 0)
          ) {
            const positions =
              stage === 0 ? [e.escortWave % 2 ? 390 : 90] : [80, 400];
            for (const [i, x] of positions.entries()) {
              addEnemy(
                stage >= 2 && i === 1 ? 2 : 0,
                x,
                -35 - i * 45,
                "straight",
                { escort: true, vy: 70 * scale },
              );
            }
            e.escortWave++;
            e.escortClock = stage < 2 ? 22 : 19;
          }
          e.supply -= dt;
          if (e.supply <= 0 && canDropPart()) {
            e.supplyCount++;
            pickups.push({
              x: clamp(e.x + (e.supplyCount % 2 ? 75 : -75), 45, W - 45),
              y: e.y + e.r + 20,
              kind: player.hp <= 2 ? "heart" : wing < 8 ? "power" : "magnet",
              age: 0,
              vy: 95 * scale,
            });
            e.supply = 14;
            lastPartDrop = stageTime;
          }
          if (!charging) {
            e.motionTime += dt;
            const targetX = W / 2 + Math.sin(e.motionTime * 0.62) * 135;
            e.x += clamp(targetX - e.x, -90 * dt, 90 * dt);
          }
          e.phase = e.hp / e.maxHP < 0.34 ? 2 : e.hp / e.maxHP < 0.67 ? 1 : 0;
          e.armorClosed =
            stage === 1 && e.age % 5 < 2.7 && !(e.openUntil > e.age);
          e.shoot -= dt;
          e.beamClock -= dt;
          if (e.shoot <= 0 && !charging) {
            const count =
              (difficulty === "normal" ? 1 : 0) +
              (stage === 0
                ? 4
                : stage === 2
                  ? 6 + e.phase
                  : stage === L.length - 1
                    ? 7 + e.phase
                    : 5 + e.phase);
            // Alternate patterns so later bosses add variety without stacking every attack.
            e.volleys++;
            const aimed = stage >= 1 && e.volleys % 3 === 0;
            const crossing = stage >= 3 && e.phase > 0 && e.volleys % 4 === 0;
            if (!aimed && !crossing)
              for (let i = 0; i < count; i++) {
                const angle =
                  Math.PI / 2 +
                  (i - (count - 1) / 2) * (stage === 2 ? 0.23 : 0.19) +
                  Math.sin(e.age) * (stage === 2 ? 0.38 : 0.12);
                enemyBullet(e, angle, 85 + e.phase * 14);
              }
            if (aimed) {
              const aim = Math.atan2(player.y - e.y, player.x - e.x);
              for (let j = -1; j <= 1; j++)
                enemyBullet(
                  e,
                  aim + j * 0.23,
                  125 + stage * 8,
                  stage >= 2 && j === 0 ? "split" : "needle",
                );
            } else if (crossing) {
              for (let j = 0; j < 4; j++)
                enemyBullet(
                  { ...e, x: e.x + (e.phase === 1 ? -30 : 30) },
                  Math.PI / 2 + (j - 1.5) * 0.32 + Math.sin(e.age * 0.7) * 0.3,
                  120 + stage * 8,
                  "needle",
                );
            }
            e.shoot =
              ((stage === L.length - 1 ? 1.9 : 2.4) - e.phase * 0.18) *
              (difficulty === "normal" ? 1 : 1.2);
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
      // Entrance movement happens before this volley and before friendly-shot collisions.
      if (!e.boss && !e.entryVolley && e.y >= 24 * scale) {
        e.entryVolley = true;
        enemyVolley(e);
      }
      if (!e.boss && e.y > 50 * scale && e.y < player.y - 90 * scale) {
        e.shoot -= dt;
        if (e.shoot <= 0 && !charging && !(stage === 0 && stageTime < 5)) {
          enemyVolley(e);
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
        if (
          e.hp > 0 &&
          (e.boss ? e.entered : e.entryVolley) &&
          Math.hypot(s.x - e.x, s.y - e.y) < e.r + s.r
        ) {
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
    for (const b of [...bullets]) {
      b.age = (b.age || 0) + dt;
      if (b.kind === "split" && b.age > 1.15 && b.y < player.y - 100 * scale) {
        b.life = 0;
        const angle = Math.atan2(b.vy, b.vx);
        for (const offset of [-0.3, 0, 0.3])
          enemyBullet(
            { x: b.x, y: b.y, r: 0, kind: 2 },
            angle + offset,
            125 + stage * 7,
            "needle",
          );
        effectRing(b.x, b.y, "#ffbbdb", 22 * scale);
        continue;
      }
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
    $("weaponLevel").textContent = "GEAR " + String(wing).padStart(2, "0");
    $("feverBar").style.width =
      (feverTime > 0 ? (feverTime / 7) * 100 : fever) + "%";
    $("feverLabel").textContent =
      feverTime > 0
        ? "OVERDRIVE  " + feverTime.toFixed(1) + "s"
        : "코일·자석 모아 오버드라이브!";
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
        offset = worldDistance % (ih * 2),
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
    if (boostVisual > 0.04 && !reduced) {
      for (let i = 0; i < 12; i++) {
        const x = i % 2 ? W - 10 - (i % 3) * 12 : 10 + (i % 3) * 12,
          y = ((worldDistance * 2.4 + i * 97) % (H + 130)) - 65;
        const g = ctx.createLinearGradient(x, y - 65, x, y);
        g.addColorStop(0, "#d5fff000");
        g.addColorStop(1, "#d5fff07a");
        ctx.globalAlpha = boostVisual;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(x, y - 65);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  function drawGenerator() {
    if (!player || H < 370) return;
    ctx.save();
    ctx.translate(45, H - 190 * scale);
    ctx.scale(scale, scale);
    window.FaradayInductionDiagram.miniature(
      ctx,
      0,
      0,
      rotorAngle,
      4 + Math.min(4, wing),
    );
    ctx.font = "9px sans-serif";
    ctx.fillStyle = "#e6c493";
    ctx.textAlign = "center";
    ctx.fillText("자석 왕복 → 발전", 7, 43);
    ctx.restore();
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
      const hazard = item.kind === "heat",
        r = 18 * scale;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = hazard ? "#752b31" : "#103e40";
      ctx.strokeStyle = hazard ? "#ff9779" : "#a5f5d0";
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      if (hazard) {
        ctx.moveTo(0, -r - 2);
        ctx.lineTo(r + 2, r);
        ctx.lineTo(-r - 2, r);
        ctx.closePath();
      } else ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hazard ? "#ffe0bd" : "#e7fff1";
      if (item.kind === "magnet") {
        ctx.fillStyle = "#d57f78";
        ctx.fillRect(-11 * scale, -5 * scale, 11 * scale, 10 * scale);
        ctx.fillStyle = "#76a7d1";
        ctx.fillRect(0, -5 * scale, 11 * scale, 10 * scale);
        ctx.font = "bold " + 8 * scale + "px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText("N", -5.5 * scale, 0);
        ctx.fillText("S", 5.5 * scale, 0);
      } else if (item.kind === "capacitor") {
        ctx.strokeStyle = "#b4f7ff";
        ctx.lineWidth = 2.5 * scale;
        ctx.beginPath();
        ctx.moveTo(-4 * scale, -10 * scale);
        ctx.lineTo(-4 * scale, 10 * scale);
        ctx.moveTo(4 * scale, -10 * scale);
        ctx.lineTo(4 * scale, 10 * scale);
        ctx.moveTo(-12 * scale, 0);
        ctx.lineTo(-4 * scale, 0);
        ctx.moveTo(4 * scale, 0);
        ctx.lineTo(12 * scale, 0);
        ctx.stroke();
      } else {
        ctx.font = "bold " + 23 * scale + "px sans-serif";
        ctx.fillText(
          {
            power: "◎",
            heart: "♥",
            coolant: "❄",
            heat: "!",
          }[item.kind],
          0,
          scale,
        );
      }
      {
        const name = {
          power: "코일",
          magnet: "자석",
          capacitor: "축전기",
          heart: "회복",
          coolant: "냉각",
          heat: "위험",
        }[item.kind];
        ctx.font = "bold " + 10 * scale + "px sans-serif";
        ctx.textBaseline = "top";
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = "#092f3d";
        ctx.strokeText(name, 0, r + 4 * scale);
        ctx.fillStyle = hazard ? "#ffc4af" : "#d5ffec";
        ctx.fillText(name, 0, r + 4 * scale);
      }
      ctx.restore();
    }

    for (const s of shots) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      const r = (s.heavy ? 5 : s.side ? 3.8 : 3.2) * scale,
        len = (s.heavy ? 20 : 15) * scale;
      ctx.fillStyle = s.heavy ? "#ffbb82" : s.side ? "#bdc8ff" : "#b6fff0";
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
      ctx.fillStyle = s.side ? "#92aaf0" : "#e4b17a";
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
          level.enemyArt,
          e.kind * 4 + [0, 2, 3, 2, 1, 2][Math.floor(e.age * 10) % 6],
          e.x,
          e.y,
          (e.kind === 1 ? 88 : 77) * scale,
          Math.sin(e.age * 1.7) * 0.05,
          e.flash > 0 ? 0.65 : 1,
        );
        if (e.kind === 1) {
          const barX = e.x - 25 * scale,
            barY = e.y + 31 * scale;
          ctx.fillStyle = "#07293b";
          ctx.fillRect(barX - scale, barY - scale, 52 * scale, 8 * scale);
          ctx.strokeStyle = "#e7c68d";
          ctx.lineWidth = scale;
          ctx.strokeRect(barX - scale, barY - scale, 52 * scale, 8 * scale);
          ctx.fillStyle = e.hp / e.maxHP < 0.3 ? "#ff987b" : "#efca7e";
          ctx.fillRect(
            barX,
            barY,
            50 * scale * Math.max(0, e.hp / e.maxHP),
            6 * scale,
          );
        }
      }
    }
    for (const b of bullets) {
      if (b.kind !== "orb" && b.kind) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.fillStyle = b.kind === "split" ? "#ed77db" : "#ffab84";
        ctx.strokeStyle = "#572241";
        ctx.lineWidth = 1.5 * scale;
        const r = b.r * (b.kind === "split" ? 1.25 : 1);
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.8);
        ctx.lineTo(r, r * 0.35);
        ctx.lineTo(0, r * 1.15);
        ctx.lineTo(-r, r * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "#fff1d2";
        ctx.lineWidth = 1.5 * scale;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.7);
        ctx.lineTo(0, r * 0.25);
        ctx.stroke();
        ctx.restore();
        continue;
      }
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
        // Short exhaust rooted at the nozzle. Boost transitions also drive background and steering.
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.tilt);
        const flame = ctx.createLinearGradient(0, 30 * scale, 0, 78 * scale);
        flame.addColorStop(0, "#efffff");
        flame.addColorStop(0.4, "#6deee8");
        flame.addColorStop(1, "#63dbe800");
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-6 * scale, 32 * scale);
        ctx.quadraticCurveTo(
          -9 * scale,
          55 * scale,
          0,
          (68 + Math.sin(time * 50) * 7) * scale,
        );
        ctx.quadraticCurveTo(9 * scale, 55 * scale, 6 * scale, 32 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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
    window.FaradayRanking?.stop();
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
    $("modal").querySelector(".modal-card").scrollTop = 0;
    $("modal").querySelector(".modal-card").focus({ preventScroll: true });
  }
  function closeModal(resume = true) {
    if (resume && mode === "ending") {
      ending();
      return;
    }
    window.FaradayRanking?.stop();
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
        "</b></div><div><span>모은 부품</span><b>" +
        stats.parts +
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
          '<button class="primary" data-action="ending">양초 하나가 밝힌 세상 · 엔딩 보기 →</button>',
        "clear",
      );
    } else {
      const choices = U.choices(build, stage);
      // Save the cleared boundary immediately; reloading resumes the NEXT stage.
      save.checkpoint = {
        stage: stage + 1,
        build: clone(build),
        score,
        wing,
        mode: difficulty,
        magnetLevel,
        pulseCharges,
        charge,
      };
      persist();
      showModal(
        '<div class="clear-heading"><span class="eyebrow">STAGE ' +
          (stage + 1) +
          ' CLEAR</span><h2 id="modalTitle">' +
          level.name +
          ' 통과!</h2><p>발명 하나를 고르고 다음 하늘로 출발하세요.</p></div><div class="upgrades">' +
          choices
            .map(
              (u, i) =>
                '<button class="upgrade ' +
                (i === 0 ? "selected" : "") +
                '" aria-pressed="' +
                (i === 0) +
                '" data-upgrade="' +
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
          '</div><button id="nextStageBtn" class="primary next-stage" data-action="next-stage">' +
          (stage + 2) +
          "스테이지 출발 · " +
          (choices[0]?.name || "준비 완료") +
          ' →</button><details class="clear-record"><summary>점수와 패러데이의 발견 기록</summary>' +
          head.replace('id="modalTitle"', 'class="record-title"') +
          "</details>",
        "clear",
      );
    }
    $("modalClose").hidden = true;
  }
  function selectUpgrade(id) {
    if (mode !== "clear") return;
    const u = U.upgrades.find((u) => u.id === id);
    if (!u || build[id] >= u.max) {
      startStage(stage + 1);
      return;
    }
    build[id]++;
    audio.effect("level");
    startStage(stage + 1);
  }
  function showRanking() {
    showModal(
      '<h2 id="modalTitle">공유 비행 순위</h2><div id="faradayRankHost"></div>',
    );
    window.FaradayRanking.mount($("faradayRankHost"), difficulty);
  }
  function resultRanking(cleared) {
    const host = document.createElement("div");
    host.id = "faradayRankHost";
    $("modalContent").append(host);
    window.FaradayRanking.mount(host, difficulty, {
      score: Math.floor(score),
      cleared,
      mode: difficulty,
      token: crypto.randomUUID(),
    });
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
    resultRanking(stage);
  }
  function ending() {
    setMode("ending");
    showModal(
      '<span class="eyebrow">EPILOGUE · THE LIGHT WE SHARE</span><h2 id="modalTitle">양초 하나가 밝힌 세상</h2><figure class="ending-scene"><img src="../assets/faraday-flight/ending.webp?v=' +
        (window.FaradayImageVersions?.ending || "1") +
        '" width="1536" height="1024" alt="나이 든 패러데이가 작은 양초를 앞에 두고 어린 청중에게 과학을 설명하는 창작 그림"><figcaption>패러데이의 양초 강연에서 영감을 받은 창작 그림</figcaption></figure><div class="ending-story"><p>책방에서 시작한 호기심은 세상을 바꾸는 발견으로 이어졌어요. 하지만 건강 때문에 연구를 쉬어야 하는 시간도 있었어요.</p><p>패러데이는 <strong>왕립학회 회장직을 두 번 제안받았지만 모두 사양했어요.</strong> 그는 연구와 함께 사람들에게 과학을 전하는 일에도 힘썼어요.</p><p>왕립연구소의 크리스마스 강연에서는 어린 청중에게 <strong>양초가 녹아 기체가 되고, 그 기체가 타는 과정</strong>을 들려주었어요. 이 강연은 <cite>양초의 화학사</cite>로 남았어요.</p><p>말년에는 <strong>햄프턴 코트의 집</strong>에서 지냈고, 1867년 그곳에서 세상을 떠났어요. 그가 남긴 기록과 강연은 다음 세대에도 과학을 만나는 문이 되었어요.</p><p class="ending-invitation">작은 것에서 질문을 찾고,<br>발견한 것을 함께 나누는 사람.<br>이제, 여러분의 발견을 시작해 보세요.</p></div><details class="ending-sources"><summary>엔딩 속 실제 이야기</summary><p>왕립학회(Royal Society)와 강연이 열린 왕립연구소(Royal Institution)는 다른 기관이에요. 회장직 사양과 과학 강연은 모두 실제 일이지만, 거절의 이유를 아이들 교육 하나로 단정하지 않았어요. 다섯 보스와 비행 모험은 삶에서 영감을 받은 창작이에요.</p><a href="https://www.rigb.org/explore-science/explore/person/michael-faraday-1791-1867" target="_blank" rel="noopener noreferrer">왕립연구소 · 패러데이의 생애 ↗</a><a href="https://royalsociety.org/blog/2020/12/shed-a-little-candlelight/" target="_blank" rel="noopener noreferrer">왕립학회 · 양초 강연 이야기 ↗</a></details><div class="result-stats"><div><span>최종 점수</span><b>' +
        fmt(score) +
        "</b></div><div><span>완주</span><b>5 / 5</b></div><div><span>모은 훈장</span><b>" +
        save.stars.reduce((a, b) => a + b, 0) +
        ' / 15</b></div></div><p class="result-fact">코일을 감고, 자석을 움직이고, 전기를 모았어요. 코일을 지나는 자기장의 변화로 전기를 만든다. 패러데이와 함께 기억할 작은 발견이에요.</p><button class="primary" data-action="map">별 세 개를 향해 다시 날기 →</button><button class="secondary" data-action="title">시작 화면으로</button>',
      "ending",
    );
    $("modalClose").hidden = true;
    resultRanking(5);
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
      '<span class="eyebrow">READY FOR TAKEOFF</span><h2 id="modalTitle">비행은 간단해요</h2><div class="help-row"><strong>① 움직이면, 패러데이도 함께</strong>마우스나 손가락을 누른 채 움직이세요.<br><small>키보드는 방향키 / W A S D. 공격은 자동이에요.</small></div><div class="help-row"><strong>② 원 안의 코일·자석으로 강화해요</strong>코일 ◎ 탄 수·미사일 강화 · 자석 N/S 피해 증가<br><small>♥ 체력 회복 · ‖ 충전된 축전기 · 빨간 △ 과열 파편은 피하세요. 코일·자석을 모아 강화 게이지를 채우면 오버드라이브!</small></div><div class="help-row"><strong>③ 충전된 전기로 돌파해요</strong>자석이 왕복하는 발전기로 충전해요.<br>충전된 축전기의 전기로 스파크 폭풍 / SPACE.<br><small>노란 예고선이 번쩍일 때 쓰면 PERFECT! 적 탄환을 지우고 큰 피해를 줘요. 축전기 아이템은 드물게 나와요. 발전기의 충전 게이지는 다음 스테이지에도 이어져요.</small></div><div class="help-row"><strong>④ 날개 끝은 닿아도 괜찮아요</strong>몸체 가운데 흰 점에 적이나 탄환이 닿지 않게 피하세요.</div><button class="secondary" data-action="close">준비됐어요</button>',
    );
  }
  let noteSpeed = 1,
    noteAngle = 0,
    noteTurns = 1,
    noteField = 1,
    noteCapVoltage = 0,
    noteCurrent = 0,
    notePulseTime = 0;
  function noteSample() {
    return P.movingInductionSample(
      noteTurns,
      noteField,
      1,
      noteSpeed * 3,
      noteAngle,
    );
  }
  function showJournal(tab = 0) {
    journalTab = tab;
    noteSpeed = 1;
    noteTurns = 1;
    noteField = 1;
    noteAngle = 0;
    noteCapVoltage = 0;
    noteCurrent = 0;
    notePulseTime = 0;
    const descriptions = [
      [
        "움직이는 자석으로 전기를 만들어요",
        "자석을 코일에 넣고 빼면 코일을 지나는 자기장이 변해요. 넣을 때와 뺄 때는 전류 방향이 반대예요. 속도를 0으로 내려 멈춰 보세요.",
      ],
      [
        "코일과 자석으로 유도 전압을 키워요",
        "같은 움직임과 코일 크기에서 감은 수를 늘리거나 더 강한 자석을 쓰면 유도 전압이 커져요. 미사일의 개수·종류·피해량은 이를 활용한 게임 규칙이에요.",
      ],
      [
        "정류기로 방향을 맞춘 뒤 저장해요",
        "왕복 운동으로 만든 전기는 방향이 바뀌어요. 다이오드 4개로 된 정류기를 거치면 축전기의 위쪽 판은 +, 아래쪽 판은 −로 충전돼요. 두 판에 반대 전하가 쌓이며 에너지가 저장돼요.",
      ],
    ];
    showModal(
      '<span class="eyebrow">FARADAY’S LITTLE LABORATORY</span><h2 id="modalTitle">발명 노트</h2><div class="journal-tabs">' +
        ["발전", "코일 · 자석", "정류 · 축전기"]
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
        '<p id="noteStatus" class="note-status" role="status"></p>' +
        '<label class="journal-caption">자석의 왕복 속도 <span id="speedValue">1배</span><input type="range" id="speedControl" min="0" max="3" step="0.1" value="1" aria-label="자석 왕복 속도"></label>' +
        (tab === 1
          ? '<label class="journal-caption">코일 감은 수<input type="range" id="turnControl" min="1" max="3" step="1" value="1" aria-label="코일 감은 수"></label><label class="journal-caption">자석의 세기<input type="range" id="fieldControl" min="1" max="3" step="0.1" value="1" aria-label="자석의 세기"></label>'
          : "") +
        (tab === 2
          ? '<button class="secondary" data-action="note-discharge" id="noteDischarge">자석을 멈추고 저장한 에너지로 전구 켜기</button>'
          : "") +
        "<p><strong>" +
        descriptions[tab][0] +
        "</strong><br>" +
        descriptions[tab][1] +
        '</p><p class="science-detail">' +
        (tab === 0
          ? "전구는 코일의 두 끝과 연결된 닫힌 회로에 있어요. 정확히는 자기선속이 변할 때 유도 전압이 생기며, 회로에 전류가 흐르면 전구가 켜져요. 여기서는 코일의 자체 유도와 전구의 열 관성은 생략했어요."
          : tab === 1
            ? "간격만 촘촘해진다고 전압이 무조건 커지지는 않아요. 게임의 충돌은 코일 일부가 풀려 유효한 감은 수가 줄어드는 설정이에요. 자석의 열에 의한 약화와 회복은 재료·온도에 따라 달라요. 7초 뒤 회복과 냉각 아이템은 게임 규칙이에요."
            : "정류된 전압이 축전기 전압보다 높을 때만 충전 전류가 흘러요. 멈춰도 다이오드가 역방향 방전을 막아요. 사용 버튼은 자석을 멈추고 스위치를 닫아 전구로 에너지를 보내요. 판 사이의 절연층으로 전하가 건너가는 것은 아니에요. 이 모형은 다이오드 전압 강하·누설을 생략했으며, 실제 축전기는 서서히 방전될 수 있어요.") +
        '</p><p class="science-detail">발전 에너지는 자석을 움직이는 외부의 일에서 와요. 자석이 에너지를 무한히 만들지는 않아요. 비행기·미사일·스파크 폭풍은 전자기 유도에서 상상한 게임 장비이며 패러데이가 만든 실제 무기가 아니에요.</p><a class="science-source" href="https://openstax.org/books/physics/pages/20-3-electromagnetic-induction" target="_blank" rel="noopener noreferrer">OpenStax · 전자기 유도 ↗</a><a class="science-source" href="https://wiki.analog.com/university/courses/electronics/text/chapter-6" target="_blank" rel="noopener noreferrer">Analog Devices · 정류기와 축전기 회로 ↗</a>',
    );
    drawNote();
  }
  function drawNote() {
    const c = $("noteCanvas");
    if (!c) return;
    const sample = noteSample();
    window.FaradayInductionDiagram.draw(c, {
      sample,
      turns: noteTurns,
      tab: journalTab,
      voltage: noteCapVoltage,
      current: noteCurrent,
      flash: notePulseTime,
    });
    $("speedValue").textContent =
      noteSpeed === 0 ? "멈춤" : noteSpeed.toFixed(1) + "배";
    const direction =
      Math.abs(sample.emf) < 0.02
        ? "유도 전압 0"
        : sample.emf < 0
          ? "넣는 중 · 전류 ←"
          : "빼는 중 · 전류 →";
    const status =
      journalTab === 2
        ? notePulseTime > 0
          ? "저장한 에너지로 전구 켜는 중"
          : noteCurrent > 0.012
            ? "정류기를 거쳐 충전 중"
            : noteCapVoltage > 0.02
              ? "충전 전류 0 · 저장한 에너지는 남아 있어요"
              : "자석을 움직여 충전해 보세요"
        : direction;
    if ($("noteStatus").textContent !== status)
      $("noteStatus").textContent = status;
    if ($("noteDischarge"))
      $("noteDischarge").disabled = noteCapVoltage < 0.03 || notePulseTime > 0;
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
    if (e.target instanceof HTMLInputElement && k !== "Escape") return;
    if (k === "Escape" || k === "p") {
      if (mode === "ending" && $("modalContent").querySelector(".stage-grid")) {
        closeModal();
        e.preventDefault();
        return;
      }
      if (!$("modal").hidden) {
        if (!["clear", "failed", "ending", "briefing"].includes(mode))
          closeModal();
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
    if (b.dataset.upgrade && mode === "clear") {
      for (const option of $("modalContent").querySelectorAll(
        "[data-upgrade]",
      )) {
        const selected = option === b;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      }
      const selected = U.upgrades.find((u) => u.id === b.dataset.upgrade);
      if ($("nextStageBtn"))
        $("nextStageBtn").textContent =
          stage + 2 + "스테이지 출발 · " + selected.name + " →";
    }
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
      case "launch":
        launchChapter();
        break;
      case "chapter-motion": {
        const crawl = $("modalContent").querySelector(".chapter-crawl");
        if (!crawl) break;
        const paused = crawl.classList.toggle("motion-paused");
        b.setAttribute("aria-pressed", String(paused));
        b.textContent = paused ? "글 계속 보기 ▶" : "글 멈추기 Ⅱ";
        break;
      }
      case "ranking":
        showRanking();
        break;
      case "note-discharge":
        if (noteCapVoltage > 0.03) {
          noteSpeed = 0;
          noteCurrent = 0;
          notePulseTime = 1.5;
          $("speedControl").value = "0";
        }
        break;
      case "next-stage":
        selectUpgrade(
          $("modalContent").querySelector("[data-upgrade].selected")?.dataset
            .upgrade,
        );
        break;
      case "back-lab":
        window.top.location.assign(
          new URL("../lab.html?play=all", location.href).href,
        );
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
        "ending",
        "foes-books",
        "foes-gates",
        "foes-symbols",
        "foes-lab",
        "foes-records",
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
  // QA is opt-in; this mode disables remote score registration in leaderboard.js.
  if (new URLSearchParams(location.search).has("qa"))
    window.__faraday = {
      manual(value = true) {
        manualClock = value;
        accumulator = 0;
      },
      ready: () => loadPromise,
      get noteState() {
        return {
          sample: noteSample(),
          voltage: noteCapVoltage,
          current: noteCurrent,
          flash: notePulseTime,
          speed: noteSpeed,
        };
      },
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
          fever,
          feverTime,
          magnetLevel,
          heatTime,
          pulseCharges,
          charge,
          rotorAngle,
          generator: generator(),
        };
      },
      step(seconds, render = true) {
        for (let i = 0; i < seconds * 60; i++) update(1 / 60);
        if (render) draw();
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
