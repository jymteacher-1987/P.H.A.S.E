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
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
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

  // 전체 실험 목록(정적 + Firebase) + 카테고리 목록 반환
  async function getAllData() {
    const [staticData, dynamicExps] = await Promise.all([
      loadStaticExperiments(),
      loadFirestoreExperiments(),
    ]);
    const staticExps = (staticData.experiments || []).map((e) => ({ ...e, source: "static" }));
    const all = [...dynamicExps, ...staticExps]; // 최신 업로드가 먼저 오도록
    return { categories: staticData.categories || [], experiments: all };
  }

  // ---------------- 방문자 카운터 ----------------
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `daily_${y}-${m}-${day}`;
  }

  async function recordVisitAndGetCounts() {
    if (!initFirebase()) return { today: null, total: null, configured: false };

    const alreadyCounted = sessionStorage.getItem("visit_counted") === "1";
    const dKey = todayKey();
    const totalRef = db.collection("counters").doc("total");
    const dailyRef = db.collection("counters").doc(dKey);

    try {
      if (!alreadyCounted) {
        const inc = firebase.firestore.FieldValue.increment(1);
        await totalRef.set({ count: inc }, { merge: true });
        await dailyRef.set({ count: inc, date: dKey.replace("daily_", "") }, { merge: true });
        sessionStorage.setItem("visit_counted", "1");
      }
      const [totalSnap, dailySnap] = await Promise.all([totalRef.get(), dailyRef.get()]);
      return {
        today: dailySnap.exists ? dailySnap.data().count : 0,
        total: totalSnap.exists ? totalSnap.data().count : 0,
        configured: true,
      };
    } catch (e) {
      console.warn("방문자 카운터 오류:", e);
      return { today: null, total: null, configured: true, error: true };
    }
  }

  return {
    isFirebaseConfigured,
    initFirebase,
    getAllData,
    recordVisitAndGetCounts,
    get db() {
      initFirebase();
      return db;
    },
  };
})();
