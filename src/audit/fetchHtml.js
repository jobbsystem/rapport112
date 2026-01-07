import fs from "fs";
import path from "path";
import { chromium } from "playwright";

export async function fetchRenderedHtml(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const resourceEvents = [];
  page.on("response", async (response) => {
    try {
      const req = response.request();
      const headers = response.headers();
      const sizeHeader = headers["content-length"];
      const size = sizeHeader ? parseInt(sizeHeader, 10) : null;
      const resUrl = response.url();
      if (resUrl.startsWith("data:")) return;
      const cacheControl = headers["cache-control"] || "";
      const protocol = resUrl.startsWith("https:")
        ? "https"
        : resUrl.startsWith("http:")
        ? "http"
        : "";
      resourceEvents.push({
        url: resUrl,
        status: response.status(),
        type: req.resourceType(),
        size: Number.isFinite(size) ? size : null,
        fromCache: response.fromServiceWorker() || response.status() === 304,
        protocol,
        cacheControl,
      });
    } catch {
      // ignore telemetry errors
    }
  });

  // Mer generösa timeouts för tunga sidor
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  console.log("Renderar:", url);

  let mainResponse = null;
  const redirectChain = [];
  try {
    mainResponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  } catch (err) {
    console.warn("goto(domcontentloaded) misslyckades, testar waitUntil=load...");
    mainResponse = await page.goto(url, { waitUntil: "load", timeout: 120000 });
  }
  // Spara redirectkedja om tillgängligt
  const req = mainResponse?.request?.();
  if (req) {
    const redirects = req.redirectedFrom?.();
    if (redirects && Array.isArray(redirects)) {
      redirects.forEach((r) => {
        redirectChain.push({
          url: r.url(),
          method: r.method(),
        });
      });
    }
    redirectChain.push({ url: req.url(), method: req.method(), status: mainResponse?.status?.() });
  }

  await page.waitForTimeout(2500);

  const finalUrl = page.url();
  const html = await page.content();
  const title = await page.title().catch(() => "");

  const ts = Date.now();
  const outputDir = "output";
  fs.mkdirSync(outputDir, { recursive: true });

  const screenshotPath = path.join(outputDir, `screenshot-desktop-${ts}.png`);
  // Endast ovanför folden (inte fullPage) för snabbare och mindre bild
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Extra mobilvy
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
  });
  try {
    await mobilePage.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  } catch {
    await mobilePage.goto(finalUrl, { waitUntil: "load", timeout: 120000 });
  }
  await mobilePage.waitForTimeout(2000);

  const screenshotMobilePath = path.join(outputDir, `screenshot-mobile-${ts}.png`);
  await mobilePage.screenshot({ path: screenshotMobilePath, fullPage: true });

  const navTimings =
    (await page
      .evaluate(() => {
        const t = performance.timing;
        return {
          ttfb: t.responseStart - t.navigationStart,
          domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
          load: t.loadEventEnd - t.navigationStart,
        };
      })
      .catch(() => ({}))) || {};

  const resourceTiming =
    (await page
      .evaluate(() => {
        const entries = performance.getEntriesByType("resource") || [];
        const domains = {};
        entries.forEach((e) => {
          try {
            const u = new URL(e.name);
            domains[u.hostname] = (domains[u.hostname] || 0) + 1;
          } catch {
            // ignore
          }
        });
        const totalTransfer = entries.reduce((sum, e) => sum + (e.transferSize || 0), 0);
        return {
          entries: entries.length,
          totalTransfer,
          topDomains: Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([domain, count]) => ({ domain, count })),
        };
      })
      .catch(() => ({}))) || {};

  const totalBytesFromResponses = resourceEvents
    .map((r) => (Number.isFinite(r.size) ? r.size : 0))
    .reduce((a, b) => a + b, 0);
  const mixedContentCount =
    finalUrl.startsWith("https://") && resourceEvents.length
      ? resourceEvents.filter((r) => r.protocol === "http").length
      : 0;
  const cachedCount = resourceEvents.filter((r) => r.fromCache).length;
  const cacheControlMissing = resourceEvents.filter((r) => !r.cacheControl).length;

  await browser.close();

  return {
    url,
    finalUrl,
    html,
    title,
    screenshotPath,
    screenshotMobilePath,
    headers: mainResponse?.headers?.() || {},
    status: mainResponse?.status?.() || null,
    redirectChain,
    navigation: {
      timings: navTimings || {},
      resources: {
        requests: resourceEvents.length,
        totalBytes: totalBytesFromResponses || resourceTiming.totalTransfer || 0,
        topDomains: resourceTiming.topDomains || [],
        mixedContentCount,
        cachedCount,
        cacheControlMissing,
      },
    },
    resources: resourceEvents.slice(0, 200),
  };
}
