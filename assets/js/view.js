(function () {
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode:standalone)').matches;
  document.documentElement.classList.toggle('standalone-viewer', standalone);
  // from에는 목록의 검색 조건만 받는다. 임의의 URL을 복귀 주소로 쓰지 않는다.
  const from = new URLSearchParams(new URLSearchParams(location.search).get('from') || '');
  const returnParams = new URLSearchParams();
  for (const key of ['q', 'cat', 'play', 'scope']) {
    const value = from.get(key);
    if (value) returnParams.set(key, value);
  }
  const query = returnParams.toString();
  const returnHref = 'lab.html' + (query ? '?' + query : '');
  document.querySelectorAll('[data-viewer-return]').forEach(link => {
    link.href = returnHref;
    link.addEventListener('click', event => {
      if (parent !== window && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        parent.postMessage({ type: 'phase-exit-activity' }, location.origin);
      }
    });
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

  const catEl = document.getElementById('expCat');
  const frame = document.getElementById('expFrame');
  const feedback = document.getElementById('viewerFeedback');
  const feedbackTitle = document.getElementById('viewerFeedbackTitle');
  function showFeedback(title, text) {
    document.title = `${title} — 가상 물리 실험실`;
    catEl.textContent = '활동 안내';
    frame.hidden = true;
    feedbackTitle.textContent = title;
    document.getElementById('viewerFeedbackText').textContent = text;
    feedback.hidden = false;
    feedbackTitle.focus({ preventScroll: true });
  }
  let data;
  try {
    // 목록에서 숨긴 활동도 기존 공유 주소로는 계속 열 수 있다.
    data = await SITE.getAllData({ includeUnlisted: true });
  } catch (_) {
    showFeedback('실험 목록을 불러오지 못했어요', '잠시 후 다시 시도하거나 실험실에서 활동을 찾아보세요.');
    return;
  }
  const { categories, experiments, plays } = data;
  // 과학 놀이(plays)도 같은 뷰어로 연다. id가 겹칠 일은 없으니 실험을 먼저
  // 찾고 없으면 놀이에서 찾는다(?src=play로 들어오지만 굳이 의존하지 않는다).
  const exp = experiments.find((e) => e.id === id) || (plays || []).find((p) => p.id === id);

  // 상단 바에는 영역 태그만 둔다. 실험 제목은 길면 바가 지저분해지고 폰에서
  // 영역명을 2줄로 밀어내서 조T 요청으로 뺐다(style.css의 .viewer-bar 주석 참고).
  // 대신 브라우저 탭 제목(document.title)에는 그대로 넣어 준다.
  if (!exp) {
    showFeedback('실험을 찾을 수 없어요', '주소가 달라졌거나 더 이상 제공하지 않는 활동일 수 있어요. 실험실에서 다시 찾아보세요.');
    return;
  }

  document.title = `${exp.title} — 물리 실험실`;
  if (exp.section === "play") {
    // 카드 태그와 같은 영역명을 쓴다.
    catEl.textContent = "과학 놀이";
    catEl.dataset.cat = "play";
  } else {
    const c = categories.find((c) => c.id === exp.category);
    catEl.textContent = c ? c.name : "";
    if (exp.category) catEl.dataset.cat = exp.category;
  }
  frame.title = exp.title;
  frame.src = exp.path;
  if (exp.lessonNote?.question && exp.lessonNote?.focus) {
    const toggle = document.getElementById('viewerNoteToggle');
    const panel = document.getElementById('viewerNotePanel');
    document.getElementById('viewerNoteQuestion').textContent = exp.lessonNote.question;
    document.getElementById('viewerNoteFocus').textContent = exp.lessonNote.focus;
    toggle.hidden = false;
    function setNoteOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) document.getElementById('viewerNoteTitle').focus({ preventScroll: true });
      else toggle.focus({ preventScroll: true });
    }
    toggle.addEventListener('click', () => setNoteOpen(panel.hidden));
    document.getElementById('viewerNoteClose').addEventListener('click', () => setNoteOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) setNoteOpen(false);
    });
  }
})();
