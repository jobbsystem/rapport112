import { chromium } from "playwright";

export async function htmlToPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`file://${process.cwd()}/${htmlPath}`, { waitUntil: "networkidle" });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" },
  });

  await browser.close();
}