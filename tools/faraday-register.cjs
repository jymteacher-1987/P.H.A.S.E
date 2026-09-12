// Keep the requested play order, and version every file used by this game.
const fs = require("node:fs"),
  crypto = require("node:crypto"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  base = "assets/faraday-flight/";
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
const hash = (s) =>
  crypto
    .createHash("sha256")
    .update(typeof s === "string" ? s.replace(/\r\n/g, "\n") : s)
    .digest("hex")
    .slice(0, 10);
const files = [
  "style.css",
  "physics.js",
  "induction-diagram.js",
  "leaderboard.js",
  "levels.js",
  "audio.js",
  "sprites.js",
  "game.js",
  "hero.webp",
  "enemies.webp",
  "boss.webp",
  "world.webp",
  "poverty.webp",
  "gate.webp",
  "symbols.webp",
  "fog.webp",
];
const imageVersions = Object.fromEntries(
  files
    .filter((n) => n.endsWith(".webp"))
    .map((n) => [
      n.replace(".webp", ""),
      hash(fs.readFileSync(path.join(root, base + n))),
    ]),
);
write(
  base + "sprites.js",
  "window.FaradaySprites = " +
    JSON.stringify(JSON.parse(read(base + "sprites.json"))) +
    ";\nwindow.FaradayImageVersions = " +
    JSON.stringify(imageVersions) +
    ";\n",
);
let html = read("plays/faraday-flight.html");
for (const name of files) {
  const url = "../" + base + name,
    escape = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const data = name.endsWith(".webp")
    ? fs.readFileSync(path.join(root, base + name))
    : read(base + name);
  html = html.replace(
    new RegExp(escape + '(?:\\?v=[^"\\s]+)?', "g"),
    url + "?v=" + hash(data),
  );
}
write("plays/faraday-flight.html", html);
const data = JSON.parse(read("data/experiments.json"));
data.plays = data.plays.filter((p) => p.id !== "faraday-flight");
const index = data.plays.findIndex((p) => p.id === "afterlight");
if (index < 0)
  throw Error(
    "Cannot find 잔광: 마지막 신호. Do not guess the requested order.",
  );
data.plays.splice(index, 0, {
  id: "faraday-flight",
  title: "패러데이: 스파크 항해",
  icon: "⚡",
  description:
    "코일과 자석으로 비행기를 강화하고, 축전기의 스파크 폭풍으로 돌파하세요. 패러데이의 삶에서 만난 다섯 어려움이 다섯 보스로 등장하는 비행 슈팅. 자동 공격, 모바일 드래그 조작, 이어하기와 작은 발명 노트를 지원합니다.",
  path: "plays/faraday-flight.html?v=" + hash(html),
  date: "2026-09-13",
  tags: ["전자기 유도", "패러데이", "슈팅", "보스전", "과학 놀이"],
});
const json = JSON.stringify(data, null, 2) + "\n",
  js = "window.EXPERIMENTS_DATA = " + json.trimEnd() + ";\n";
write("data/experiments.json", json);
write("assets/js/experiments-data.js", js);
for (const file of [
  "index.html",
  "lab.html",
  "view.html",
  "admin-k7f3x9q2.html",
])
  write(
    file,
    read(file).replace(
      /assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,
      "assets/js/experiments-data.js?v=" + hash(js),
    ),
  );
console.log(
  `Registered Faraday immediately before Afterlight: ${data.experiments.length}+${data.plays.length}`,
);
