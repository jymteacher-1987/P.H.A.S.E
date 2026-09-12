const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), sharp = require('sharp');
const root = path.resolve(__dirname, '..'), atlas = require('../assets/faraday-flight/sprites.json');
test('Faraday artwork has distinct, bounded animation cels with real transparency', async () => {
  for (const [name, frames] of Object.entries(atlas)) {
    const file = path.join(root, 'assets/faraday-flight', name+'.webp');
    const {data,info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let transparent=0, visible=0;
    for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>180)visible++;}
    assert.ok(transparent>info.width*info.height*.1, name+' needs transparent margins');
    assert.ok(visible>info.width*info.height*.08, name+' must contain artwork');
    const hashes=[];
    for(const f of frames){
      assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=info.width&&f.y+f.h<=info.height, name+' source bounds');
      assert.ok(f.ax>=f.x&&f.ax<=f.x+f.w&&f.ay>=f.y&&f.ay<=f.y+f.h, name+' registration point');
      const bytes=await sharp(file).extract({left:f.x,top:f.y,width:f.w,height:f.h}).raw().toBuffer();
      hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
    assert.equal(new Set(hashes).size,frames.length,name+' must have genuinely distinct frames');
  }
  assert.equal(atlas.hero.length,8);
  assert.equal(atlas.enemies.length,12);
  for(const boss of ['poverty','gate','symbols','boss','fog'])assert.ok(atlas[boss].length>=4);
});
test('Faraday is immediately before Afterlight in both catalogs, with five historical stages',()=>{
  const data=JSON.parse(fs.readFileSync(path.join(root,'data/experiments.json'),'utf8'));
  const ids=data.plays.map(p=>p.id);
  assert.equal(ids.indexOf('faraday-flight')+1,ids.indexOf('afterlight'));
  const browser={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'assets/js/experiments-data.js'),'utf8'),{window:browser});
  assert.equal(JSON.stringify(data),JSON.stringify(browser.EXPERIMENTS_DATA));
  const levels=require('../assets/faraday-flight/levels.js').levels;
  assert.equal(levels.length,5);assert.equal(new Set(levels.map(l=>l.bossArt)).size,5);
  for(const l of levels){assert.ok(l.boss&&l.story&&l.source.startsWith('https://'));}
});
