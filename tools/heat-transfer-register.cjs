// Register the heat-transfer comparison experiment in both catalogs and refresh their cache versions.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, data) => fs.writeFileSync(path.join(root, file), data);
const hash = data => crypto.createHash('sha256').update(data.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const data = JSON.parse(read('data/experiments.json'));
const id = 'heat-transfer-compare';
const entry = {
  id, title: '열의 이동: 전도·대류·복사 비교', category: 'thermal',
  description: '금속 막대, 물, 떨어져 있는 판을 나란히 가열하며 열이 전도, 대류, 복사로 이동하는 모습을 모형으로 비교하고, 물질을 없앴을 때 어떤 방식이 남는지 확인합니다.',
  lessonNote: {
    question: '열이 이동하려면 반드시 물질이 있어야 할까요?',
    focus: '가열했을 때 세 칸에서 입자가 어떻게 움직이는지 비교하고, 물질을 없앤 뒤 다시 가열해 어느 칸의 온도계가 오르는지 기록표로 확인해 보세요.'
  },
  path: 'experiments/heat-transfer-compare.html?v=' + hash(read('experiments/heat-transfer-compare.html')),
  date: '2026-11-28', tags: ['열의 이동', '전도', '대류', '복사', '열전달']
};
const existing = data.experiments.findIndex(e => e.id === id);
// Keep fields added later when refreshing an existing entry.
if (existing < 0) data.experiments.push(entry); else data.experiments[existing] = { ...data.experiments[existing], ...entry };
const json = JSON.stringify(data, null, 2) + '\n';
const js = 'window.EXPERIMENTS_DATA = ' + json.trimEnd() + ';\n';
write('data/experiments.json', json); write('assets/js/experiments-data.js', js);
for (const file of ['index.html', 'lab.html', 'view.html', 'admin-k7f3x9q2.html']) {
  write(file, read(file).replace(/assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,
    'assets/js/experiments-data.js?v=' + hash(js)));
}
console.log('Registered heat-transfer-compare under thermal: ' + data.experiments.length + ' experiments');
