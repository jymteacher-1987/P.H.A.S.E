// ================================================================
// 메인(대문) 페이지 로직: 방문자 카운터, 영역 미리보기, 검색창(실험실로 이동)
// ================================================================
(async function () {
  const els = {
    todayCount: document.getElementById("todayCount"),
    totalCount: document.getElementById("totalCount"),
    expTotalCount: document.getElementById("expTotalCount"),
    catGrid: document.getElementById("catGrid"),
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
  };

  // ---------- 방문자 카운터 ----------
  function renderCounts(today, total, configured) {
    els.todayCount.textContent = configured ? (today ?? "–") : "–";
    els.totalCount.textContent = configured ? (total ?? "–") : "–";
  }
  SITE.recordVisitAndGetCounts().then((r) => {
    renderCounts(r.today, r.total, r.configured);
  });

  // ---------- 데이터 로드 (영역 미리보기용) ----------
  const { categories, experiments } = await SITE.getAllData();
  if (els.expTotalCount) els.expTotalCount.textContent = experiments.length;

  if (els.catGrid) {
    els.catGrid.innerHTML = categories
      .map((c) => {
        const count = experiments.filter((e) => e.category === c.id).length;
        return `
        <a class="cat-card" href="lab.html?cat=${encodeURIComponent(c.id)}">
          <span class="icon">${c.icon}</span>
          <h3>${c.name}</h3>
          <p>${c.description || ""}</p>
          <span class="cat-count">${count}개의 실험 →</span>
        </a>`;
      })
      .join("");
  }

  // ---------- 검색: 실험실 페이지로 검색어를 들고 이동 ----------
  function goSearch() {
    const q = els.searchInput.value.trim();
    location.href = "lab.html" + (q ? `?q=${encodeURIComponent(q)}` : "");
  }
  els.searchBtn.addEventListener("click", goSearch);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") goSearch();
  });
})();
