(function () {
  "use strict";
  // The Firebase project is shared infrastructure only. No Newton score path is used here.
  const config = {
    apiKey: "AIzaSyBttHlFgpnpBpWhDy0eXmXglDdeXNDohaU",
    authDomain: "newton-rush.firebaseapp.com",
    projectId: "newton-rush",
    messagingSenderId: "227220123718",
    appId: "1:227220123718:web:1b462168add16f6ea75a47",
  };
  const ROOT = "faradayScores",
    VERSION = 2,
    OUTSIDE_TOP_TEN =
      "아쉽게도 이번에는 랭킹에 들지 못했어요. 다음 비행에서 더 높은 점수에 도전해 주세요!";
  let ready,
    unsubscribe,
    serial = 0;
  const qa = new URLSearchParams(location.search).has("qa");
  function message(error) {
    return (
      {
        "permission-denied":
          "순위 저장 권한을 확인하지 못했어요. 다시 시도해 주세요.",
        "failed-precondition":
          "순위표를 준비하고 있어요. 잠시 뒤 다시 눌러 주세요.",
        "auth/operation-not-allowed": "기록 연결 설정을 확인해야 해요.",
        "resource-exhausted":
          "오늘의 사용량을 초과했어요. 나중에 다시 확인해 주세요.",
        unavailable: "연결이 끊겼어요. 다시 시도해 주세요.",
      }[error?.code] ||
      error?.message ||
      "순위를 불러오지 못했어요."
    );
  }
  async function deadline(promise) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise(
          (_, reject) =>
            (timer = setTimeout(
              () =>
                reject(Error("연결이 지연되고 있어요. 다시 시도해 주세요.")),
              12000,
            )),
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function connect() {
    if (!ready)
      ready = (async () => {
        const [appSDK, authSDK, dbSDK] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"),
        ]);
        const app =
          appSDK.getApps().find((a) => a.name === "faraday-flight") ||
          appSDK.initializeApp(config, "faraday-flight");
        return {
          ...authSDK,
          ...dbSDK,
          auth: authSDK.getAuth(app),
          db: dbSDK.getFirestore(app),
        };
      })().catch((e) => {
        ready = null;
        throw e;
      });
    return ready;
  }
  function scoreCollection(fb, mode) {
    return fb.collection(
      fb.db,
      ROOT,
      mode === "easy" ? "easy" : "normal",
      "players",
    );
  }
  function topQuery(fb, mode) {
    return fb.query(
      scoreCollection(fb, mode),
      fb.orderBy("score", "desc"),
      fb.orderBy("updatedAt", "asc"),
      fb.limit(10),
    );
  }
  function stop() {
    serial++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }
  function markup(mode, result) {
    return (
      '<div class="rank-shell"><div class="rank-heading"><strong>패러데이 TOP 10</strong><button class="text-btn" id="faradayRankRefresh" aria-label="순위 새로고침">↻</button></div><div class="rank-modes"><button data-rank-mode="normal" class="' +
      (mode === "normal" ? "selected" : "") +
      '">일반</button><button data-rank-mode="easy" class="' +
      (mode === "easy" ? "selected" : "") +
      '">여유롭게</button></div>' +
      (result
        ? '<p id="faradayRankEntry" class="rank-entry-result" role="status">TOP 10 등록 가능 여부를 확인하고 있어요…</p><form id="faradayRankForm" hidden><label for="faradayNickname">이번 기록 ' +
          Math.floor(result.score).toLocaleString("ko-KR") +
          '점 · 별명으로 등록</label><div><input id="faradayNickname" maxlength="12" autocomplete="nickname" placeholder="별명 1~12글자" aria-label="순위표 별명" required><button class="secondary" id="faradayRankSave">등록</button></div><p id="faradaySaveStatus" role="status"></p></form>'
        : "") +
      '<ol id="faradayRankList"></ol><p id="faradayRankStatus" role="status">공유 순위를 불러오는 중…</p><p class="rank-note">난이도별 상위 10개 기록 · 점수순, 동점이면 먼저 등록한 기록순. 같은 이름도 매 판 새 기록으로 등록할 수 있어요. 뉴턴 러시 순위와 별개예요.</p></div>'
    );
  }
  function render(host, rows) {
    const list = host.querySelector("#faradayRankList");
    if (!list) return;
    list.replaceChildren();
    for (let i = 0; i < 10; i++) {
      const row = document.createElement("li"),
        place = document.createElement("span"),
        name = document.createElement("b"),
        value = document.createElement("strong"),
        detail = document.createElement("small");
      place.textContent = String(i + 1).padStart(2, "0");
      name.textContent = rows[i]?.nickname || "첫 비행을 기다려요";
      value.textContent = rows[i]
        ? Number(rows[i].score).toLocaleString("ko-KR") + "점"
        : "—";
      detail.textContent = rows[i] ? rows[i].cleared + " / 5 통과" : "";
      name.append(detail);
      row.append(place, name, value);
      list.append(row);
    }
  }
  async function mount(host, mode = "normal", result = null) {
    stop();
    const generation = serial;
    host.innerHTML = markup(mode, result?.mode === mode ? result : null);
    render(host, []);
    const alive = () => generation === serial && host.isConnected;
    const status = (value) => {
      if (alive()) host.querySelector("#faradayRankStatus").textContent = value;
    };
    host.querySelector("#faradayRankRefresh").onclick = () =>
      mount(host, mode, result);
    for (const b of host.querySelectorAll("[data-rank-mode]"))
      b.onclick = () => mount(host, b.dataset.rankMode, result);
    const form = host.querySelector("#faradayRankForm"),
      entryMessage = host.querySelector("#faradayRankEntry");
    let saving = false,
      submitted = false;
    const showEntryMessage = (text) => {
      if (!form || !alive()) return;
      form.hidden = !!text;
      entryMessage.hidden = !text;
      entryMessage.textContent = text
        ? "이번 기록 " +
          Math.floor(result.score).toLocaleString("ko-KR") +
          "점\n" +
          text
        : "";
    };
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (saving || submitted) return;
        const input = host.querySelector("#faradayNickname"),
          button = host.querySelector("#faradayRankSave"),
          feedback = host.querySelector("#faradaySaveStatus"),
          nickname = input.value.normalize("NFKC").trim();
        if (!/^[\p{L}\p{N} _.-]{1,12}$/u.test(nickname)) {
          feedback.textContent =
            "별명은 한글·영문·숫자 1~12글자로 적어 주세요.";
          return;
        }
        if (qa) {
          feedback.textContent = "검사용 플레이는 공유 순위에 등록하지 않아요.";
          return;
        }
        button.disabled = true;
        saving = true;
        feedback.textContent = "기록을 확인하고 있어요…";
        try {
          await deadline(
            (async () => {
              const fb = await connect();
              await fb.auth.authStateReady();
              const user =
                fb.auth.currentUser ||
                (await fb.signInAnonymously(fb.auth)).user;
              const ref = fb.doc(
                  scoreCollection(fb, mode),
                  user.uid + "_" + result.token,
                ),
                existing = await fb.getDocFromServer(ref);
              if (existing.exists()) return;
              const board = await fb.getDocsFromServer(topQuery(fb, mode));
              const ahead = board.docs.filter(
                (d) => d.data().score >= Math.floor(result.score),
              ).length;
              if (ahead >= 10) throw Error(OUTSIDE_TOP_TEN);
              await fb.runTransaction(fb.db, async (tx) => {
                const previous = await tx.get(ref);
                if (previous.exists()) return;
                tx.set(ref, {
                  nickname,
                  score: Math.floor(result.score),
                  cleared: result.cleared,
                  runToken: result.token,
                  version: VERSION,
                  updatedAt: fb.serverTimestamp(),
                });
              });
            })(),
          );
          if (alive()) {
            submitted = true;
            showEntryMessage("");
            feedback.textContent =
              nickname +
              " · " +
              Math.floor(result.score).toLocaleString("ko-KR") +
              "점 저장 완료";
            input.disabled = true;
          }
        } catch (error) {
          if (alive()) {
            feedback.textContent = message(error);
            button.disabled = false;
            if (error.message === OUTSIDE_TOP_TEN)
              showEntryMessage(OUTSIDE_TOP_TEN);
          }
        } finally {
          saving = false;
        }
      };
    }
    if (qa) {
      if (form) showEntryMessage("");
      status("검사 화면 · 공유 기록을 변경하지 않아요.");
      return;
    }
    try {
      const fb = await deadline(connect());
      await deadline(fb.auth.authStateReady());
      if (!alive()) return;
      unsubscribe = fb.onSnapshot(
        topQuery(fb, mode),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (alive()) {
            render(
              host,
              snapshot.docs.map((d) => d.data()),
            );
            if (form && !saving && !submitted && !snapshot.metadata.fromCache) {
              const saved = snapshot.docs.some(
                  (d) => d.id === fb.auth.currentUser?.uid + "_" + result.token,
                ),
                ahead = snapshot.docs.filter(
                  (d) => d.data().score >= Math.floor(result.score),
                ).length;
              showEntryMessage(
                saved
                  ? "이번 비행 기록은 이미 등록됐어요. 다음 비행에서도 새 이름과 점수를 등록할 수 있어요."
                  : ahead >= 10
                    ? OUTSIDE_TOP_TEN
                    : "",
              );
            }
            status(
              snapshot.metadata.fromCache
                ? "공유 기록 연결 중…"
                : "새 기록이 나오면 자동 갱신돼요.",
            );
          }
        },
        (error) => status(message(error)),
      );
    } catch (error) {
      status(message(error));
    }
  }
  window.FaradayRanking = { mount, stop };
})();
