import * as cheerio from "cheerio";
import fetch from "node-fetch";

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
  ]);
}

async function checkLinkStatus(url) {
  try {
    const res = await withTimeout(
      fetch(url, { method: "HEAD", redirect: "follow" }),
      8000
    );
    return { ok: res.ok, status: res.status };
  } catch (err) {
    try {
      const res = await withTimeout(
        fetch(url, { method: "GET", redirect: "follow" }),
        8000
      );
      return { ok: res.ok, status: res.status };
    } catch (err2) {
      return { ok: false, status: 0, error: err2.message || err.message };
    }
  }
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export async function analyzeLinks(html, finalUrl) {
  const $ = cheerio.load(html);
  const base = new URL(finalUrl);
  const baseHost = base.hostname;

  const links = $("a[href]")
    .map((i, el) => {
      const rawHref = ($(el).attr("href") || "").trim();
      const href = normalizeUrl(rawHref, finalUrl);

      const rel = (($(el).attr("rel") || "") + "").toLowerCase();
      const nofollow = rel.includes("nofollow");
       const ugc = rel.includes("ugc");
       const sponsored = rel.includes("sponsored");
       const noopener = rel.includes("noopener");

      let external = false;
      try {
        external = new URL(href).hostname !== baseHost;
      } catch {
        external = false;
      }

      const anchor = $(el)
        .text()
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 140);

      return { href, anchor, external, nofollow, ugc, sponsored, noopener };
    })
    .get();

  const internalLinks = links.filter((l) => !l.external);
  const externalLinks = links.filter((l) => l.external);

  const uniqueToCheck = Array.from(
    new Map(
      [...internalLinks.slice(0, 15), ...externalLinks.slice(0, 15)].map((l) => [l.href, l])
    ).values()
  );

  const broken = [];
  for (const link of uniqueToCheck) {
    const res = await checkLinkStatus(link.href);
    if (!res.ok) {
      broken.push({
        href: link.href,
        anchor: link.anchor,
        status: res.status,
        type: link.external ? "external" : "internal",
      });
    }
  }

  return {
    total: links.length,
    internal: internalLinks.length,
    external: externalLinks.length,
    externalFollow: externalLinks.filter((l) => !l.nofollow).length,
    externalNofollow: externalLinks.filter((l) => l.nofollow).length,
    externalNoopener: externalLinks.filter((l) => l.noopener).length,
    externalUgc: externalLinks.filter((l) => l.ugc).length,
    externalSponsored: externalLinks.filter((l) => l.sponsored).length,
    emptyAnchors: links.filter((l) => !l.anchor).length,
    clickHereAnchors: links.filter((l) => l.anchor.toLowerCase().includes("klicka här") || l.anchor.toLowerCase().includes("click here")).length,
    topExternalSamples: externalLinks.slice(0, 15),
    topInternalSamples: internalLinks.slice(0, 15),
    brokenTotal: broken.length,
    brokenSamples: broken.slice(0, 10),
  };
}
