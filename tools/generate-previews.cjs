/* Capture real activity scenes once at build time. No activity runs in cards. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'assets/previews');
const normalize = value => String(value).replace(/\r\n/g, '\n');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(path.join(root, file));
const WIDTH = 720, HEIGHT = 540;
const recipes = JSON.parse(read('tools/preview-scenes.json'));
const catalog = JSON.parse(read('data/experiments.json'));
const entries = [...catalog.experiments, ...catalog.plays];
const manifestFile = path.join(dir, 'index.json');
const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { items: {} };
const engineHash = hash(['tools/generate-previews.cjs', 'assets/js/browser-compat.js', 'package-lock.json'].map(file => normalize(read(file))).join('\n'));

function localFile(relative) {
  const file = path.resolve(root, relative.split('?')[0]);
  if (!file.startsWith(root + path.sep)) throw new Error('Activity must be inside the repository: ' + relative);
  return file;
}
function fingerprint(entry) {
  // Include local assets loaded by the page, even when their URLs stay the same.
  const visited = new Set();
  function dependency(file) {
    if (visited.has(file)) return '';
    visited.add(file);
    const bytes = fs.readFileSync(file);
    const relative = path.relative(root, file).split(path.sep).join('/');
    let result = relative + ':' + hash(bytes);
    if (/\.(?:html|js|css)$/i.test(file)) {
      const source = normalize(bytes);
      result = relative + ':' + hash(source);
      for (const match of source.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)(?:\?[^"']*)?["']/g)) {
        const url = match[1];
        if (/^(?:[a-z]+:|\/\/|\/)/i.test(url)) continue;
        const candidate = path.resolve(path.dirname(file), url);
        if (candidate.startsWith(root + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) result += dependency(candidate);
      }
    }
    return result;
  }
  return hash(engineHash + dependency(localFile(entry.path)) + JSON.stringify(recipes[entry.id] || {}));
}
function validImage(item) {
  if (!item || !/^assets\/previews\/[a-z0-9-]+-[a-f0-9]{10}\.webp$/.test(item.src)) return false;
  const file = path.join(root, item.src);
  if (!fs.existsSync(file)) return false;
  const bytes = fs.readFileSync(file);
  return bytes.length === item.bytes && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP' && item.src.endsWith(hash(bytes).slice(0, 10) + '.webp');
}
function refreshVersions() {
  const assets = ['assets/js/device.js', 'assets/js/mobile-launch.js', 'assets/js/view.js', 'assets/js/lab.js', 'assets/css/style.css', 'assets/previews/index.js'];
  for (const html of ['index.html', 'lab.html', 'view.html', 'admin-k7f3x9q2.html']) {
    const file = path.join(root, html);
    const old = fs.readFileSync(file, 'utf8');
    let text = old;
    for (const asset of assets) text = text.replace(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?v=[^"\\s]+)?', 'g'), asset + '?v=' + hash(normalize(read(asset))).slice(0, 10));
    if (old !== text) fs.writeFileSync(file, text);
  }
}
function startServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    try {
      const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      const file = localFile(relative);
      if (!fs.statSync(file).isFile()) throw new Error('Not a file');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (_) { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
async function main() {
  const ids = entries.map(entry => entry.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z0-9-]+$/.test(id))) throw new Error('Catalog IDs must be unique safe filenames.');
  const wanted = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
  const force = process.argv.includes('--force');
  const pending = entries.filter(entry => (!wanted || wanted.includes(entry.id)) && (force || !validImage(previous.items[entry.id]) || previous.items[entry.id].sourceHash !== fingerprint(entry)));
  if (process.argv.includes('--check')) {
    if (pending.length) throw new Error('Missing or outdated previews: ' + pending.map(entry => entry.id).join(', '));
    const expected = 'window.PHASE_PREVIEWS = ' + JSON.stringify(previous, null, 2) + ';\n';
    if (normalize(read('assets/previews/index.js')) !== expected) throw new Error('Preview JS/JSON manifests differ.');
    console.log('Verified ' + entries.length + ' current WebP screenshots and both manifests.');
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { version: 1, width: WIDTH, height: HEIGHT, items: {} };
  for (const entry of entries) if (previous.items[entry.id]) manifest.items[entry.id] = previous.items[entry.id];
  let browser, server;
  const generated = new Map();
  try {
    if (pending.length) {
      const { chromium } = require('playwright');
      const sharp = require('sharp');
      server = await startServer();
      const origin = 'http://127.0.0.1:' + server.address().port;
      browser = await chromium.launch({ headless: true, ...(process.env.PREVIEW_BROWSER_CHANNEL ? { channel: process.env.PREVIEW_BROWSER_CHANNEL } : {}) });
      for (const entry of pending) {
        const recipe = recipes[entry.id] || {};
        const context = await browser.newContext({ viewport: recipe.viewport || { width: 960, height: 720 }, deviceScaleFactor: 1, locale: 'ko-KR', colorScheme: 'light', serviceWorkers: 'block' });
        try {
          // Fresh contexts never use visitor accounts, photos, saves or rankings.
          await context.route('**/*', route => {
            const request = route.request(), url = new URL(request.url());
            const asset = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname);
            if (request.method() === 'GET' && (url.origin === origin || asset)) return route.continue();
            return route.abort();
          });
          await context.addInitScript(() => {
            let seed = 1987;
            Math.random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin + '/' + entry.path, { waitUntil: 'load', timeout: 60000 });
          await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.decode().catch(() => {}))]));
          await page.waitForTimeout(1200);
          for (const step of recipe.steps || []) {
            if (step.click) await page.locator(step.click).click({ timeout: 15000 });
            else if (step.select) await page.locator(step.select).selectOption(step.value);
            else if (step.wait) await page.waitForTimeout(step.wait);
            else if (step.press) await page.keyboard.press(step.press);
          }
          if (errors.length) throw new Error(entry.id + ': ' + errors.join('; '));
          const png = recipe.target ? await page.locator(recipe.target).screenshot({ animations: 'disabled' }) : await page.screenshot({ animations: 'disabled' });
          const bytes = await sharp(png).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' }).webp({ quality: 78, effort: 5 }).toBuffer();
          const stats = await sharp(bytes).stats();
          if (stats.entropy < 1) throw new Error(entry.id + ': screenshot appears blank');
          const src = 'assets/previews/' + entry.id + '-' + hash(bytes).slice(0, 10) + '.webp';
          generated.set(src, bytes);
          manifest.items[entry.id] = { src, sourceHash: fingerprint(entry), bytes: bytes.length };
          console.log(entry.id + ': ' + Math.round(bytes.length / 1024) + ' KB');
        } finally { await context.close(); }
      }
    }
    // Publish only after every requested capture succeeds. Failures retain all old images.
    for (const [src, bytes] of generated) fs.writeFileSync(path.join(root, src), bytes);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'index.js'), 'window.PHASE_PREVIEWS = ' + JSON.stringify(manifest, null, 2) + ';\n');
    refreshVersions();
    const retained = new Set(Object.values(manifest.items).map(item => item.src));
    for (const item of Object.values(previous.items)) if (!retained.has(item.src) && validImage(item)) fs.unlinkSync(path.join(root, item.src));
    console.log('Saved ' + Object.keys(manifest.items).length + ' previews (' + pending.length + ' regenerated).');
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
