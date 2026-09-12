/* Afterlight: ideal classical optics, time-averaged powers normalized to source output.
   The default source output is 1. No particle simulation. Angles are in degrees. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AfterlightPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const clamp = x => Math.max(0, Math.min(1, x));
  function reflect(dx, dy, slash) { return slash === 0 ? [-dy, -dx] : [dy, dx]; }
  function polarize(input, axis, filters) {
    let power = input, angle = axis, absorbed = 0;
    const stages = [];
    for (const next of filters) {
      const before = power;
      power *= angle === null ? .5 : Math.cos((next - angle) * RAD) ** 2;
      if (power < 1e-12) power = 0;
      absorbed += before - power;
      stages.push({ before, after: power, angle: next, absorbed: before - power });
      angle = next;
    }
    // angle records the last axis setting; it does not describe a field if power is zero.
    return { power, angle, stages, absorbed };
  }
  // Two identical lossless 50:50 splitters B=(1/sqrt(2))*[[1,i],[i,1]].
  // In the drawn geometry: upper port a=(sqrt(Tl)-sqrt(Tu)*exp(i*delta))/2;
  // right port b=i*(sqrt(Tu)*exp(i*delta)+sqrt(Tl))/2. Tu/Tl are power transmissions.
  // delta is the propagation phase difference between arms (upper minus lower).
  // Splitter reflection/transmission phases are included separately through B above.
  // Each arm has one identical mirror; their common phase cancels from the powers.
  function interferometer(phase, top = 1, bottom = 1, input = 1) {
    top = clamp(top); bottom = clamp(bottom);
    const cross = 2 * Math.sqrt(top * bottom) * Math.cos(phase * RAD);
    const a = Math.max(0, input * (top + bottom - cross) / 4);
    const b = Math.max(0, input * (top + bottom + cross) / 4);
    return { a, b, absorbed: input * (1 - (top + bottom) / 2), upper: input * top / 2, lower: input * bottom / 2 };
  }
  function trace(level, values) {
    const map = new Map(level.parts.map((p, i) => [p.x + ',' + p.y, { ...p, index: i }]));
    const targets = {}, segments = [], hits = {};
    let absorbed = 0, escaped = 0, unresolved = 0;
    const queue = [{ x: level.source.x, y: level.source.y, dx: 1, dy: 0, power: 1, seen: new Set() }];
    let budget = 0;
    while (queue.length) {
      const ray = queue.shift();
      if (++budget > 1000) { unresolved += ray.power; continue; }
      const { x, y, dx, dy, power, seen } = ray;
      const nx = x + dx, ny = y + dy;
      segments.push({ x1: x, y1: y, x2: nx, y2: ny, power });
      if (nx < 0 || ny < 0 || nx >= level.cols || ny >= level.rows) { escaped += power; continue; }
      const key = nx + ',' + ny + ',' + dx + ',' + dy;
      if (seen.has(key)) { unresolved += power; continue; }
      const nextSeen = new Set(seen); nextSeen.add(key);
      const part = map.get(nx + ',' + ny);
      const next = (vx, vy, p) => queue.push({ x: nx, y: ny, dx: vx, dy: vy, power: p, seen: new Set(nextSeen) });
      if (!part) { next(dx, dy, power); continue; }
      hits[part.index] = (hits[part.index] || 0) + power;
      if (part.type === 'wall' || part.type === 'dump') { absorbed += power; continue; }
      if (part.type === 'target') { targets[part.id] = (targets[part.id] || 0) + power; continue; }
      const orientation = values[part.index] ?? part.value ?? 0;
      const [rx, ry] = reflect(dx, dy, orientation);
      if (part.type === 'split') { next(dx, dy, power / 2); next(rx, ry, power / 2); }
      else next(rx, ry, power);
    }
    return { targets, segments, hits, absorbed, escaped, unresolved };
  }
  function satisfied(value, goal) { return value >= goal[0] - 1e-9 && value <= goal[1] + 1e-9; }
  return { reflect, polarize, interferometer, trace, satisfied };
});
