// Explicit integration check: isolated anonymous account, temporary Faraday rows only.
// Finally removes only rows created by this invocation. Never writes Newton records.
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  try {
    const page = await browser.newPage();
    await page.goto(
      (process.argv[2] || "http://127.0.0.1:4173") +
        "/plays/faraday-flight.html",
    );
    const result = await page.evaluate(async () => {
      const [A, U, D] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
      ]);
      const app = A.initializeApp(
          {
            apiKey: "AIzaSyBttHlFgpnpBpWhDy0eXmXglDdeXNDohaU",
            authDomain: "newton-rush.firebaseapp.com",
            projectId: "newton-rush",
            appId: "1:227220123718:web:1b462168add16f6ea75a47",
          },
          "faraday-integration-check",
        ),
        db = D.getFirestore(app),
        auth = U.getAuth(app);
      const user = (await U.signInAnonymously(auth)).user,
        created = [];
      const top = (mode) =>
        D.query(
          D.collection(db, "faradayScores", mode, "players"),
          D.orderBy("score", "desc"),
          D.orderBy("updatedAt", "asc"),
          D.limit(10),
        );
      const newton = D.query(
        D.collection(db, "newtonScores"),
        D.orderBy("score", "desc"),
        D.orderBy("gems", "desc"),
        D.orderBy("distance", "desc"),
        D.orderBy("updatedAt", "asc"),
        D.limit(10),
      );
      const canonical = (x) =>
        x === null || typeof x !== "object"
          ? x
          : Array.isArray(x)
            ? x.map(canonical)
            : Object.fromEntries(
                Object.keys(x)
                  .sort()
                  .map((k) => [k, canonical(x[k])]),
              );
      const digest = async (snap) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(
                JSON.stringify(
                  canonical(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
                ),
              ),
            ),
          ),
        )
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      const before = await digest(await D.getDocsFromServer(newton));
      try {
        const boards = {};
        for (const mode of ["normal", "easy"]) {
          const ref = D.doc(db, "faradayScores", mode, "players", user.uid);
          if ((await D.getDocFromServer(ref)).exists())
            throw Error("Fresh test identity must not have existing data");
          const payload = {
            nickname: "연결확인",
            score: 0,
            cleared: 0,
            runToken: crypto.randomUUID(),
            version: 2,
            updatedAt: D.serverTimestamp(),
          };
          await D.setDoc(ref, payload);
          created.push(ref);
          const row = await D.getDocFromServer(ref);
          if (row.data().score !== 0) throw Error("Stored score mismatch");
          const rows = await D.getDocsFromServer(top(mode));
          boards[mode] = {
            count: rows.size,
            ownPresent: rows.docs.some((d) => d.id === user.uid),
          };
          let rejected = false;
          try {
            await D.updateDoc(ref, {
              score: -1,
              updatedAt: D.serverTimestamp(),
            });
          } catch (e) {
            rejected = e.code === "permission-denied";
          }
          if (!rejected) throw Error("Invalid score must be rejected");
        }
        const after = await digest(await D.getDocsFromServer(newton));
        return {
          boards,
          newtonUnchanged: before === after,
          invalidScoresRejected: true,
        };
      } finally {
        for (const ref of created) await D.deleteDoc(ref);
        await U.deleteUser(user);
        await A.deleteApp(app);
      }
    });
    assert.equal(result.newtonUnchanged, true);
    assert.equal(result.invalidScoresRejected, true);
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(
      path.resolve(__dirname, "../.preview-tmp/faraday/firebase-check.json"),
      JSON.stringify(result, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
