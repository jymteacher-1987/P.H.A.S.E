// ================================================================
// 시뮬레이션 오류 신고
// 실험실 왼쪽 메뉴 밑과 실험 보기 화면에서 여는 신고 창이다.
// 보내기를 누르면 아래 주소의 Google Apps Script 웹 앱이 메일을 보낸다.
// 받는 사람은 스크립트 안에 jymteacher@naver.com 으로 고정돼 있어서
// 이 파일에서 무엇을 보내든 다른 주소로는 가지 않는다(tools/error-report 참고).
// 주소가 비어 있거나 보내기에 실패하면, 같은 받는 사람으로 메일 앱을 연다.
// ================================================================
(function () {
  "use strict";

  // Apps Script 웹 앱을 배포한 뒤 받은 .../exec 주소를 넣는다.
  const REPORT_ENDPOINT = "https://script.google.com/macros/s/AKfycbxToXYVKC5Yr5fjJ-G8jV08H4cArtKdZChCJlqzfaGYqxjubL41Wv8KmDmLOxOgiIWB/exec";
  const RECIPIENT = "jymteacher@naver.com";
  const LIMITS = { message: 2000, contact: 120 };

  const activities = () => {
    const data = window.EXPERIMENTS_DATA || {};
    const experiments = (data.experiments || []).map(e => ({ id: e.id, title: e.title }));
    const plays = (data.plays || []).map(p => ({ id: p.id, title: p.title }));
    return { experiments, plays };
  };
  const titleOf = id => {
    const { experiments, plays } = activities();
    return (experiments.find(e => e.id === id) || plays.find(p => p.id === id) || {}).title || "";
  };

  function deviceSummary() {
    const ua = navigator.userAgent || "";
    const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS"
      : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "기타";
    const browser = /SamsungBrowser/.test(ua) ? "삼성 인터넷" : /Whale/.test(ua) ? "웨일" : /Edg\//.test(ua) ? "Edge"
      : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "기타";
    const screenSize = window.screen ? `${screen.width}×${screen.height}` : "";
    return `${os} · ${browser} · 화면 ${screenSize} · 창 ${innerWidth}×${innerHeight}`;
  }

  // 보내는 내용. 받는 사람은 넣지 않는다 — 스크립트가 정한다.
  function buildPayload(form) {
    const id = form.activity.value;
    return {
      activityId: id,
      activityTitle: id ? titleOf(id) : "사이트 전체 · 기타",
      message: form.message.value.trim().slice(0, LIMITS.message),
      contact: form.contact.value.trim().slice(0, LIMITS.contact),
      device: deviceSummary(),
      userAgent: navigator.userAgent || "",
      page: location.href,
      sentAt: new Date().toISOString(),
      website: form.website.value
    };
  }

  function mailtoHref(payload) {
    const subject = `[P.H.A.S.E 오류 신고] ${payload.activityTitle}`;
    const body = [
      `활동: ${payload.activityTitle}${payload.activityId ? ` (${payload.activityId})` : ""}`,
      "",
      payload.message,
      "",
      `기기: ${payload.device}`,
      `페이지: ${payload.page}`
    ].join("\n");
    return `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function send(payload) {
    if (!REPORT_ENDPOINT) throw new Error("NO_ENDPOINT");
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      // text/plain 으로 보내야 브라우저가 사전 확인(preflight) 없이 바로 보낸다.
      const response = await fetch(REPORT_ENDPOINT, {
        method: "POST", body: JSON.stringify(payload), signal: controller ? controller.signal : undefined
      });
      const reply = await response.json();
      if (!reply || reply.ok !== true) throw new Error(reply && reply.error || "BAD_REPLY");
    } finally { if (timer) clearTimeout(timer); }
  }

  let dialog, lastFocus;
  function optionList(selected) {
    const { experiments, plays } = activities();
    const option = a => `<option value="${a.id}"${a.id === selected ? " selected" : ""}>${escapeHTML(a.title)}</option>`;
    return `<option value="">사이트 전체 · 기타</option>`
      + (experiments.length ? `<optgroup label="물리 가상실험">${experiments.map(option).join("")}</optgroup>` : "")
      + (plays.length ? `<optgroup label="과학 놀이">${plays.map(option).join("")}</optgroup>` : "");
  }
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function build() {
    dialog = document.createElement("div");
    dialog.className = "report-overlay";
    dialog.hidden = true;
    dialog.innerHTML = `
      <section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
        <div class="report-head">
          <h2 id="reportTitle" tabindex="-1">시뮬레이션 오류 신고</h2>
          <button type="button" class="report-close" aria-label="신고 창 닫기">×</button>
        </div>
        <form class="report-form" novalidate>
          <label for="reportActivity">어떤 활동인가요?</label>
          <select id="reportActivity" name="activity"></select>
          <label for="reportMessage">어떤 문제가 있었나요?</label>
          <textarea id="reportMessage" name="message" rows="5" maxlength="${LIMITS.message}" required
            placeholder="예: 광원을 옮기면 상이 사라져요. 어떤 조작을 했는지 적어 주면 고치기 쉬워요."></textarea>
          <label for="reportContact">답장 받을 이메일 <small>(선택)</small></label>
          <input id="reportContact" name="contact" type="email" maxlength="${LIMITS.contact}" autocomplete="email" placeholder="답장이 필요할 때만 적어 주세요">
          <div class="report-trap" aria-hidden="true"><label>웹사이트<input name="website" tabindex="-1" autocomplete="off"></label></div>
          <p class="report-note">받는 사람: ${RECIPIENT} · 적은 글, 활동 이름, 기기·브라우저 정보가 함께 전달돼요.</p>
          <p class="report-status" role="status" aria-live="polite"></p>
          <div class="report-actions">
            <a class="report-mail" hidden>메일 앱으로 보내기</a>
            <button type="submit" class="report-send">보내기</button>
          </div>
        </form>
      </section>`;
    document.body.append(dialog);
    const form = dialog.querySelector("form"), status = dialog.querySelector(".report-status"),
      sendButton = dialog.querySelector(".report-send"), mailLink = dialog.querySelector(".report-mail");
    dialog.querySelector(".report-close").addEventListener("click", close);
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const items = Array.from(dialog.querySelectorAll("button,select,textarea,input:not([tabindex='-1']),a[href]"))
          .filter(el => !el.hidden && el.offsetParent !== null);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const payload = buildPayload(form);
      if (payload.message.length < 5) {
        status.textContent = "어떤 문제가 있었는지 조금 더 적어 주세요.";
        form.message.focus();
        return;
      }
      mailLink.href = mailtoHref(payload);
      sendButton.disabled = true;
      status.textContent = "보내는 중이에요…";
      try {
        await send(payload);
        status.textContent = "고맙습니다. 신고가 전달됐어요.";
        form.message.value = "";
        mailLink.hidden = true;
        sendButton.textContent = "한 건 더 보내기";
      } catch (error) {
        status.textContent = error.message === "NO_ENDPOINT"
          ? "바로 보내기가 아직 준비되지 않았어요. 아래 버튼을 누르면 내용이 채워진 메일 앱이 열려요."
          : error.message === "LIMIT"
            ? "지금은 신고가 많아 잠시 뒤에 보낼 수 있어요. 아래 버튼으로 메일 앱에서 보낼 수도 있어요."
            : "지금은 바로 보내지 못했어요. 아래 버튼을 누르면 내용이 채워진 메일 앱이 열려요.";
        mailLink.hidden = false;
      } finally { sendButton.disabled = false; }
    });
  }

  function open(options = {}) {
    if (!dialog) build();
    lastFocus = document.activeElement;
    const form = dialog.querySelector("form");
    form.activity.innerHTML = optionList(options.activityId || "");
    dialog.querySelector(".report-status").textContent = "";
    dialog.querySelector(".report-mail").hidden = true;
    dialog.querySelector(".report-send").textContent = "보내기";
    dialog.hidden = false;
    document.documentElement.classList.add("report-open");
    (options.activityId ? form.message : form.activity).focus();
  }
  function close() {
    dialog.hidden = true;
    document.documentElement.classList.remove("report-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // 실험실 왼쪽 메뉴 밑에 들어가는 칸. lab.js 가 메뉴를 그린 뒤 붙인다.
  function sideBox() {
    const box = document.createElement("div");
    box.className = "side-box side-report";
    box.innerHTML = `<div class="side-report-title">시뮬레이션 오류 신고</div>
      <p>실험이 이상하게 움직이거나 설명이 틀려 보이면 알려 주세요.</p>
      <button type="button" class="side-report-btn">오류 신고하기</button>`;
    box.querySelector("button").addEventListener("click", () => open());
    return box;
  }

  function mountPage() {
    // 좁은 화면에서는 메뉴가 목록 위로 올라가므로, 신고 칸은 목록 아래에 따로 둔다.
    const shell = document.querySelector(".page-lab .lab-shell");
    if (shell && !document.querySelector(".report-inline")) {
      const inline = document.createElement("div");
      inline.className = "report-inline";
      inline.innerHTML = `<span>실험이 이상하게 움직이거나 설명이 틀려 보이나요?</span><button type="button">오류 신고하기</button>`;
      inline.querySelector("button").addEventListener("click", () => open());
      shell.after(inline);
    }
    // 실험 보기 화면: 보고 있는 활동을 미리 골라 둔다.
    const viewButton = document.querySelector("[data-report-open]");
    if (viewButton) {
      const tools = viewButton.closest(".viewer-tools"), toggle = document.getElementById("viewerNoteToggle");
      const mark = () => { if (tools) tools.dataset.report = toggle && !toggle.hidden ? "with-note" : "alone"; };
      mark();
      if (toggle && typeof MutationObserver === "function") new MutationObserver(mark).observe(toggle, { attributes: true, attributeFilter: ["hidden"] });
      viewButton.addEventListener("click", () => open({ activityId: new URLSearchParams(location.search).get("id") || "" }));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPage);
  else mountPage();

  window.PhaseReport = { open, sideBox, buildPayload, mailtoHref, RECIPIENT };
})();
