// ================================================================
// 실험실 페이지 로직: 좌측 영역 메뉴, 검색, 실험 카드(+대표 장면 이미지) 렌더링
//
// 좌측 메뉴는 박스 두 개로 나뉜다.
//   [물리 가상실험] 교육과정 영역별 필터 (전체 / 과학의 기초 / 역학과 에너지 / …)
//   [과학 놀이]     실험이 아닌 활동물 하나하나 (히어로 만들기 / …)
// 두 축을 한 목록에 섞으면 "과학 놀이"가 열·전자기학과 같은 급으로 보여서
// 박스를 따로 뒀다. 선택 상태(active)는 두 박스를 통틀어 항상 하나뿐이다
// — state.section이 어느 박스인지, state.activeCategory가 그 안의 어느
// 줄인지를 가리킨다. 과학 놀이 항목이 5~6개를 넘어가면 그때 박스 안을
// 다시 소분류로 나눌 것(지금은 개수가 적어 항목을 바로 나열한다).
// ================================================================
(async function () {
  const state = {
    categories: [],
    experiments: [],
    plays: [],
    section: "lab", // "lab" = 물리 가상실험 / "play" = 과학 놀이
    activeCategory: "all", // section이 "play"면 선택된 놀이의 id
    query: "",
  };

  const els = {
    sideMenu: document.getElementById("sideMenu"),
    expGrid: document.getElementById("expGrid"),
    expCount: document.getElementById("expCount"),
    expSectionTitle: document.getElementById("expSectionTitle"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
  };

  // 메인 페이지에서 검색어/카테고리를 들고 넘어온 경우 반영.
  // ?play=<id> 로 들어오면 과학 놀이 박스가 선택된 상태로 열린다.
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get("q") || "";
  const initialPlay = params.get("play") || "";
  const initialCat = params.get("cat") || "all";

  const { categories, experiments, plays } = await SITE.getAllData();
  state.categories = categories;
  state.experiments = experiments;
  state.plays = plays || [];
  state.query = initialQuery;
  if (initialPlay && (initialPlay === "all" || state.plays.some((p) => p.id === initialPlay))) {
    state.section = "play";
    state.activeCategory = initialPlay;
  } else {
    state.section = "lab";
    state.activeCategory = initialCat;
  }
  if (initialQuery) els.searchInput.value = initialQuery;

  const LAB_SECTION = { id: "lab", name: "물리 가상실험" };
  const PLAY_SECTION = { id: "play", name: "과학 놀이", icon: "🎈" };

  // 오른쪽 제목은 왼쪽 메뉴에서 고른 자리를 그대로 되읽어 준다 —
  // 윗줄에 묶음 이름, 아랫줄에 고른 줄. 왼쪽 박스가 "제목 + 항목들"인 것과
  // 같은 모양이라 어디를 눌렀는지가 바로 이어진다.
  //
  // 예전에는 "전체 실험"이라고만 적었는데, 박스가 둘이 되면서 어느 묶음의
  // 전체인지가 빠졌다. 한 줄로 붙여 쓰는 것도 해 봤지만("물리 가상실험 ·
  // 역학과 에너지") 가운뎃점 없이는 한 덩어리로 읽히고, 넣으면 딱딱하다.
  function setSectionTitle(section, item) {
    els.expSectionTitle.innerHTML = `<span class="group-name">${section}</span>${item}`;
  }

  function catInfo(id) {
    return state.categories.find((c) => c.id === id) || { name: id, icon: "🧪" };
  }

  function playInfo(id) {
    return state.plays.find((p) => p.id === id) || { title: id, icon: "🎈" };
  }

  function isNew(exp) {
    if (exp.source !== "firebase") return false;
    if (!exp.date) return false;
    const days = (Date.now() - new Date(exp.date).getTime()) / 86400000;
    return days <= 7;
  }

  // ---------- 좌측 영역 메뉴 ----------
  // 박스 하나를 그린다. rows는 {id, name, icon, count?} 목록.
  function sideBox(section, title, rows) {
    const body = rows
      .map((r) => {
        const on = state.section === section && state.activeCategory === r.id;
        const count = r.count == null ? "" : `<span class="count">${r.count}</span>`;
        return `
        <div class="side-item ${on ? "active" : ""}" data-section="${section}" data-cat="${r.id}">
          <span class="icon">${r.icon}</span>
          <span class="name">${r.name}</span>
          ${count}
        </div>`;
      })
      .join("");
    // .side-row로 한 번 더 감싸는 것은 좁은 화면 때문이다. 거기서는 제목이
    // 윗줄에 서고 항목만 가로로 넘어가야 하는데, 제목과 항목이 같은 상자에
    // 있으면 항목이 제목 옆을 지나가며 글자가 잘려 보인다.
    return `<div class="side-box"><div class="side-box-title">${title}</div><div class="side-row">${body}</div></div>`;
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
      return;
    }
    const catRows = [{ id: "all", name: "전체", icon: "🗂️" }, ...state.categories].map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      count: c.id === "all" ? state.experiments.length : state.experiments.filter((e) => e.category === c.id).length,
    }));

    // 과학 놀이 박스도 위쪽 박스와 똑같이 "전체" 줄로 시작한다. 개수 뱃지는
    // 전체 줄에만 단다 — 활동 줄마다 붙이면 전부 "1"이라 아무 정보도 안 된다.
    const playRows = state.plays.length
      ? [
          { id: "all", name: "전체", icon: "🗂️", count: state.plays.length },
          ...state.plays.map((p) => ({ id: p.id, name: p.title, icon: p.icon || PLAY_SECTION.icon })),
        ]
      : [];

    let html = sideBox("lab", "물리 가상실험", catRows);
    if (playRows.length) html += sideBox("play", PLAY_SECTION.name, playRows);
    els.sideMenu.innerHTML = html;

    els.sideMenu.querySelectorAll("[data-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        state.section = el.dataset.section;
        state.activeCategory = el.dataset.cat;
        render(true);
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
    const hay = [exp.title, exp.description, ...(exp.tags || [])].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderExperiments() {
    let filtered;

    if (state.section === "play") {
      // "전체"면 놀이를 전부, 활동 줄을 고르면 그 활동만.
      // 검색어를 치면 고른 줄에 묶어 두지 않고 놀이 전체에서 찾는다 —
      // 안 그러면 다른 놀이를 검색했을 때 결과가 늘 비어 버린다.
      const all = state.activeCategory === "all" || state.query;
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

    if (filtered.length === 0) {
      els.expGrid.innerHTML = `<div class="empty-state">검색 결과가 없습니다. 다른 키워드로 시도해보세요.</div>`;
      return;
    }

    els.expGrid.innerHTML = filtered
      .map((e) => {
        // 놀이 카드는 영역 태그 자리에 "과학 놀이"가 들어간다. 태그 아이콘은
        // 활동 아이콘이 아니라 묶음 아이콘을 쓴다 — 실험 카드가 "영역 아이콘 +
        // 영역 이름"인 것과 짝을 맞추기 위해서다. 색은 style.css의
        // [data-cat="play"] 규칙이 맡는다.
        const isPlay = e.section === "play";
        const tagCat = isPlay ? "play" : e.category;
        const tag = isPlay
          ? `${PLAY_SECTION.icon} ${PLAY_SECTION.name}`
          : `${catInfo(e.category).icon} ${catInfo(e.category).name}`;
        const url = isPlay
          ? `view.html?id=${encodeURIComponent(e.id)}&src=play`
          : `view.html?id=${encodeURIComponent(e.id)}&src=${e.source}`;
        return `
        <a class="exp-card ${isNew(e) ? "new" : ""}" href="${url}">
          <div class="exp-preview">${previewMarkup(e)}</div>
          <div class="body">
            <span class="tag" data-cat="${tagCat}">${tag}</span>
            <h3>${e.title}</h3>
            <p>${e.description || ""}</p>
            <div class="meta"><span>${e.date || ""}</span><span class="go">열어보기 →</span></div>
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
    renderSidebar(reveal);
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
