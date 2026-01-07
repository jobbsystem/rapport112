import { fetchRenderedHtml } from "./audit/fetchHtml.js";
import { runAudit } from "./audit/runAudit.js";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.log("Kör så här:\nnode src/run.js https://example.com");
    process.exit(1);
  }

  console.log("Startar audit...");
  const res = await runAudit({ url });
  console.log("KLART ✅");
  console.log("HTML:", res.htmlPath);
  console.log("PDF :", res.pdfPath);
}

main().catch((err) => {
  console.error("Fel:", err);
  process.exit(1);
});
