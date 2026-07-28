// ================================================================
// 실험실 페이지 로직: 좌측 영역 메뉴, 검색, 실험 카드(+라이브 미리보기) 렌더링
// ================================================================
(async function () {
  const state = { categories: [], experiments: [], activeCategory: "all", query: "" };

  const els = {
    sideMenu: document.getElementById("sideMenu"),
    expGrid: document.getElementById("expGrid"),
    expCount: document.getElementById("expCount"),
    expSectionTitle: document.getElementById("expSectionTitle"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
  };

  // 메인 페이지에서 검색어/카테고리를 들고 넘어온 경우 반영
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";
  const initialCat = params.get("cat") || "all";

  const { categories, experiments } = await SITE.getAllData();
  state.categories = categories;
  state.experiments = experiments;
  state.query = initialQuery;
  state.activeCategory = initialCat;
  if (initialQuery) els.searchInput.value = initialQuery;

  function catInfo(id) {
    return state.categories.find((c) => c.id === id) || { name: id, icon: "🧪" };
  }

  function isNew(exp) {
    if (exp.source !== "firebase") return false;
    if (!exp.date) return false;
    const days = (Date.now() - new Date(exp.date).getTime()) / 86400000;
    return days <= 7;
  }

  // ---------- 좌측 영역 메뉴 ----------
  function renderSidebar() {
    const items = [{ id: "all", name: "전체", icon: "🗂️" }, ...state.categories];
    els.sideMenu.innerHTML = items
      .map((c) => {
        const count = c.id === "all" ? state.experiments.length : state.experiments.filter((e) => e.category === c.id).length;
        return `
        <div class="side-item ${state.activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">
          <span class="icon">${c.icon}</span>
          <span class="name">${c.name}</span>
          <span class="count">${count}</span>
        </div>`;
      })
      .join("");

    els.sideMenu.querySelectorAll("[data-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        state.activeCategory = el.dataset.cat;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  // ---------- 미리보기 지연 로딩 ----------
  let previewObserver;
  function setupPreviewObserver() {
    if (previewObserver) previewObserver.disconnect();
    previewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const box = entry.target;
          loadPreview(box);
          previewObserver.unobserve(box);
        });
      },
      { rootMargin: "200px" }
    );
    els.expGrid.querySelectorAll(".exp-preview[data-src]").forEach((box) => previewObserver.observe(box));
  }

  // Virtual "desktop-style" viewport every experiment is rendered at inside
  // its preview iframe (see .exp-preview iframe in style.css — fixed
  // 900x675, same 4:3 ratio as the card). This keeps the source page out of
  // its own mobile breakpoint so it shows its normal roomy layout, and the
  // scale below always slightly OVER-covers the real card size so there is
  // never visible empty margin — some experiments don't use their full
  // canvas width/height, and a bit of edge-cropping on those looks far
  // better than dead space around the preview.
  //
  // The crop is anchored to the TOP-LEFT corner (see transform-origin:
  // top left + top:0/left:0 in style.css), not the center. Experiment
  // titles/headings almost always sit at the top (and often start near
  // the left), so any spare overscaled area is pushed off the bottom and
  // right edges instead of being split evenly around all four sides —
  // that keeps the title fully visible instead of clipping its top line.
  const PREVIEW_W = 900;
  const PREVIEW_OVERSCALE = 1.18;

  function loadPreview(box) {
    const src = box.dataset.src;
    if (!src) return;
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.loading = "lazy";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.tabIndex = -1;
    const ph = box.querySelector(".ph");
    if (ph) ph.remove();
    box.appendChild(iframe);

    function fitPreview() {
      const scale = (box.clientWidth / PREVIEW_W) * PREVIEW_OVERSCALE;
      iframe.style.transform = `scale(${scale})`;
    }
    fitPreview();
    const ro = new ResizeObserver(fitPreview);
    ro.observe(box);
  }

  // ---------- 검색/필터 매칭 ----------
  function matches(exp, q) {
    if (!q) return true;
    const hay = [exp.title, exp.description, ...(exp.tags || [])].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderExperiments() {
    const filtered = state.experiments.filter(
      (e) => (state.activeCategory === "all" || e.category === state.activeCategory) && matches(e, state.query)
    );

    // "전체" 보기에서는 experiments.json에 적힌 순서(추가한 순서)가 아니라
    // 좌측 메뉴와 같은 영역 순서로 묶어서 보여준다. 영역별 순서는 sort()가
    // stable이라 같은 영역 안에서는 원래 순서가 그대로 유지된다.
    const catOrder = new Map(state.categories.map((c, i) => [c.id, i]));
    filtered.sort((a, b) => (catOrder.get(a.category) ?? 999) - (catOrder.get(b.category) ?? 999));

    els.expCount.textContent = `${filtered.length}개`;
    els.expSectionTitle.textContent = state.activeCategory === "all" ? "전체 실험" : catInfo(state.activeCategory).name;

    if (filtered.length === 0) {
      els.expGrid.innerHTML = `<div class="empty-state">검색 결과가 없습니다. 다른 키워드로 시도해보세요.</div>`;
      return;
    }

    els.expGrid.innerHTML = filtered
      .map((e) => {
        const c = catInfo(e.category);
        const url = `view.html?id=${encodeURIComponent(e.id)}&src=${e.source}`;
        return `
        <a class="exp-card ${isNew(e) ? "new" : ""}" href="${url}">
          <div class="exp-preview" data-src="${e.path}"><span class="ph">🧪</span></div>
          <div class="body">
            <span class="tag" data-cat="${e.category}">${c.icon} ${c.name}</span>
            <h3>${e.title}</h3>
            <p>${e.description || ""}</p>
            <div class="meta"><span>${e.date || ""}</span><span class="go">열어보기 →</span></div>
          </div>
        </a>`;
      })
      .join("");

    setupPreviewObserver();
  }

  function render() {
    renderSidebar();
    renderExperiments();
  }

  render();

  // ---------- 검색 ----------
  function doSearch() {
    state.query = els.searchInput.value.trim();
    render();
  }
  els.searchBtn.addEventListener("click", doSearch);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value.trim();
    render();
  });
})();
