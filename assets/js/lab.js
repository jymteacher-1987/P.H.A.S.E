// ================================================================
// 실험실 페이지 로직: 좌측 영역 메뉴, 검색, 실험 카드(+라이브 미리보기) 렌더링
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

  function renderSidebar() {
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

  // 미리보기 iframe을 언제 "보여줄지" 정하는 값들.
  //
  // 예전에는 iframe을 붙이는 즉시 자리표시자(.ph)를 지웠는데, 그러면 실험
  // 페이지의 body 배경이 먼저 칠해진다. 빛의 3원색(rgb-cmy-light)처럼 배경이
  // 어둡고(#101418) 파일까지 무거운 실험은 새까만 사각형이 몇 초 떠 있다가
  // 뒤늦게 내용이 나타나서 보기 나빴다.
  //
  // 그래서 load가 끝난 뒤 GRACE만큼 더 기다렸다가(스크립트가 첫 화면을
  // 그릴 여유) 자리표시자를 걷어내고 iframe을 페이드인한다. load가 아예
  // 안 오는 경우를 대비해 TIMEOUT을 안전장치로 둔다 — 이게 없으면 자리표시자가
  // 영영 남는다. 아직도 검은 화면이 보이면 GRACE부터 키울 것.
  //
  // 미리보기는 실험이 실제로 돌아가는 모습을 그대로 보여준다. 한때 첫 화면이
  // 그려진 뒤 iframe 안의 애니메이션을 끊어 사진처럼 세워 본 적이 있는데,
  // 원운동과 단진동처럼 자취가 천천히 쌓이는 실험은 곡선이 반쯤 그려진 채
  // 잘려 보여서 되돌렸다. 다시 시도하려거든 그 실험부터 확인할 것.
  const PREVIEW_REVEAL_GRACE = 600;
  const PREVIEW_REVEAL_TIMEOUT = 10000;

  function loadPreview(box) {
    const src = box.dataset.src;
    if (!src) return;
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.loading = "lazy";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    iframe.tabIndex = -1;
    iframe.classList.add("loading");

    const ph = box.querySelector(".ph");
    let revealed = false;
    function reveal() {
      if (revealed) return;
      revealed = true;
      iframe.classList.remove("loading");
      if (ph) {
        ph.classList.add("fade-out");
        setTimeout(() => ph.remove(), 320);
      }
    }
    iframe.addEventListener("load", () => setTimeout(reveal, PREVIEW_REVEAL_GRACE));
    setTimeout(reveal, PREVIEW_REVEAL_TIMEOUT);

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
          <div class="exp-preview" data-src="${e.path}"><span class="ph"></span></div>
          <div class="body">
            <span class="tag" data-cat="${tagCat}">${tag}</span>
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
