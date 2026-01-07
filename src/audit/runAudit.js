import { fetchRenderedHtml } from "./fetchHtml.js";
import { analyzeOnPage } from "./onpage.js";
import { analyzeLinks } from "./links.js";
import { detectTech } from "./tech.js";
import { analyzeSite } from "./site.js";
import { runLighthouse } from "./lighthouse.js";
import { reportTemplate } from "../report/template.js";
import { saveHtml } from "../report/buildHtml.js";
import { htmlToPdf } from "../report/exportPdf.js";

export async function runAudit({ url }) {
  if (!url) throw new Error("URL saknas");

  // 1) Render page, collect HTML + screenshots
  const rendered = await fetchRenderedHtml(url);

  // 2) Audits
  const onpage = analyzeOnPage(rendered.html);
  const links = await analyzeLinks(rendered.html, rendered.finalUrl);
  const site = await analyzeSite(rendered.finalUrl, rendered.headers);
  const tech = await detectTech(rendered.finalUrl);
  const lighthouse = await runLighthouse(rendered.finalUrl);

  // 3) Build report data
  const reportData = {
    url,
    finalUrl: rendered.finalUrl,
    title: rendered.title,
    screenshotPath: rendered.screenshotPath,
    screenshotMobilePath: rendered.screenshotMobilePath,
    headers: rendered.headers,
    navigation: rendered.navigation,
    resources: rendered.resources,
    site,
    onpage,
    links,
    tech,
    lighthouse,
  };

  // 4) Render HTML/PDF
  const html = reportTemplate(reportData);
  const ts = Date.now();
  const htmlPath = `output/report-${ts}.html`;
  const pdfPath = `output/report-${ts}.pdf`;
  saveHtml(html, htmlPath);
  await htmlToPdf(htmlPath, pdfPath);

  return { htmlPath, pdfPath, reportData };
}
