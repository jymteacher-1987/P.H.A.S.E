// ================================================================
// 메인(대문) 페이지 로직: 방문자 카운터, 영역 미리보기, 검색창(실험실로 이동)
// ================================================================
(async function () {
  const els = {
    todayCount: document.getElementById("todayCount"),
    totalCount: document.getElementById("totalCount"),
    expTotalCount: document.getElementById("expTotalCount"),
    dailyPick: document.getElementById("homeDailyPick"),
    dailyPickTitle: document.getElementById("homeDailyPickTitle"),
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
  const { categories, experiments, plays } = await SITE.getAllData();
  // 실험 개수와 과학 놀이 개수를 더하지 않고 나란히 보여준다.
  if (els.expTotalCount) {
    const playCount = (plays || []).length;
    els.expTotalCount.innerHTML = playCount
      ? `${experiments.length}<span class="num-plus">+${playCount}</span>`
      : String(experiments.length);
  }
  const recommendation = SITE.getDailyRecommendation(experiments);
  if (recommendation && els.dailyPick && els.dailyPickTitle) {
    const item = recommendation.item;
    els.dailyPick.href = `view.html?id=${encodeURIComponent(item.id)}&src=${encodeURIComponent(item.source)}`;
    els.dailyPickTitle.textContent = item.title;
    els.dailyPick.setAttribute("aria-label", `오늘의 추천 실험: ${item.title} 열기`);
    els.dailyPick.hidden = false;
  }

  // ---------- 검색: 실험실 페이지로 검색어를 들고 이동 ----------
  function goSearch() {
    const q = els.searchInput.value.trim();
    location.href = "lab.html" + (q ? `?q=${encodeURIComponent(q)}` : "");
  }
  // The current home has navigation cards; older layouts also have a search form.
  if (els.searchBtn && els.searchInput) {
    els.searchBtn.addEventListener("click", goSearch);
    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goSearch();
    });
  }
})();
