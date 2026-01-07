import lighthouse from "lighthouse";
import { chromium } from "playwright";

// Kör Lighthouse via Chrome remote debugging port
export async function runLighthouse(url) {
  const port = 9222;

  const browser = await chromium.launch({
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });

  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "silent",
  });

  await browser.close();

  const { categories, audits } = result.lhr;

  return {
    scores: {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories["best-practices"]?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
    },
    metrics: {
      firstContentfulPaint: audits["first-contentful-paint"]?.displayValue ?? null,
      largestContentfulPaint: audits["largest-contentful-paint"]?.displayValue ?? null,
      cumulativeLayoutShift: audits["cumulative-layout-shift"]?.displayValue ?? null,
      speedIndex: audits["speed-index"]?.displayValue ?? null,
      totalBlockingTime: audits["total-blocking-time"]?.displayValue ?? null,
      timeToInteractive: audits["interactive"]?.displayValue ?? null,
    },
  };
}
