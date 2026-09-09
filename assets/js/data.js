// ================================================================
// 공통 데이터 레이어
// - 정적 실험 목록(assets/js/experiments-data.js, <script> 태그로 로드) +
//   Firebase(관리자가 새로 올린 실험)를 합쳐서 반환
// - fetch가 아니라 <script> 태그로 데이터를 불러오기 때문에, 파일을 그냥
//   더블클릭해서 열어도(file:// 프로토콜) 브라우저 CORS 제한 없이 정상 작동합니다.
// - Firebase 설정이 안 되어 있으면(placeholder 상태) 정적 목록만 사용 (사이트는 항상 정상 작동)
// ================================================================

const SITE = (function () {
  let firebaseReady = false;
  let db = null;

  function isFirebaseConfigured() {
    const c = window.FIREBASE_CONFIG;
    return c && c.apiKey && !String(c.apiKey).includes("여기에");
  }

  function initFirebase() {
    if (!isFirebaseConfigured()) return false;
    if (firebaseReady) return true;
    try {
      // 뉴턴 러시의 랭킹 등 다른 Firebase 프로젝트와 기본 앱이 충돌하지 않게 한다.
      const app = firebase.apps.find((app) => app.name === "phase-site")
        || firebase.initializeApp(window.FIREBASE_CONFIG, "phase-site");
      db = app.firestore();
      firebaseReady = true;
    } catch (e) {
      console.warn("Firebase 초기화 실패:", e);
      firebaseReady = false;
    }
    return firebaseReady;
  }

  async function loadStaticExperiments() {
    return window.EXPERIMENTS_DATA || { categories: [], experiments: [] };
  }

  async function loadFirestoreExperiments() {
    if (!initFirebase()) return [];
    try {
      const snap = await db.collection("experiments").orderBy("createdAt", "desc").get();
      return snap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          title: v.title,
          category: v.category,
          description: v.description || "",
          path: v.fileUrl, // Firebase Storage 다운로드 URL
          date: v.date || "",
          tags: v.tags || [],
          source: "firebase",
        };
      });
    } catch (e) {
      console.warn("Firestore 실험 목록 불러오기 실패:", e);
      return [];
    }
  }

  // 전체 실험 목록(정적 + Firebase) + 카테고리 목록 + 과학 놀이 목록 반환
  //
  // plays(과학 놀이)는 실험과 성격이 다른 활동물이라 experiments에 섞지 않고
  // 별도 배열로 돌려준다. 사이드바에서도 별도 박스로 나뉜다(lab.js 참고).
  // 관리자 업로드(Firebase) 대상은 실험뿐이므로 plays는 정적 목록만 쓴다.
  async function getAllData() {
    const [staticData, dynamicExps] = await Promise.all([
      loadStaticExperiments(),
      loadFirestoreExperiments(),
    ]);
    const staticExps = (staticData.experiments || []).map((e) => ({ ...e, source: "static" }));
    const all = [...dynamicExps, ...staticExps]; // 최신 업로드가 먼저 오도록
    const plays = (staticData.plays || []).map((p) => ({ ...p, source: "static", section: "play" }));
    return { categories: staticData.categories || [], experiments: all, plays };
  }

  // ---------------- 방문자 카운터 ----------------
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `daily_${y}-${m}-${day}`;
  }

  let visitRecorded = false;
  let visitInFlight = null;

  // 기존과 동일하게 같은 탭의 세션 동안 한 번 집계한다.
  // 페이지 이동·새로고침뿐 아니라 동시에 호출되어도 중복 증가하지 않는다.
  async function recordVisit() {
    if (window.self !== window.top || !/^https?:$/.test(location.protocol)) {
      return { configured: false, skipped: true };
    }
    if (!initFirebase()) return { configured: false };
    try {
      visitRecorded = visitRecorded || sessionStorage.getItem("visit_counted") === "1";
    } catch (_) { /* 저장소를 사용할 수 없어도 현재 문서에서는 중복을 막는다. */ }
    if (visitRecorded) return { configured: true };
    if (visitInFlight) return visitInFlight;

    visitInFlight = (async () => {
      try {
        const dKey = todayKey();
        const inc = firebase.firestore.FieldValue.increment(1);
        const batch = db.batch();
        // 두 집계를 한 번에 기록한다. 한쪽만 성공하고 재시도 때 또 늘어나는 것을 방지.
        batch.set(db.collection("counters").doc("total"), { count: inc }, { merge: true });
        batch.set(db.collection("counters").doc(dKey), { count: inc, date: dKey.replace("daily_", "") }, { merge: true });
        await batch.commit();
        visitRecorded = true;
        try { sessionStorage.setItem("visit_counted", "1"); } catch (_) {}
        return { configured: true };
      } catch (error) {
        console.warn("방문자 카운터 오류:", error);
        return { configured: true, error: true };
      }
    })().finally(() => { visitInFlight = null; });
    return visitInFlight;
  }

  async function recordVisitAndGetCounts() {
    const result = await recordVisit();
    if (!result.configured || result.error) return { today: null, total: null, ...result };
    try {
      const [totalSnap, dailySnap] = await Promise.all([
        db.collection("counters").doc("total").get(),
        db.collection("counters").doc(todayKey()).get(),
      ]);
      return {
        today: dailySnap.exists ? dailySnap.data().count : 0,
        total: totalSnap.exists ? totalSnap.data().count : 0,
        configured: true,
      };
    } catch (error) {
      console.warn("방문자 카운터 조회 오류:", error);
      return { today: null, total: null, configured: true, error: true };
    }
  }

  return {
    isFirebaseConfigured,
    initFirebase,
    getAllData,
    recordVisit,
    recordVisitAndGetCounts,
    get db() {
      initFirebase();
      return db;
    },
  };
})();
