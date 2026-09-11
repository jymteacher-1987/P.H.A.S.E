/* iPhone Safari may deny element fullscreen. Always expand the game layout. */
(function () {
  const app = document.getElementById('app');
  const trigger = document.getElementById('fullscreenButton');
  if (!app || !trigger) return;
  const style = document.createElement('style');
  style.textContent = `
    #app.expanded-screen{padding-top:0;padding-bottom:0}
    #app.expanded-screen header{height:0;min-height:0;border:0;visibility:hidden;overflow:hidden}
    #app.expanded-screen footer{display:none}
    .giants-screen-restore{position:fixed;top:max(3px,env(safe-area-inset-top));right:max(4px,env(safe-area-inset-right));z-index:25;min-width:44px;min-height:30px;border:1px solid #a5c3bf66;border-radius:4px;background:#0b2333df;color:#dce9d8;font:10px sans-serif;padding:5px 8px;touch-action:manipulation}
    .giants-screen-restore[hidden]{display:none}
  `;
  document.head.appendChild(style);
  const restore = document.createElement('button');
  restore.type = 'button'; restore.className = 'giants-screen-restore';
  restore.textContent = '화면 복원'; restore.setAttribute('aria-label', '게임 제목줄과 메뉴 다시 표시');
  restore.hidden = true; document.body.appendChild(restore);
  function layout(expanded) {
    app.classList.toggle('expanded-screen', expanded);
    restore.hidden = !expanded;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  function expand() {
    layout(true);
    const request = app.requestFullscreen || app.webkitRequestFullscreen;
    if (!request || document.fullscreenElement || document.webkitFullscreenElement) return;
    // A rejection still leaves a working expanded layout, with a visible exit.
    try { Promise.resolve(request.call(app)).catch(() => {}); } catch (_) {}
  }
  restore.addEventListener('click', () => {
    layout(false);
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try { Promise.resolve(exit.call(document)).catch(() => {}); } catch (_) {}
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#fullscreenButton, [data-do="fullscreen"]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); expand();
  }, true);
  const handheld = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Use the available screen immediately, even with Safari's address bar open.
  if (handheld) layout(true);
})();
