// ================================================================
// 실험실 페이지 로직: 좌측 영역 메뉴, 검색, 실험 카드(+대표 장면 이미지) 렌더링
//
// 좌측 메뉴는 박스 두 개로 나뉜다.
//   [물리 가상실험] 교육과정 영역별 필터 (전체 / 과학의 기초 / 역학과 에너지 / …)
//   [과학 놀이]     실험이 아닌 활동물 하나하나 (히어로 만들기 / …)
// 두 축을 한 목록에 섞으면 "과학 놀이"가 열·전자기학과 같은 급으로 보여서
// 박스를 따로 뒀다. 선택 상태(active)는 두 박스를 통틀어 항상 하나뿐이다
// — state.section이 어느 박스인지, state.activeCategory가 그 안의 어느
// 줄인지를 가리킨다. PC의 두 목록은 접거나 내부 스크롤로 고를 수 있고,
// 휴대폰에서는 기존의 가로 스크롤 띠를 유지한다.
// ================================================================
(async function () {
  const state = {
    categories: [],
    experiments: [],
    plays: [],
    section: "lab", // "lab" = 물리 가상실험 / "play" = 과학 놀이
    activeCategory: "all", // section이 "play"면 선택된 놀이의 id
    query: "",
    scope: "all", // 검색은 전체 실험·놀이에서 시작하고, 원하면 선택 영역으로 좁힌다.
  };

  const els = {
    sideMenu: document.getElementById("sideMenu"),
    expGrid: document.getElementById("expGrid"),
    expCount: document.getElementById("expCount"),
    expSectionTitle: document.getElementById("expSectionTitle"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
    searchForm: document.getElementById("searchForm"),
    clearSearch: document.getElementById("clearSearch"),
    searchTools: document.getElementById("searchTools"),
    searchSummary: document.getElementById("searchSummary"),
    selectionScope: document.getElementById("selectionScope"),
    dailyFeature: document.getElementById("dailyFeature"),
    dailyFeatureLink: document.getElementById("dailyFeatureLink"),
    dailyFeatureImage: document.getElementById("dailyFeatureImage"),
    dailyFeatureTitle: document.getElementById("dailyFeatureTitle"),
    dailyFeatureCategory: document.getElementById("dailyFeatureCategory"),
    dailyFeatureDescription: document.getElementById("dailyFeatureDescription"),
  };

  // 메인 페이지에서 검색어/카테고리를 들고 넘어온 경우 반영.
  // ?play=<id> 로 들어오면 해당 놀이가 선택된다.
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";
  const initialPlay = params.get("play") || "";
  const initialCat = params.get("cat") || "all";

  const { categories, experiments, plays } = await SITE.getAllData();
  state.categories = categories;
  state.experiments = experiments;
  state.plays = plays || [];
  state.query = initialQuery;
  state.scope = params.get("scope") === "selection" || (!params.has("scope") && (params.has("cat") || params.has("play"))) ? "selection" : "all";
  if (initialPlay && (initialPlay === "all" || state.plays.some((p) => p.id === initialPlay))) {
    state.section = "play";
    state.activeCategory = initialPlay;
  } else {
    state.section = "lab";
    state.activeCategory = state.categories.some(c => c.id === initialCat) ? initialCat : "all";
  }
  if (initialQuery) els.searchInput.value = initialQuery;
  const desktopMenu = window.matchMedia("(min-width: 861px)");
  const openMenus = new Set();

  const LAB_SECTION = { id: "lab", name: "물리 가상실험" };
  const PLAY_SECTION = { id: "play", name: "과학 놀이" };
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const recommendation = SITE.getDailyRecommendation(state.experiments);
  if (recommendation) {
    const item = recommendation.item;
    const scene = item.source === "static" ? window.PHASE_PREVIEWS?.items?.[item.id] : null;
    els.dailyFeatureLink.href = `view.html?id=${encodeURIComponent(item.id)}&src=${encodeURIComponent(item.source)}`;
    els.dailyFeatureTitle.textContent = item.title;
    els.dailyFeatureCategory.textContent = state.categories.find((category) => category.id === item.category)?.name || "물리 가상실험";
    els.dailyFeatureCategory.dataset.cat = item.category;
    els.dailyFeatureDescription.textContent = item.description || "직접 조작하며 물리 개념을 살펴보세요.";
    const fallback = () => {
      els.dailyFeatureImage.classList.add("is-fallback");
      els.dailyFeatureImage.replaceChildren();
      els.dailyFeatureImage.textContent = "P.H.A.S.E · VIRTUAL LAB";
    };
    if (scene?.src) {
      const image = document.createElement("img");
      image.src = scene.src;
      image.alt = `${item.title} 실제 장면`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", fallback, { once: true });
      els.dailyFeatureImage.append(image);
    } else fallback();
  }

  // 주소에 탐색 상태를 남긴다. 공유·새로고침·실험실로 복귀가 같은 목록을 가리킨다.
  function catalogParams() {
    const query = new URLSearchParams();
    if (state.section === "play") query.set("play", state.activeCategory);
    else if (state.activeCategory !== "all") query.set("cat", state.activeCategory);
    if (state.query) { query.set("q", state.query); query.set("scope", state.scope); }
    return query;
  }

  function selectionLabel() {
    return state.section === "play"
      ? (state.activeCategory === "all" ? "과학 놀이" : playInfo(state.activeCategory).title)
      : (state.activeCategory === "all" ? "물리 가상실험" : catInfo(state.activeCategory).name);
  }

  function savePosition(link) {
    try {
      sessionStorage.setItem("phase-catalog-position:" + catalogParams(), JSON.stringify({
        y: scrollY, id: link.dataset.id, menus: [...openMenus],
      }));
    } catch (_) { /* 저장소가 제한된 환경에서도 탐색은 계속된다. */ }
  }

  function restorePosition() {
    try {
      const key = "phase-catalog-position:" + catalogParams();
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      sessionStorage.removeItem(key);
      if (!saved) return;
      for (const section of saved.menus || []) if (["lab", "play"].includes(section)) openMenus.add(section);
      syncMenus();
      requestAnimationFrame(() => {
        const card = [...els.expGrid.querySelectorAll(".exp-card")].find(el => el.dataset.id === saved.id);
        card?.focus({ preventScroll: true });
        if (Number.isFinite(saved.y)) window.scrollTo({ top: Math.max(0, saved.y), behavior: "instant" });
      });
    } catch (_) {}
  }

  // 오른쪽 제목은 왼쪽 메뉴에서 고른 자리를 그대로 되읽어 준다 —
  // 윗줄에 묶음 이름, 아랫줄에 고른 줄. 왼쪽 박스가 "제목 + 항목들"인 것과
  // 같은 모양이라 어디를 눌렀는지가 바로 이어진다.
  //
  // 예전에는 "전체 실험"이라고만 적었는데, 박스가 둘이 되면서 어느 묶음의
  // 전체인지가 빠졌다. 한 줄로 붙여 쓰는 것도 해 봤지만("물리 가상실험 ·
  // 역학과 에너지") 가운뎃점 없이는 한 덩어리로 읽히고, 넣으면 딱딱하다.
  function setSectionTitle(section, item) {
    els.expSectionTitle.innerHTML = `<span class="group-name">${escapeHTML(section)}</span>${escapeHTML(item)}`;
  }

  function catInfo(id) {
    return state.categories.find((c) => c.id === id) || { name: id };
  }

  function playInfo(id) {
    return state.plays.find((p) => p.id === id) || { title: id };
  }

  function isNew(exp) {
    if (exp.source !== "firebase") return false;
    if (!exp.date) return false;
    const days = (Date.now() - new Date(exp.date).getTime()) / 86400000;
    return days <= 7;
  }

  // ---------- 좌측 영역 메뉴 ----------
  // 박스 하나를 그린다. rows는 {id, name, count?} 목록.
  function sideBox(section, title, rows) {
    const body = rows
      .map((r) => {
        const on = state.section === section && state.activeCategory === r.id;
        const count = r.count == null ? "" : `<span class="count">${r.count}</span>`;
        return `
        <div class="side-item ${on ? "active" : ""}" data-section="${section}" data-cat="${r.id}">
          <span class="name">${escapeHTML(r.name)}</span>
          ${count}
        </div>`;
      })
      .join("");
    // .side-row로 한 번 더 감싸는 것은 좁은 화면 때문이다. 거기서는 제목이
    // 윗줄에 서고 항목만 가로로 넘어가야 하는데, 제목과 항목이 같은 상자에
    // 있으면 항목이 제목 옆을 지나가며 글자가 잘려 보인다.
    const count = section === "play" ? state.plays.length : state.experiments.length;
    return `<div class="side-box side-filter-box" data-menu="${section}"><div class="side-filter-heading"><div class="side-box-title">${title}</div><button class="side-menu-toggle" type="button" aria-expanded="false" aria-controls="${section}MenuRows"><span class="side-menu-label"><span class="side-menu-title">${title}</span><span class="side-menu-count">${count}</span></span><span class="side-menu-chevron" aria-hidden="true"></span><small class="side-menu-current"></small><span class="side-menu-action">펼치기</span></button></div><div class="side-row" id="${section}MenuRows">${body}</div></div>`;
  }

  function syncMenus() {
    const boxes = Array.from(els.sideMenu.querySelectorAll(".side-filter-box"));
    if (!boxes.length) return;
    boxes.forEach(box => {
      const section = box.dataset.menu,
        open = !desktopMenu.matches || openMenus.has(section),
        button = box.querySelector(".side-menu-toggle");
      box.classList.toggle("is-open", open);
      box.classList.toggle("is-selected", state.section === section);
      box.querySelector(".side-row").hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.querySelector(".side-menu-action").textContent = open ? "접기" : "펼치기";
      button.querySelector(".side-menu-current").textContent = state.section === section && state.activeCategory !== "all"
        ? (section === "play" ? playInfo(state.activeCategory).title : catInfo(state.activeCategory).name) : "전체";
    });
    if (desktopMenu.matches) {
      const headerHeight = boxes.reduce((sum, box) => sum + box.querySelector(".side-filter-heading").getBoundingClientRect().height, 0),
        navHeight = document.querySelector(".site-nav").getBoundingClientRect().height,
        available = innerHeight - navHeight - headerHeight - boxes.length * 26 - (boxes.length - 1) * 14 - 48;
      const listHeight = available / Math.max(1, openMenus.size);
      els.sideMenu.style.setProperty("--side-list-height", Math.max(112, Math.min(400, listHeight)) + "px");
      els.sideMenu.classList.toggle("side-menu-tall", openMenus.size > 0 && listHeight < 112);
    } else els.sideMenu.classList.remove("side-menu-tall");
  }

  function revealDesktopPreview(force = false) {
    if (!desktopMenu.matches) return;
    requestAnimationFrame(() => {
      const section = document.getElementById("expSection"),
        preview = els.expGrid.querySelector(".exp-preview") || section,
        bounds = preview.getBoundingClientRect(),
        top = Math.max(0, document.querySelector(".site-nav").getBoundingClientRect().bottom) + 18;
      if (force || bounds.top < top || bounds.bottom > innerHeight - 18)
        window.scrollTo({ top: Math.max(0, scrollY + section.getBoundingClientRect().top - top),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
  }

  function updateSidebarSelection(reveal) {
    let selected;
    els.sideMenu.querySelectorAll("[data-cat]").forEach((el) => {
      const active = el.dataset.section === state.section && el.dataset.cat === state.activeCategory;
      el.classList.toggle("active", active);
      el.setAttribute("aria-pressed", String(active));
      if (active) selected = el;
    });
    if (!reveal || !selected || !window.matchMedia("(max-width: 860px)").matches) return;
    requestAnimationFrame(() => {
      const row = selected.closest(".side-row");
      const itemBounds = selected.getBoundingClientRect();
      const rowBounds = row.getBoundingClientRect();
      const rightEdge = rowBounds.left + row.clientWidth;
      const adjustment = itemBounds.left < rowBounds.left
        ? itemBounds.left - rowBounds.left
        : itemBounds.right > rightEdge ? itemBounds.right - rightEdge : 0;
      if (Math.abs(adjustment) < 1) return;
      row.scrollTo({
        left: row.scrollLeft + adjustment,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
  }

  function renderSidebar(reveal = false) {
    // Keep the existing scroll containers when changing filters or searching.
    if (els.sideMenu.childElementCount) {
      updateSidebarSelection(reveal);
      syncMenus();
      return;
    }
    const catRows = [{ id: "all", name: "전체" }, ...state.categories].map((c) => ({
      id: c.id,
      name: c.name,
      count: c.id === "all" ? state.experiments.length : state.experiments.filter((e) => e.category === c.id).length,
    }));

    // 과학 놀이 박스도 위쪽 박스와 똑같이 "전체" 줄로 시작한다. 개수 뱃지는
    // 전체 줄에만 단다 — 활동 줄마다 붙이면 전부 "1"이라 아무 정보도 안 된다.
    const playRows = state.plays.length
      ? [
          { id: "all", name: "전체", count: state.plays.length },
          ...state.plays.map((p) => ({ id: p.id, name: p.title })),
        ]
      : [];

    let html = sideBox("lab", "물리 가상실험", catRows);
    if (playRows.length) html += sideBox("play", PLAY_SECTION.name, playRows);
    els.sideMenu.innerHTML = html;
    els.sideMenu.querySelectorAll(".side-menu-toggle").forEach(button => button.addEventListener("click", () => {
      const section = button.closest("[data-menu]").dataset.menu;
      if (openMenus.has(section)) openMenus.delete(section);
      else openMenus.add(section);
      syncMenus();
      if (openMenus.has(section)) revealDesktopPreview(true);
    }));

    els.sideMenu.querySelectorAll("[data-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        const menuTop = desktopMenu.matches ? null : el.getBoundingClientRect().top;
        state.section = el.dataset.section;
        state.activeCategory = el.dataset.cat;
        state.scope = "selection";
        render(true);
        if (menuTop !== null) {
          // Daily Pick can collapse or expand above the menu. Keep the tapped
          // item at its viewport position, including without browser anchoring.
          // Reading the new layout accounts for any native adjustment already made.
          const offset = el.getBoundingClientRect().top - menuTop;
          if (Math.abs(offset) > 1) window.scrollBy({ top: offset, behavior: "instant" });
        }
      });
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          el.click();
        }
      });
    });
    updateSidebarSelection(true);
    syncMenus();
  }

  // Pre-rendered scene images: browsing the catalog never runs activities.
  function previewMarkup(exp) {
    const scene = exp.source === 'static' ? window.PHASE_PREVIEWS?.items?.[exp.id] : null;
    const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    if (!scene) return '<span class="preview-unavailable">미리보기 준비 중</span>';
    return '<img src="' + escape(scene.src) + '" alt="' + escape(exp.title) + ' 실제 장면" width="720" height="540" loading="lazy" decoding="async">';
  }

  // ---------- 검색/필터 매칭 ----------
  function matches(exp, q) {
    if (!q) return true;
    const normalize = value => String(value).normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    const hay = normalize([exp.title, exp.description, ...(exp.tags || [])].join(" "));
    return q.trim().split(/\s+/).every(word => hay.includes(normalize(word)));
  }

  function renderExperiments() {
    let filtered;

    if (state.query && state.scope === "all") {
      filtered = [...state.experiments, ...state.plays].filter(e => matches(e, state.query));
      setSectionTitle("검색 결과", "전체 실험·놀이");
    } else if (state.section === "play") {
      // "전체"면 놀이를 전부, 활동 줄을 고르면 그 활동만.
      // 검색 범위를 선택 영역으로 좁힌 경우에는 고른 놀이를 유지한다.
      // 전체 실험·놀이 검색은 위 분기에서 두 목록을 함께 찾는다.
      const all = state.activeCategory === "all";
      filtered = state.plays.filter((p) => (all || p.id === state.activeCategory) && matches(p, state.query));
      setSectionTitle(PLAY_SECTION.name, all ? "전체" : playInfo(state.activeCategory).title);
    } else {
      filtered = state.experiments.filter(
        (e) => (state.activeCategory === "all" || e.category === state.activeCategory) && matches(e, state.query)
      );

      // "전체" 보기에서는 experiments.json에 적힌 순서(추가한 순서)가 아니라
      // 좌측 메뉴와 같은 영역 순서로 묶어서 보여준다. 영역별 순서는 sort()가
      // stable이라 같은 영역 안에서는 원래 순서가 그대로 유지된다.
      const catOrder = new Map(state.categories.map((c, i) => [c.id, i]));
      filtered.sort((a, b) => (catOrder.get(a.category) ?? 999) - (catOrder.get(b.category) ?? 999));

      setSectionTitle(
        LAB_SECTION.name,
        state.activeCategory === "all" ? "전체" : catInfo(state.activeCategory).name
      );
    }

    // 개수 표시는 lab.html에서 제거됨(사이드바와 중복). 요소가 없어도 안전하게.
    if (els.expCount) els.expCount.textContent = `${filtered.length}개`;

    els.clearSearch.hidden = !els.searchInput.value;
    els.searchTools.hidden = !state.query;
    els.searchSummary.textContent = state.query ? `“${state.query}” 검색 결과 ${filtered.length}개` : "";
    els.selectionScope.textContent = selectionLabel();
    document.querySelectorAll("[data-scope]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scope === state.scope)));

    if (filtered.length === 0) {
      els.expGrid.innerHTML = `<div class="catalog-empty"><span class="empty-icon" aria-hidden="true">⌕</span><h3>찾으시는 실험이 아직 보이지 않아요</h3><p>검색어를 짧게 바꾸거나 다른 영역에서도 찾아보세요.</p>${state.query && state.scope !== "all" ? '<button type="button" data-empty-action="all">전체에서 찾기</button>' : ''}<button type="button" data-empty-action="reset">전체 실험 보기</button></div>`;
      els.expGrid.querySelectorAll("[data-empty-action]").forEach(button => button.addEventListener("click", () => {
        if (button.dataset.emptyAction === "all") state.scope = "all";
        else { state.query = ""; els.searchInput.value = ""; state.section = "lab"; state.activeCategory = "all"; state.scope = "all"; }
        render();
        els.searchInput.focus({ preventScroll: true });
      }));
      return;
    }

    els.expGrid.innerHTML = filtered
      .map((e, index) => {
        // 목록 태그는 이름만 표시하고 색은 [data-cat] 규칙이 맡는다.
        const isPlay = e.section === "play";
        const tagCat = isPlay ? "play" : e.category;
        const tag = isPlay ? PLAY_SECTION.name : catInfo(e.category).name;
        let url = isPlay
          ? `view.html?id=${encodeURIComponent(e.id)}&src=play`
          : `view.html?id=${encodeURIComponent(e.id)}&src=${e.source}`;
        const from = catalogParams().toString();
        if (from) url += `&from=${encodeURIComponent(from)}`;
        const lessonMarkup = e.lessonNote?.question
          ? `<div class="lesson-note-preview"><span>실험 길잡이</span><strong>${escapeHTML(e.lessonNote.question)}</strong></div>`
          : "";
        return `
        <a class="exp-card ${isNew(e) ? "new" : ""}" data-id="${escapeHTML(e.id)}" href="${escapeHTML(url)}">
          <div class="exp-preview">${previewMarkup(e)}<span class="card-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></div>
          <div class="body">
            <span class="tag" data-cat="${escapeHTML(tagCat)}">${escapeHTML(tag)}</span>
            <h3>${escapeHTML(e.title)}</h3>
            <p>${escapeHTML(e.description)}</p>
            ${lessonMarkup}
            <div class="meta"><span class="go">체험하기 ↗</span></div>
          </div>
        </a>`;
      })
      .join("");

    els.expGrid.querySelectorAll('.exp-preview img').forEach(img => {
      img.addEventListener('error', () => {
        const note = document.createElement('span');
        note.className = 'preview-unavailable';
        note.textContent = '미리보기를 불러오지 못했어요';
        img.replaceWith(note);
      }, { once: true });
    });
  }

  function render(reveal = false) {
    els.dailyFeature.hidden = !recommendation || Boolean(state.query) || state.section !== "lab" || state.activeCategory !== "all";
    renderSidebar(reveal);
    renderExperiments();
    if (location.pathname.endsWith("/lab.html")) {
      const query = catalogParams().toString();
      try { history.replaceState(history.state, "", "lab.html" + (query ? "?" + query : "")); } catch (_) {}
    }
    if (reveal) revealDesktopPreview();
  }

  render();
  restorePosition();
  // 모바일 레이어가 열리기 전에 목록 위치를 저장한다.
  els.expGrid.addEventListener("click", event => {
    const link = event.target.closest(".exp-card");
    if (link) savePosition(link);
  }, true);
  if (desktopMenu.addEventListener) desktopMenu.addEventListener("change", syncMenus);
  else desktopMenu.addListener(syncMenus);
  window.addEventListener("resize", syncMenus);

  // ---------- 검색 ----------
  function doSearch() {
    const nextQuery = els.searchInput.value.trim();
    if (!state.query && nextQuery) state.scope = "all";
    state.query = nextQuery;
    render();
  }
  els.searchForm.addEventListener("submit", event => {
    event.preventDefault();
    doSearch();
    els.searchInput.blur();
    document.getElementById("expSection").focus({ preventScroll: true });
    document.getElementById("expSection").scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
  els.searchInput.addEventListener("input", event => { if (!event.isComposing) doSearch(); });
  els.searchInput.addEventListener("compositionend", doSearch);
  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = ""; doSearch(); els.searchInput.focus();
  });
  document.querySelectorAll("[data-query]").forEach(button => button.addEventListener("click", () => {
    state.scope = "all"; els.searchInput.value = button.dataset.query; doSearch();
  }));
  document.querySelectorAll("[data-scope]").forEach(button => button.addEventListener("click", () => {
    state.scope = button.dataset.scope; render();
  }));
})();
