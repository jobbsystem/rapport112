import fs from "fs";

export function saveHtml(html, outPath) {
  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(outPath, html, "utf-8");
}