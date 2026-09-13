const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const dbDouble = String.raw`
window.__uid="test-player";window.__writes=0;
window.__allRows=Array.from({length:10},(_,i)=>({id:i?'other-'+i:'test-player',nickname:'민준',score:1000-i*10,gems:100,distance:100,cleared:2,updatedAt:i}));
const view=()=>window.__allRows.slice().sort((a,b)=>b.score-a.score||a.updatedAt-b.updatedAt).slice(0,10);
const entry=r=>({id:r?.id,exists:()=>!!r,data:()=>r});
const snap=()=>({docs:view().map(entry),metadata:{fromCache:false}});
export const getFirestore=()=>({}),collection=(...p)=>p,query=(...p)=>p,limit=n=>n;
export const orderBy=(field,dir)=>{(window.__orderFields??=[]).push(field);return[field,dir]};
export const doc=(...p)=>({id:p.at(-1),path:p});
export function onSnapshot(q,a,b){const callback=typeof a==='function'?a:b;window.__emitRank=()=>callback(snap());queueMicrotask(window.__emitRank);return()=>{}}
export const getDocsFromServer=async()=>snap(),serverTimestamp=()=>100+window.__writes;
export const getDocFromServer=async ref=>entry(window.__allRows.find(r=>r.id===ref.id));
export async function runTransaction(db,callback){await callback({
get:getDocFromServer,
set:(ref,data)=>{
if(ref.id!==window.__uid+'_'+data.runToken)throw Error('Record must use a distinct owned run ID');
if(window.__allRows.some(r=>r.id===ref.id))throw Error('Existing records must never be overwritten');
window.__writes++;window.__lastSaved={id:ref.id,...data};window.__allRows.push(window.__lastSaved);
}});window.__emitRank()}
`;
for (const game of ["faraday", "newton"])
  test(
    game +
      ": same player and same name can occupy all ten ranks; retries cannot duplicate one run",
    { timeout: 70000 },
    async () => {
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
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.hostname === "rank.test") {
            if (url.pathname === "/faraday.html")
              return route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/faraday-flight/style.css"><div id="faradayRankHost" style="padding:20px"></div><script src="/assets/faraday-flight/leaderboard.js"></script>',
              });
            const file = path.resolve(
              root,
              decodeURIComponent(url.pathname).replace(/^\/+/, ""),
            );
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
              return route.abort();
            return route.fulfill({
              body: fs.readFileSync(file),
              contentType:
                {
                  ".html": "text/html; charset=utf-8",
                  ".js": "text/javascript",
                  ".css": "text/css",
                  ".webp": "image/webp",
                }[path.extname(file)] || "application/octet-stream",
            });
          }
          let body;
          if (url.pathname.endsWith("firebase-app.js"))
            body =
              "export const getApps=()=>[{name:'faraday-flight'}];export const initializeApp=()=>({});";
          if (url.pathname.endsWith("firebase-auth.js"))
            body =
              "export const getAuth=()=>({get currentUser(){return {uid:window.__uid}},authStateReady:async()=>{}});";
          if (url.pathname.endsWith("firebase-firestore.js")) body = dbDouble;
          return body
            ? route.fulfill({
                contentType: "text/javascript",
                body,
                headers: { "Access-Control-Allow-Origin": "*" },
              })
            : route.abort();
        });
        await page.goto(
          "https://rank.test/" +
            (game === "faraday" ? "faraday.html" : "plays/newton-rush.html"),
        );
        const form = game === "faraday" ? "#faradayRankForm" : "#record-form",
          input = game === "faraday" ? "#faradayNickname" : "#record-name",
          button = game === "faraday" ? "#faradayRankSave" : "#record-save",
          feedback =
            game === "faraday" ? "#faradaySaveStatus" : "#record-status",
          outside =
            game === "faraday" ? "#faradayRankEntry" : "#record-eligibility";
        async function mount(score, token) {
          return page.evaluate(
            async ({ game, score, token }) => {
              if (game === "faraday") {
                const result = {
                  mode: "normal",
                  score,
                  cleared: 2,
                  token: token || crypto.randomUUID(),
                };
                window.__result = result;
                await FaradayRanking.mount(
                  document.querySelector("#faradayRankHost"),
                  "normal",
                  result,
                );
              } else {
                NewtonRanking.begin(0);
                document.querySelector("#result").hidden = false;
                NewtonRanking.finish({
                  score,
                  gems: 0,
                  distance: 100,
                  worlds: 0,
                  startWorld: 0,
                  finished: false,
                  duration: 30,
                });
              }
            },
            { game, score, token },
          );
        }
        await mount(910);
        await page
          .locator(outside)
          .filter({ hasText: /아쉽게도/ })
          .waitFor();
        assert.equal(await page.locator(form).isVisible(), false);
        assert.equal(await page.evaluate(() => window.__writes), 0);
        await mount(5000);
        await page.locator(input).fill("민준");
        await page.evaluate(() =>
          window.__allRows.forEach((r, i) => (r.score = 10000 - i * 10)),
        );
        await page.click(button);
        await page
          .locator(outside)
          .filter({ hasText: /TOP 10 밖|아쉽게도/ })
          .waitFor();
        assert.equal(
          await page.evaluate(() => window.__writes),
          0,
          "Recheck the cutoff immediately before submission",
        );
        await page.evaluate(() =>
          window.__allRows.forEach((r, i) => (r.score = 1000 - i * 10)),
        );
        const scores = [
          20000, 12000, 11900, 11800, 11700, 11600, 11500, 11400, 11300, 11200,
        ];
        for (const score of scores) {
          await mount(score);
          await page.locator(input).waitFor({ state: "visible" });
          assert.equal(
            await page.locator(input).inputValue(),
            "",
            "Each run asks for its player's name",
          );
          await page.fill(input, "민준");
          await page.click(button);
          await page
            .locator(feedback)
            .filter({ hasText: "저장 완료" })
            .waitFor();
          const count = await page.evaluate(() => window.__writes);
          await page.locator(form).dispatchEvent("submit");
          assert.equal(
            await page.evaluate(() => window.__writes),
            count,
            "A second submit of the same run does not duplicate it",
          );
        }
        const state = await page.evaluate(() => ({
          rows: window.__allRows,
          fields: window.__orderFields,
        }));
        assert.equal(
          state.rows.filter((r) => r.id.startsWith("test-player_")).length,
          10,
        );
        assert.deepEqual(
          state.rows
            .filter((r) => r.id.startsWith("test-player_"))
            .map((r) => r.score),
          scores,
        );
        assert.equal(
          state.rows.find((r) => r.id === "test-player").score,
          1000,
          "Legacy records remain intact",
        );
        assert.ok(
          state.rows
            .filter((r) => r.id.startsWith("test-player_"))
            .every((r) => r.nickname === "민준"),
        );
        assert.ok(
          !state.fields.includes("gems") && !state.fields.includes("distance"),
          "Only score and registration time determine ordering",
        );
        if (game === "faraday") {
          const last = await page.evaluate(() => window.__result);
          await mount(last.score, last.token);
          await page
            .locator(outside)
            .filter({ hasText: "이미 등록" })
            .waitFor();
          assert.equal(await page.evaluate(() => window.__writes), 10);
        }
        await mount(11200);
        await page
          .locator(outside)
          .filter({ hasText: /아쉽게도/ })
          .waitFor();
        assert.equal(
          await page.locator(form).isVisible(),
          false,
          "Ten earlier equal-or-better scores fill all places",
        );
        await page.evaluate(() => {
          window.__uid = "another-player";
        });
        await mount(15000);
        await page.fill(input, "민준");
        await page.click(button);
        await page.locator(feedback).filter({ hasText: "저장 완료" }).waitFor();
        assert.equal(
          await page.evaluate(() => window.__lastSaved.nickname),
          "민준",
          "Another person may use the same name",
        );
        assert.equal(await page.evaluate(() => window.__writes), 11);
        assert.deepEqual(errors, []);
      } finally {
        await browser.close();
      }
    },
  );
