// Refresh the existing PN activity and shared catalog cache URLs.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value);
const hash = value => crypto.createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const data = JSON.parse(read('data/experiments.json'));
const entry = data.experiments.find(item => item.id === 'pn-junction');
if (!entry) throw new Error('PN junction is not registered');
entry.path = 'experiments/pn-junction.html?v=' + hash(read('experiments/pn-junction.html'));
entry.date = '2026-09-13';
const json = JSON.stringify(data, null, 2) + '\n';
const js = 'window.EXPERIMENTS_DATA = ' + json.trimEnd() + ';\n';
write('data/experiments.json', json); write('assets/js/experiments-data.js', js);
for (const file of ['index.html', 'lab.html', 'view.html', 'admin-k7f3x9q2.html']) {
  write(file, read(file).replace(/assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,
    'assets/js/experiments-data.js?v=' + hash(js)));
}
console.log('Updated PN junction: ' + entry.path);
