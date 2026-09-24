const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../plays/hero-maker.html'), 'utf8');
const context = {};
vm.runInNewContext(source.slice(source.indexOf('const P = {'), source.indexOf('function simHtml(')) + '\nthis.sims=SIMS;', context);
const close = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-12, `${actual} != ${expected}`);

function painted(simulation, values, state = {}) {
  const labels = [], gradient = {addColorStop(){}};
  const g = new Proxy({measureText:text=>({width:String(text).length*7}),
    fillText:text=>labels.push(String(text)), createLinearGradient:()=>gradient,
    createRadialGradient:()=>gradient}, {get:(obj,key)=>key in obj?obj[key]:()=>{}});
  simulation.draw(g, 720, 390, values, state, 0);
  return labels;
}

test('fruit-cell meter matches its loaded circuit while series open-circuit voltage still rises', () => {
  const cell = context.sims.fruitcell;
  for (const a of ['zn','al','fe','cu','ag']) for (const b of ['zn','al','fe','cu','ag']) {
    for (const e of ['lemon','potato','salt','pure']) for (let n=1;n<=4;n++) {
      const values = {a,b,e,n}, emf = cell.volts(values), current = cell.current(values);
      const expected = Math.min(emf, 1.8), measured = cell.terminalVolts(values);
      close(measured, expected);
      close(emf, measured + current*900*n);
      close(emf, cell.volts({...values,n:1})*n);
      assert.ok(painted(cell, values).includes(expected.toFixed(2)+' V'));
      assert.ok(cell.read(values).startsWith('연결 전 '+emf.toFixed(2)+' V'));
    }
  }
  const values={a:'zn',b:'cu',e:'lemon',n:4};
  close(cell.volts(values), 3.74);
  close(cell.terminalVolts(values), 1.8);
  close(cell.current(values), (3.74-1.8)/3600);
  assert.equal(cell.lit(values), true);
  assert.ok(cell.tip(values).includes('LED 연결 후'));
});

test('low-tension string phone keeps attenuation without claiming positive string transmission is air-only', () => {
  const phone = context.sims.stringphone;
  for (const ten of [1,2,3]) {
    const state=phone.init(); phone.onButton('talk', {ten}, state);
    const labels=painted(phone, {ten}, state);
    const amounts=labels.find(text=>text.startsWith('실을 타고')).match(/\d+/g).map(Number);
    assert.ok(amounts[0]>0 && amounts[1]>0);
    assert.ok(labels.some(text=>text.includes('잘 전달되지 않아')));
    assert.ok(!labels.some(text=>text.includes('공기로만')));
    assert.ok(!phone.tip({ten},state).includes('실이 아니라'));
  }
});
