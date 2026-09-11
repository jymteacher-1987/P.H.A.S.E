/* Keep the activity launch and fullscreen request in the same real tap.
   A document navigation would discard the activation needed by mobile browsers. */
(function () {
  const phone = window.matchMedia('(any-pointer:coarse), (max-width:700px), (max-height:500px) and (max-width:950px)');
  let layer = null, savedTitle = '', savedFocus = null;
  function fit() {
    if (layer) layer.style.height = Math.floor(window.visualViewport?.height || innerHeight) + 'px';
  }
  function show(href, title) {
    if (layer) return;
    savedTitle = document.title;
    savedFocus = document.activeElement;
    layer = document.createElement('div');
    layer.className = 'mobile-activity-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', title || '실험 화면');
    const frame = document.createElement('iframe');
    frame.className = 'mobile-activity-frame';
    frame.title = title || '실험 화면';
    frame.allow = 'camera; fullscreen';
    frame.allowFullscreen = true;
    frame.src = href;
    layer.appendChild(frame);
    document.body.appendChild(layer);
    document.documentElement.classList.add('mobile-activity-open');
    if (title) document.title = title + ' — 물리 실험실';
    fit();
    frame.focus();
  }
  function hide() {
    if (!layer) return;
    layer.remove(); layer = null;
    document.documentElement.classList.remove('mobile-activity-open');
    document.title = savedTitle;
    savedFocus?.focus({ preventScroll: true });
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try { Promise.resolve((document.exitFullscreen || document.webkitExitFullscreen).call(document)).catch(() => {}); } catch (_) {}
    }
  }
  document.addEventListener('click', event => {
    if (!phone.matches || layer || !event.isTrusted || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.pathname.endsWith('/view.html') || !url.searchParams.has('id')) return;
    event.preventDefault();
    const title = link.querySelector('h3')?.textContent || '과학 실험·놀이';
    history.pushState({ phaseActivity: url.href, phaseTitle: title }, '', url.href);
    show(url.href, title);
    // No awaited work before this call: the card tap is still the activation.
    const root = document.documentElement, request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (request && !navigator.standalone && !matchMedia('(display-mode:standalone)').matches) {
      try { Promise.resolve(request.call(root)).then(fit, fit); } catch (_) { fit(); }
    }
  });
  window.addEventListener('popstate', event => {
    if (event.state?.phaseActivity) show(event.state.phaseActivity, event.state.phaseTitle);
    else hide();
  });
  window.addEventListener('message', event => {
    if (layer && event.origin === location.origin && event.source === layer.querySelector('iframe').contentWindow && event.data?.type === 'phase-exit-activity') history.back();
  });
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
})();
