// Refresh both changed game URLs while preserving the shared catalog and play order.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  file = path.join(root, "data/experiments.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")),
  newton = data.plays.find((p) => p.id === "newton-rush");
if (!newton) throw Error("Newton Rush is not registered");
const html = fs
  .readFileSync(path.join(root, "plays/newton-rush.html"), "utf8")
  .replace(/\r\n/g, "\n");
newton.path =
  "plays/newton-rush.html?v=" +
  crypto.createHash("sha256").update(html).digest("hex").slice(0, 10);
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
require("./faraday-register.cjs");
