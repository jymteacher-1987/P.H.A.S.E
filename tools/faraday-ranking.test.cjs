const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".preview-tmp/faraday");
test(
  "Faraday ranking: TOP 10 cutoff, current-rank recheck, encouraging feedback and named registration",
  { timeout: 40000 },
  async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    });
    try {
      const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        }),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      // Serve the real ranking UI with local Firebase doubles. No shared data is written.
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "faraday.test") {
          if (url.pathname === "/")
            return route.fulfill({
              contentType: "text/html",
              body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="faradayRankHost" style="padding:20px"></div><script src="/leaderboard.js"></script>',
            });
          const file = path.join(
            root,
            "assets/faraday-flight",
            path.basename(url.pathname),
          );
          return fs.existsSync(file)
            ? route.fulfill({
                contentType: url.pathname.endsWith(".js")
                  ? "text/javascript"
                  : "text/css",
                body: fs.readFileSync(file),
              })
            : route.abort();
        }
        let body;
        if (url.pathname.endsWith("firebase-app.js"))
          body = `export const getApps=()=>[{name:'faraday-flight'}];export const initializeApp=()=>({});`;
        if (url.pathname.endsWith("firebase-auth.js"))
          body = `export const getAuth=()=>({currentUser:{uid:'test-player'},authStateReady:async()=>{}});`;
        if (url.pathname.endsWith("firebase-firestore.js"))
          body = `
        window.__rankRows=Array.from({length:10},(_,i)=>({id:'other-'+i,nickname:'Pilot '+i,score:1000-i*10,cleared:2}));
        const snap=()=>({docs:window.__rankRows.map(row=>({id:row.id,data:()=>row})),metadata:{fromCache:false}});
        export const getFirestore=()=>({}),collection=(...p)=>p,query=(...p)=>p,orderBy=(...p)=>p,limit=n=>n,doc=(...p)=>p;
        export function onSnapshot(q,options,callback){window.__emitRank=()=>callback(snap());queueMicrotask(()=>callback({...snap(),metadata:{fromCache:true}}));const timer=setTimeout(()=>{if(options.includeMetadataChanges)window.__emitRank();},10);return ()=>clearTimeout(timer);}
        export const getDocsFromServer=async()=>snap(),serverTimestamp=()=>1;
        export async function runTransaction(db,callback){await callback({get:async()=>({exists:()=>false}),set:(ref,data)=>{window.__savedRow=data;window.__rankRows=[{id:'test-player',...data},...window.__rankRows].sort((a,b)=>b.score-a.score).slice(0,10);}});window.__emitRank();}
      `;
        return body
          ? route.fulfill({
              contentType: "text/javascript",
              body,
              headers: { "Access-Control-Allow-Origin": "*" },
            })
          : route.abort();
      });
      await page.goto("https://faraday.test/");
      const mount = (score) =>
        page.evaluate(
          (score) =>
            FaradayRanking.mount(
              document.querySelector("#faradayRankHost"),
              "normal",
              { mode: "normal", score, cleared: 2, token: crypto.randomUUID() },
            ),
          score,
        );
      await mount(910); // Tied tenth place belongs to the earlier record.
      await page
        .locator("#faradayRankEntry")
        .filter({ hasText: "아쉽게도" })
        .waitFor();
      assert.equal(await page.locator("#faradayRankForm").isVisible(), false);
      assert.equal(await page.evaluate(() => window.__savedRow), undefined);
      await page.screenshot({
        path: path.join(out, "ranking-outside-top10.png"),
      });
      await mount(5000);
      await page.fill("#faradayNickname", "테스트");
      await page.evaluate(() =>
        window.__rankRows.forEach((r, i) => (r.score = 10000 - i * 10)),
      );
      await page.click("#faradayRankSave");
      await page
        .locator("#faradayRankEntry")
        .filter({ hasText: "아쉽게도" })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.__savedRow),
        undefined,
        "Recheck prevents submitting after the cutoff rises",
      );
      await mount(20000);
      await page.fill("#faradayNickname", "테스트");
      await page.click("#faradayRankSave");
      await page
        .locator("#faradaySaveStatus")
        .filter({ hasText: "저장 완료" })
        .waitFor();
      const saved = await page.evaluate(() => window.__savedRow);
      assert.equal(saved.score, 20000);
      assert.equal(saved.nickname, "테스트");
      assert.equal(saved.cleared, 2);
      assert.equal(await page.locator("#faradayRankList li").count(), 10);
      assert.ok(
        (
          await page.locator("#faradayRankList li").first().innerText()
        ).includes("테스트"),
      );
      await page.screenshot({
        path: path.join(out, "ranking-named-registration.png"),
      });
      await mount(12000);
      await page
        .locator("#faradayRankEntry")
        .filter({ hasText: "더 높은 내 최고 기록" })
        .waitFor();
      assert.equal(await page.locator("#faradayRankForm").isVisible(), false);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);
