// Update the existing two catalogs and their cache versions after an experiment edit.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, data) => fs.writeFileSync(path.join(root, file), data);
const hash = data => crypto.createHash('sha256').update(data.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
const data = JSON.parse(read('data/experiments.json'));
const id = 'photoelectric-effect';
const entry = {
  id, title: '광전효과 원리 이해하기', category: 'modern-physics',
  description: '빛의 파장, 들어오는 광자 수와 전압을 바꾸며 광전자의 운동을 관찰합니다. 일함수와 한계 진동수, 최대 운동 에너지, 광전류와 정지 전압의 관계를 탐구합니다.',
  path: 'experiments/photoelectric-effect.html?v=' + hash(read('experiments/photoelectric-effect.html')),
  date: '2026-09-13', tags: ['광전효과', '광자', '일함수', '정지 전압', '빛의 입자성']
};
const existing = data.experiments.findIndex(e => e.id === id);
if (existing < 0) data.experiments.push(entry); else data.experiments[existing] = entry;
const json = JSON.stringify(data, null, 2) + '\n';
const js = 'window.EXPERIMENTS_DATA = ' + json.trimEnd() + ';\n';
write('data/experiments.json', json); write('assets/js/experiments-data.js', js);
for (const file of ['index.html', 'lab.html', 'view.html', 'admin-k7f3x9q2.html']) {
  write(file, read(file).replace(/assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,
    'assets/js/experiments-data.js?v=' + hash(js)));
}
console.log('Registered photoelectric-effect under modern-physics: ' + data.experiments.length + ' experiments');
