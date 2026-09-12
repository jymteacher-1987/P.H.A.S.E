(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FaradayPhysics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const EPS = 1e-7;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const normalize = (v) => {
    const l = Math.hypot(v.x, v.y);
    return l > EPS ? { x: v.x / l, y: v.y / l } : { x: 0, y: -1 };
  };
  function reflect(direction, normal) {
    const d = normalize(direction),
      n = normalize(normal),
      k = 2 * dot(d, n);
    return { x: d.x - k * n.x, y: d.y - k * n.y };
  }
  function raySegment(origin, direction, a, b) {
    const d = normalize(direction),
      s = { x: b.x - a.x, y: b.y - a.y },
      q = { x: a.x - origin.x, y: a.y - origin.y },
      den = cross(d, s);
    if (Math.abs(den) < EPS) return null;
    const t = cross(q, s) / den,
      u = cross(q, d) / den;
    return t > EPS && u >= -EPS && u <= 1 + EPS
      ? { t, x: origin.x + d.x * t, y: origin.y + d.y * t }
      : null;
  }
  function rayCircle(origin, direction, circle) {
    const d = normalize(direction),
      q = { x: origin.x - circle.x, y: origin.y - circle.y },
      b = dot(q, d),
      c = dot(q, q) - circle.r * circle.r,
      disc = b * b - c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc),
      t1 = -b - s,
      t2 = -b + s,
      t = t1 > EPS ? t1 : t2 > EPS ? t2 : null;
    return t === null
      ? null
      : { t, x: origin.x + d.x * t, y: origin.y + d.y * t };
  }
  function pointSegmentDistance(p, a, b) {
    const x = b.x - a.x,
      y = b.y - a.y,
      l = x * x + y * y,
      t = l
        ? Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / l))
        : 0;
    return Math.hypot(p.x - a.x - t * x, p.y - a.y - t * y);
  }
  function trace(
    origin,
    direction,
    surfaces = [],
    targets = [],
    maxDistance = 1800,
    maxBounces = 5,
  ) {
    let p = { ...origin },
      d = normalize(direction),
      remaining = maxDistance,
      segments = [],
      reflections = 0,
      last = null;
    for (let i = 0; i <= maxBounces; i++) {
      let best = null,
        object = null;
      for (const surface of surfaces) {
        if (surface === last) continue;
        const h = raySegment(p, d, surface.a, surface.b);
        if (h && h.t < remaining && (!best || h.t < best.t)) {
          best = h;
          object = surface;
        }
      }
      for (const target of targets) {
        const h = rayCircle(p, d, target);
        if (h && h.t < remaining && (!best || h.t < best.t)) {
          best = h;
          object = target;
        }
      }
      if (!best) {
        segments.push({
          a: p,
          b: { x: p.x + d.x * remaining, y: p.y + d.y * remaining },
          reflected: reflections > 0,
        });
        return { segments, hit: null, reflections };
      }
      const end = { x: best.x, y: best.y };
      segments.push({ a: p, b: end, reflected: reflections > 0 });
      if (object.kind !== "mirror")
        return { segments, hit: object, reflections };
      reflections++;
      remaining -= best.t;
      const n = object.normal || {
        x: object.a.y - object.b.y,
        y: object.b.x - object.a.x,
      };
      d = reflect(d, n);
      p = { x: end.x + d.x * 0.002, y: end.y + d.y * 0.002 };
      last = object;
    }
    return { segments, hit: null, reflections };
  }
  function inductionSample(turns, field, area, omega, angle) {
    return {
      flux: field * area * Math.cos(angle),
      emf: turns * field * area * omega * Math.sin(angle),
    };
  }
  return {
    dot,
    cross,
    normalize,
    reflect,
    raySegment,
    rayCircle,
    pointSegmentDistance,
    trace,
    inductionSample,
  };
});
