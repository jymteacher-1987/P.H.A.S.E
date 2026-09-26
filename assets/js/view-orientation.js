/* Manual orientation is local to this viewer; closing it restores device policy. */
(function () {
  const button = document.getElementById('viewerOrientationToggle');
  const wrap = document.querySelector('.viewer-frame-wrap');
  if (!window.PHASE_DEVICE?.isPhoneOrTablet || !button || !wrap) return;
  const root = document.documentElement, body = document.body;
  let owner = window;
  try { if (top.location.origin === location.origin) owner = top; } catch (_) {}
  let desired = null, revision = 0, restoringViewer = false;
  const label = button.querySelector('span');
  const full = () => owner.document.fullscreenElement || owner.document.webkitFullscreenElement;

  function availableSize() {
    const style = getComputedStyle(body);
    const inset = side => parseFloat(style.getPropertyValue('--viewer-safe-' + side)) || 0;
    return {
      width: Math.max(1, Math.floor(root.clientWidth - inset('left') - inset('right'))),
      height: Math.max(1, Math.floor((window.visualViewport?.height || innerHeight) - inset('top') - inset('bottom')))
    };
  }
  function render() {
    const { width, height } = availableSize();
    const naturalLandscape = width > height;
    const landscape = desired ? desired === 'landscape' : naturalLandscape;
    const rotated = !!desired && landscape !== naturalLandscape;
    body.style.setProperty('--viewer-rotated-width', height + 'px');
    body.style.setProperty('--viewer-rotated-height', width + 'px');
    body.style.setProperty('--viewer-rotated-shift', width + 'px');
    body.classList.toggle('viewer-rotated', rotated);
    body.dataset.viewOrientation = desired || 'auto';
    label.textContent = landscape ? '세로 보기' : '가로 보기';
    button.setAttribute('aria-label', landscape ? '세로 화면으로 보기' : '가로 화면으로 보기');
  }
  function release() {
    revision++;
    desired = null;
    try { owner.screen.orientation?.unlock?.(); } catch (_) {}
    render();
  }
  button.addEventListener('click', async () => {
    const { width, height } = availableSize();
    const landscape = desired ? desired === 'landscape' : width > height;
    desired = landscape ? 'portrait' : 'landscape';
    const requestId = ++revision, target = desired;
    // Immediate local fallback also works when native fullscreen/locking is denied.
    render();
    const standalone = owner.navigator.standalone || owner.matchMedia('(display-mode:standalone)').matches;
    if (!full() && !standalone) {
      const element = owner.document.documentElement;
      const request = element.requestFullscreen || element.webkitRequestFullscreen;
      try { if (request) await request.call(element); } catch (_) {}
    }
    if (requestId !== revision) return;
    try { await owner.screen.orientation?.lock?.(target); } catch (_) {}
    if (requestId === revision) render();
  });
  window.addEventListener('resize', render);
  window.visualViewport?.addEventListener('resize', render);
  function onActivityFullscreenChange() {
    const frame = document.getElementById('expFrame');
    // An activity's separate fullscreen layer would hide the manual return control.
    // Exit only that layer, preserving the already-fullscreen shared viewer.
    if (!desired || restoringViewer || (document.fullscreenElement || document.webkitFullscreenElement) !== frame) return;
    try {
      const child = frame.contentDocument;
      const exit = child?.exitFullscreen || child?.webkitExitFullscreen;
      if (!exit) return;
      restoringViewer = true;
      Promise.resolve(exit.call(child)).catch(() => {}).finally(() => { restoringViewer = false; render(); });
    } catch (_) { restoringViewer = false; }
  }
  function onFullscreenChange() { if (full() || restoringViewer) render(); else release(); }
  function attach() {
    document.addEventListener('fullscreenchange', onActivityFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onActivityFullscreenChange);
    owner.document.addEventListener('fullscreenchange', onFullscreenChange);
    owner.document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    owner.screen.orientation?.addEventListener?.('change', render);
    render();
  }
  function detach() {
    document.removeEventListener('fullscreenchange', onActivityFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', onActivityFullscreenChange);
    owner.document.removeEventListener('fullscreenchange', onFullscreenChange);
    owner.document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    owner.screen.orientation?.removeEventListener?.('change', render);
    release();
  }
  document.querySelectorAll('[data-viewer-return]').forEach(link => link.addEventListener('click', event => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) release();
  }));
  window.addEventListener('pagehide', detach);
  window.addEventListener('pageshow', attach);
  button.hidden = false;
  attach();
})();
