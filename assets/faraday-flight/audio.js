(function () {
  "use strict";
  class FlightAudio {
    constructor() {
      this.context = null;
      this.enabled = true;
      this.volume = 0.45;
      this.stage = 0;
      this.boss = false;
      this.running = false;
      this.next = 0;
      this.step = 0;
      this.lastShot = 0;
      this.timer = null;
    }
    start() {
      if (!this.enabled) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!this.context) {
          this.context = new AC();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume * 0.34;
          this.master.connect(this.context.destination);
          this.music = this.context.createGain();
          this.music.gain.value = 0.66;
          this.music.connect(this.master);
          this.fx = this.context.createGain();
          this.fx.gain.value = 0.75;
          this.fx.connect(this.master);
          this.noiseBuffer = this.context.createBuffer(
            1,
            this.context.sampleRate * 0.3,
            this.context.sampleRate,
          );
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < data.length; i++)
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        if (this.context.state === "suspended")
          this.context.resume().catch(() => {});
        if (!this.timer) this.timer = setInterval(() => this.schedule(), 80);
        this.running = true;
        this.next = Math.max(this.next, this.context.currentTime + 0.04);
      } catch {}
    }
    setEnabled(value) {
      this.enabled = value;
      if (!value) {
        this.running = false;
        if (this.master)
          this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
      } else {
        if (this.master)
          this.master.gain.setTargetAtTime(
            this.volume * 0.34,
            this.context.currentTime,
            0.04,
          );
        this.start();
      }
    }
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master)
        this.master.gain.setTargetAtTime(
          this.enabled ? this.volume * 0.34 : 0,
          this.context.currentTime,
          0.03,
        );
    }
    pause() {
      this.running = false;
    }
    note(
      freq,
      start,
      duration = 0.16,
      gain = 0.08,
      type = "triangle",
      dest = this.music,
      slide = 0,
    ) {
      if (!this.context || !this.enabled) return;
      const o = this.context.createOscillator(),
        g = this.context.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      if (slide)
        o.frequency.exponentialRampToValueAtTime(
          Math.max(30, freq + slide),
          start + duration,
        );
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      o.connect(g);
      g.connect(dest);
      o.start(start);
      o.stop(start + duration + 0.02);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    }
    noise(time, volume = 0.025) {
      if (!this.context || !this.enabled) return;
      const s = this.context.createBufferSource(),
        f = this.context.createBiquadFilter(),
        g = this.context.createGain();
      s.buffer = this.noiseBuffer;
      f.type = "highpass";
      f.frequency.value = 6000;
      g.gain.setValueAtTime(volume, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.085);
      s.connect(f);
      f.connect(g);
      g.connect(this.music);
      s.start(time);
      s.stop(time + 0.1);
      s.onended = () => {
        s.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }
    schedule() {
      if (!this.context || !this.running || !this.enabled) return;
      const now = this.context.currentTime;
      if (this.next < now - 0.5) this.next = now + 0.03;
      const bpm = this.boss ? 144 : 120 + Math.min(12, this.stage),
        beat = 60 / bpm / 4;
      while (this.next < now + 0.18) {
        const s = this.step % 64,
          bar = Math.floor(s / 16),
          chords = [
            [50, 57, 62, 65],
            [46, 53, 58, 62],
            [53, 60, 65, 69],
            [48, 55, 60, 64],
          ],
          c = chords[bar];
        const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
        if (s % 4 === 0) {
          this.note(freq(c[0] - 12), this.next, 0.23, 0.19, "triangle");
          this.note(95, this.next, 0.15, 0.26, "sine", this.music, -60);
        }
        if (s % 8 === 4) this.noise(this.next, 0.09);
        if (s % 2 === 0) this.noise(this.next, 0.025);
        const arps = [0, 2, 1, 3, 2, 1, 3, 2];
        if (s % 2 === 0)
          this.note(
            freq(c[arps[(s / 2) % 8]] + 12),
            this.next,
            0.23,
            0.057,
            "triangle",
          );
        const melody = [
          74, 77, 81, 77, 79, 77, 74, 72, 70, 74, 77, 74, 77, 74, 70, 69, 77,
          81, 84, 81, 79, 77, 76, 74, 72, 76, 79, 76, 74, 72, 69, 72,
        ];
        if (s % 2 === 0)
          this.note(freq(melody[s / 2]), this.next, 0.26, 0.07, "sine");
        this.next += beat;
        this.step++;
      }
    }
    effect(name) {
      if (!this.context || !this.enabled) return;
      const t = this.context.currentTime,
        d = this.fx;
      switch (name) {
        case "laser":
        case "cannon":
          if (t - this.lastShot < 0.14) return;
          this.lastShot = t;
          this.note(
            name === "cannon" ? 220 : 950,
            t,
            0.12,
            0.035,
            "triangle",
            d,
            name === "cannon" ? -110 : -620,
          );
          this.note(1500, t, 0.06, 0.017, "sine", d, -950);
          break;
        case "evolve":
          [392, 587, 784, 1175].forEach((hz, i) =>
            this.note(hz, t + i * 0.06, 0.22, 0.1, "triangle", d),
          );
          break;
        case "shot":
          if (t - this.lastShot < 0.14) return;
          this.lastShot = t;
          this.note(700, t, 0.045, 0.023, "sine", d, 500);
          break;
        case "collect":
          this.note(1100, t, 0.075, 0.085, "sine", d, 380);
          break;
        case "hit":
          this.note(180, t, 0.18, 0.24, "sawtooth", d, -130);
          break;
        case "kill":
          this.note(340, t, 0.07, 0.09, "triangle", d, -220);
          break;
        case "shield":
          this.note(500, t, 0.18, 0.12, "sine", d, 650);
          this.note(750, t, 0.3, 0.08, "triangle", d, 300);
          break;
        case "counter":
          for (let i = 0; i < 5; i++)
            this.note(
              [587, 740, 880, 1175, 1480][i],
              t + i * 0.035,
              0.24,
              0.14,
              "triangle",
              d,
            );
          this.note(100, t, 0.3, 0.18, "sine", d, -50);
          break;
        case "perfect":
          for (let i = 0; i < 7; i++)
            this.note(
              [587, 740, 880, 1175, 1480, 1760, 2349][i],
              t + i * 0.025,
              0.33,
              0.12,
              "triangle",
              d,
            );
          break;
        case "level":
          for (let i = 0; i < 4; i++)
            this.note(
              [659, 784, 988, 1319][i],
              t + i * 0.08,
              0.3,
              0.15,
              "sine",
              d,
            );
          break;
        case "clear":
          for (let i = 0; i < 6; i++)
            this.note(
              [587, 740, 880, 1175, 1480, 1760][i],
              t + i * 0.11,
              0.6,
              0.13,
              "triangle",
              d,
            );
          break;
        case "fail":
          for (let i = 0; i < 4; i++)
            this.note(
              [392, 349, 294, 196][i],
              t + i * 0.18,
              0.5,
              0.12,
              "triangle",
              d,
            );
          break;
        case "fever":
          for (let i = 0; i < 8; i++)
            this.note(
              440 * Math.pow(2, i / 5),
              t + i * 0.045,
              0.25,
              0.12,
              "sine",
              d,
            );
          break;
        case "warning":
          this.note(440, t, 0.12, 0.1, "sine", d);
          this.note(660, t + 0.17, 0.12, 0.08, "sine", d);
          break;
      }
    }
  }
  window.FlightAudio = FlightAudio;
})();
