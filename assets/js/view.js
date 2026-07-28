(async function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const { categories, experiments } = await SITE.getAllData();
  const exp = experiments.find((e) => e.id === id);

  const titleEl = document.getElementById("expTitle");
  const catEl = document.getElementById("expCat");
  const frame = document.getElementById("expFrame");

  if (!exp) {
    titleEl.textContent = "실험을 찾을 수 없습니다";
    catEl.textContent = "";
    return;
  }

  document.title = `${exp.title} — 물리 실험실`;
  titleEl.textContent = exp.title;
  const c = categories.find((c) => c.id === exp.category);
  catEl.textContent = c ? `${c.icon} ${c.name}` : "";
  frame.src = exp.path;
})();
