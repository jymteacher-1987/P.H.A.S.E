(function () {
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode:standalone)').matches;
  document.documentElement.classList.toggle('standalone-viewer', standalone);
  document.querySelector('.viewer-app-back').addEventListener('click', event => {
    if (parent !== window) {
      event.preventDefault();
      parent.postMessage({ type: 'phase-exit-activity' }, location.origin);
    }
  });
  // visualViewport follows Safari's address bar and the on-screen keyboard.
  function fit() {
    const height = Math.floor(window.visualViewport?.height || window.innerHeight);
    document.documentElement.style.setProperty('--viewer-height', `${height}px`);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('pageshow', fit);
  window.visualViewport?.addEventListener('resize', fit);
  fit();
  document.getElementById('expFrame').addEventListener('load', function () {
    // Navigation/rotation cannot grant fullscreen permission. Try once, during
    // the player's first real tap, on browsers that support element fullscreen.
    try {
      this.contentDocument?.addEventListener('click', event => {
        if (standalone || !event.isTrusted || !window.PHASE_DEVICE?.isPhoneOrTablet) return;
        const root = document.documentElement;
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        try { if (parent !== window && (parent.document.fullscreenElement || parent.document.webkitFullscreenElement)) return; } catch (_) {}
        if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
        try { Promise.resolve(request.call(root)).then(fit, fit); } catch (_) { fit(); }
      }, { once: true });
    } catch (_) { /* External activities still use the full visible frame. */ }
  });
})();

(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const { categories, experiments, plays } = await SITE.getAllData();
  // 과학 놀이(plays)도 같은 뷰어로 연다. id가 겹칠 일은 없으니 실험을 먼저
  // 찾고 없으면 놀이에서 찾는다(?src=play로 들어오지만 굳이 의존하지 않는다).
  const exp = experiments.find((e) => e.id === id) || (plays || []).find((p) => p.id === id);

  // 상단 바에는 영역 태그만 둔다. 실험 제목은 길면 바가 지저분해지고 폰에서
  // 영역명을 2줄로 밀어내서 조T 요청으로 뺐다(style.css의 .viewer-bar 주석 참고).
  // 대신 브라우저 탭 제목(document.title)에는 그대로 넣어 준다.
  const catEl = document.getElementById("expCat");
  const frame = document.getElementById("expFrame");

  if (!exp) {
    document.title = "실험을 찾을 수 없습니다 — 가상 물리 실험실";
    catEl.textContent = "실험을 찾을 수 없습니다";
    return;
  }

  document.title = `${exp.title} — 물리 실험실`;
  if (exp.section === "play") {
    // 카드 태그와 같은 문구를 쓴다 — 활동 아이콘이 아니라 묶음 아이콘이다.
    catEl.textContent = "🎈 과학 놀이";
    catEl.dataset.cat = "play";
  } else {
    const c = categories.find((c) => c.id === exp.category);
    catEl.textContent = c ? `${c.icon} ${c.name}` : "";
    if (exp.category) catEl.dataset.cat = exp.category;
  }
  frame.src = exp.path;
})();
