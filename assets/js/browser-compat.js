/* Drawing fallback for Safari versions without Canvas roundRect (including iOS 15).
   Loaded before each activity, including direct links and preview frames. */
(function () {
  function roundRect(x, y, width, height, radii = 0) {
    x = Number(x); y = Number(y); width = Number(width); height = Number(height);
    let list = typeof radii === 'object' && radii !== null && Symbol.iterator in radii
      ? Array.from(radii) : [radii];
    if (!list.length || list.length > 4) throw new RangeError('Expected 1 to 4 corner radii');
    list = list.map(r => typeof r === 'object' && r !== null
      ? { x: Number(r.x ?? 0), y: Number(r.y ?? 0) }
      : { x: Number(r), y: Number(r) });
    if (list.some(r => r.x < 0 || r.y < 0)) throw new RangeError('Negative corner radius');
    if (![x, y, width, height, ...list.flatMap(r => [r.x, r.y])].every(Number.isFinite)) return;
    let [tl, tr = tl, br = tl, bl = tr] = list;
    if (width < 0) { x += width; width = -width; [tl, tr, br, bl] = [tr, tl, bl, br]; }
    if (height < 0) { y += height; height = -height; [tl, tr, br, bl] = [bl, br, tr, tl]; }
    const ratio = (size, sum) => sum ? size / sum : 1;
    const scale = Math.min(1, ratio(width, tl.x + tr.x), ratio(width, bl.x + br.x),
      ratio(height, tl.y + bl.y), ratio(height, tr.y + br.y));
    [tl, tr, br, bl] = [tl, tr, br, bl].map(r => ({ x: r.x * scale, y: r.y * scale }));
    const corner = (cx, cy, r, start, end) => {
      if (r.x && r.y) this.ellipse(cx, cy, r.x, r.y, 0, start, end);
      else this.lineTo(cx + r.x * Math.cos(end), cy + r.y * Math.sin(end));
    };
    this.moveTo(x + tl.x, y);
    this.lineTo(x + width - tr.x, y);
    corner(x + width - tr.x, y + tr.y, tr, -Math.PI / 2, 0);
    this.lineTo(x + width, y + height - br.y);
    corner(x + width - br.x, y + height - br.y, br, 0, Math.PI / 2);
    this.lineTo(x + bl.x, y + height);
    corner(x + bl.x, y + height - bl.y, bl, Math.PI / 2, Math.PI);
    this.lineTo(x, y + tl.y);
    corner(x + tl.x, y + tl.y, tl, Math.PI, Math.PI * 1.5);
    this.closePath();
    this.moveTo(x, y);
  }
  for (const ctor of [window.CanvasRenderingContext2D, window.Path2D, window.OffscreenCanvasRenderingContext2D]) {
    if (ctor && !ctor.prototype.roundRect) {
      Object.defineProperty(ctor.prototype, 'roundRect', { value: roundRect, writable: true, configurable: true });
    }
  }
})();
