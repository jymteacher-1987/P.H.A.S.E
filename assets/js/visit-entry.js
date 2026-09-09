// 메인·실험실·뷰어·게임 직접 링크가 같은 방문 기록을 공유한다.
// iframe은 부모 페이지가 집계하므로 미리보기와 게임 내부에서 추가 집계하지 않는다.
// 새 독립 실험·게임에도 이 파일을 defer script로 연결한다. 문서를 교체하는 번들은 최종 템플릿에 넣는다.
(function () {
  if (window.self !== window.top || !/^https?:$/.test(location.protocol)) return;
  try {
    if (sessionStorage.getItem("visit_counted") === "1") return;
  } catch (_) { /* 저장소가 막혀도 현재 페이지의 방문은 기록한다. */ }

  const base = new URL(".", document.currentScript.src);
  let pending = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("방문 집계 스크립트 로드 실패"));
      document.head.appendChild(script);
    });
  }

  function record() {
    if (pending) return pending;
    pending = (async () => {
      // 독립 게임은 필요한 파일만 비동기로 로드해 게임 시작을 막지 않는다.
      if (typeof SITE === "undefined") {
        if (!window.firebase?.initializeApp) await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
        if (!window.firebase?.firestore) await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
        await loadScript(new URL("firebase-config.js", base).href);
        await loadScript(new URL("data.js?v=visits-20260909", base).href);
      }
      await SITE.recordVisit();
    })().catch((error) => console.warn("방문 집계 연결 실패:", error))
      .finally(() => { pending = null; });
    return pending;
  }

  record();
  window.addEventListener("online", record);
})();
