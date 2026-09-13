// Read-only verification of the public Pages files; does not run analytics or write visitor data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='https://jymteacher-1987.github.io/P.H.A.S.E/';
const local=JSON.parse(fs.readFileSync(path.join(root,'data/experiments.json'),'utf8')).experiments.find(e=>e.id==='photoelectric-effect');
const digest=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
async function get(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'verify='+Date.now());assert.equal(r.status,200,url);return r}
(async()=>{
 const catalog=await (await get(base+'data/experiments.json')).json();
 const entry=catalog.experiments.find(e=>e.id===local.id);assert.ok(entry);assert.equal(entry.category,'modern-physics');assert.equal(entry.path,local.path);
 const html=await (await get(base+entry.path)).text();
 assert.equal(digest(html),digest(fs.readFileSync(path.join(root,entry.path.split('?')[0]),'utf8')));
 assert.ok(html.includes('id="lambdaMark" data-label="f₀"'));assert.ok(!html.includes('모형초'));
 const home=await (await get(base+'index.html')).text();
 const dataScript=home.match(/src="(assets\/js\/experiments-data\.js[^\"]*)"/)[1];
 const script=await (await get(base+dataScript)).text();assert.ok(script.includes('"id": "'+entry.id+'"')&&script.includes(entry.path));
 const manifest=await (await get(base+'assets/previews/index.json')).json();
 const expected=JSON.parse(fs.readFileSync(path.join(root,'assets/previews/index.json'),'utf8')).items[entry.id];
 assert.deepEqual(manifest.items[entry.id],expected);
 const preview=Buffer.from(await (await get(base+expected.src)).arrayBuffer());assert.equal(preview.length,expected.bytes);
 assert.equal(crypto.createHash('sha256').update(preview).digest('hex').slice(0,10),expected.src.match(/-([a-f0-9]{10})\.webp$/)[1]);
 await get(base+'view.html?id='+entry.id);
 const report={url:base+'view.html?id='+entry.id,category:entry.category,title:entry.title,experiments:catalog.experiments.length,htmlSHA256:digest(html),preview:expected.src,checkedAt:new Date().toISOString()};
 fs.mkdirSync(path.join(root,'.preview-tmp/photoelectric'),{recursive:true});
 fs.writeFileSync(path.join(root,'.preview-tmp/photoelectric/deployment-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
