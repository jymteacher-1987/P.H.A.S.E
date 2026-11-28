// Register the Galileo inclined-plane experiment in both catalogs and refresh their cache versions.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, data) => fs.writeFileSync(path.join(root, file), data);
const hash = data => crypto.createHash('sha256').update(data.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const data = JSON.parse(read('data/experiments.json'));
const id = 'galileo-inclined-plane';
const entry = {
  id, title: '갈릴레오의 빗면 사고 실험', category: 'mechanics',
  description: '마찰이 없는 두 빗면에서 공을 놓고 오른쪽 빗면의 경사각을 바꾸며, 공이 처음 높이까지 올라가는지와 경사각이 0°일 때 어떤 운동을 하는지 관찰합니다.',
  lessonNote: {
    question: '오른쪽 빗면을 점점 눕히다가 완전히 수평으로 만들면 공은 어떻게 운동할까요?',
    focus: '경사각을 60°에서 0°까지 줄이며 공이 올라간 높이와 이동 거리를 기록표에서 비교하고, 0°에서는 점 사이의 간격과 속력–시간 그래프를 살펴보세요.'
  },
  path: 'experiments/galileo-inclined-plane.html?v=' + hash(read('experiments/galileo-inclined-plane.html')),
  date: '2026-11-28', tags: ['갈릴레오', '빗면', '관성', '등속 직선 운동', '사고 실험']
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
console.log('Registered galileo-inclined-plane under mechanics: ' + data.experiments.length + ' experiments');
