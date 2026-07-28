// ================================================================
// 메인(대문) 페이지 로직: 방문자 카운터, 영역 미리보기, 검색창(실험실로 이동)
// ================================================================
(async function () {
  const els = {
    todayCount: document.getElementById("todayCount"),
    totalCount: document.getElementById("totalCount"),
    expTotalCount: document.getElementById("expTotalCount"),
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
