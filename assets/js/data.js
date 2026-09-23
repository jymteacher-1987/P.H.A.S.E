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
  const CATALOG_READ_TIMEOUT = 2000;
  const METADATA_LIMITS = Object.freeze({ title: 100, description: 600, tags: 8, tag: 24 });

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

  // Firestore 오프라인 재시도가 계속되어도 정적 목록은 2초 뒤 표시한다.
  // 늦게 끝난 읽기의 실패도 처리해 unhandled rejection이 생기지 않게 한다.
  function readCatalog(makeRequest, fallback) {
    if (!initFirebase()) return Promise.resolve({ value: fallback, status: "unconfigured" });
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value, status) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ value, status });
      };
      const timer = setTimeout(() => finish(fallback, "timeout"), CATALOG_READ_TIMEOUT);
      Promise.resolve().then(makeRequest).then(
        (value) => finish(value, "ready"),
        () => finish(fallback, "unavailable")
      );
    });
  }

  function loadFirestoreExperiments() {
    return readCatalog(async () => {
      const snap = await db.collection("experiments").orderBy("createdAt", "desc").get({ source: "server" });
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
    }, []);
  }

  // 표시 정보만 저장한다. 경로·분류·출처 변경 및 불완전한 레코드는 무시한다.
  function validateCatalogMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "저장할 내용을 확인해주세요." };
    const allowed = ["title", "description", "tags", "listed", "updatedAt"];
    if (Object.keys(value).some((key) => !allowed.includes(key))) return { error: "제목·설명·태그·목록 표시만 수정할 수 있습니다." };
    if (typeof value.title !== "string" || !value.title.trim() || value.title.length > METADATA_LIMITS.title) {
      return { error: `제목은 1~${METADATA_LIMITS.title}자로 입력해주세요.` };
    }
    if (typeof value.description !== "string" || value.description.length > METADATA_LIMITS.description) {
      return { error: `설명은 ${METADATA_LIMITS.description}자 이내로 입력해주세요.` };
    }
    if (!Array.isArray(value.tags) || value.tags.length > METADATA_LIMITS.tags ||
        value.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > METADATA_LIMITS.tag)) {
      return { error: `태그는 최대 ${METADATA_LIMITS.tags}개, 각 ${METADATA_LIMITS.tag}자 이내로 입력해주세요.` };
    }
    if (typeof value.listed !== "boolean") return { error: "목록 표시 여부를 확인해주세요." };
    return { value: {
      title: value.title.trim(), description: value.description.trim(),
      tags: [...new Set(value.tags.map((tag) => tag.trim()))], listed: value.listed,
    } };
  }

  function loadCatalogOverrides() {
    return readCatalog(async () => {
      const snap = await db.collection("catalogOverrides").get({ source: "server" });
      const overrides = Object.create(null);
      let invalidCount = 0;
      snap.docs.forEach((doc) => {
        const raw = doc.data();
        const result = validateCatalogMetadata(raw);
        if (result.error) { invalidCount++; return; }
        overrides[doc.id] = { ...result.value, updatedAt: raw.updatedAt || null };
      });
      return { overrides, invalidCount };
    }, { overrides: Object.create(null), invalidCount: 0 });
  }

  function applyCatalogOverride(item, overrides) {
    const override = overrides[item.id];
    if (!override) return { ...item, listed: true };
    // 명시한 네 항목만 적용한다. 원래 이미지·ID·경로 등은 반드시 보존한다.
    return { ...item, title: override.title, description: override.description,
      tags: [...override.tags], listed: override.listed };
  }

  async function getCatalogEditorData() {
    const [staticData, dynamicResult, overrideResult] = await Promise.all([
      loadStaticExperiments(), loadFirestoreExperiments(), loadCatalogOverrides(),
    ]);
    return {
      categories: staticData.categories || [],
      experiments: [...dynamicResult.value, ...(staticData.experiments || []).map((item) => ({ ...item, source: "static" }))],
      plays: (staticData.plays || []).map((item) => ({ ...item, source: "static", section: "play" })),
      overrides: overrideResult.value.overrides,
      invalidOverrideCount: overrideResult.value.invalidCount,
      catalogStatus: { experiments: dynamicResult.status, overrides: overrideResult.status },
    };
  }

  // 전체 실험 목록(정적 + Firebase) + 카테고리 목록 + 과학 놀이 목록 반환
  //
  // plays(과학 놀이)는 실험과 성격이 다른 활동물이라 experiments에 섞지 않고
  // 별도 배열로 돌려준다. 사이드바에서도 별도 박스로 나뉜다(lab.js 참고).
  // 실험·놀이 모두 원본을 보존하면서 Firebase의 표시 정보를 적용한다.
  // listed=false는 목록에서만 숨긴다. 직접 링크를 막는 보안 기능은 아니다.
  async function getAllData({ includeUnlisted = false } = {}) {
    const data = await getCatalogEditorData();
    const merge = (items) => items.map((item) => applyCatalogOverride(item, data.overrides))
      .filter((item) => includeUnlisted || item.listed);
    return { categories: data.categories, experiments: merge(data.experiments), plays: merge(data.plays), catalogStatus: data.catalogStatus };
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
    getCatalogEditorData,
    validateCatalogMetadata,
    recordVisit,
    recordVisitAndGetCounts,
    get db() {
      initFirebase();
      return db;
    },
  };
})();
