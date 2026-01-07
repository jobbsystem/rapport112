import fetch from "node-fetch";

function headerLookup(headers, key) {
  if (!headers) return "";
  return headers.get ? headers.get(key) || "" : headers[key] || "";
}

function normalizePath(pathname) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export async function analyzeSite(url, mainHeaders = {}) {
  const target = new URL(url);
  const origin = target.origin;
  const redirects = [];
  const xRobotsHeader = headerLookup(mainHeaders, "x-robots-tag") || "";

  const robotsUrl = `${origin}/robots.txt`;
  let robotsStatus = null;
  let robotsAllowsUrl = true;
  let disallows = [];
  let sitemapUrls = [];
  let robotsError = "";

  try {
    const res = await fetch(robotsUrl, { redirect: "follow" });
      robotsStatus = res.status;
      redirects.push({ url: robotsUrl, status: res.status });
      if (res.ok) {
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      let applies = false;
      lines.forEach((line) => {
        const trimmed = line.trim();
        const lower = trimmed.toLowerCase();
        if (lower.startsWith("user-agent:")) {
          const ua = trimmed.slice(11).trim();
          applies = ua === "*" || ua === "";
        }
        if (applies && lower.startsWith("disallow:")) {
          const rule = trimmed.split(":")[1]?.trim() || "";
          if (rule) disallows.push(normalizePath(rule));
        }
        if (applies && lower.startsWith("sitemap:")) {
          const url = trimmed.split(":")[1]?.trim() || "";
          if (url) sitemapUrls.push(url);
        }
      });
      const path = normalizePath(target.pathname);
      robotsAllowsUrl = !disallows.some((rule) => rule === "/" || path.startsWith(rule));
    }
  } catch (err) {
    robotsError = err.message;
  }

  let defaultSitemapFound = false;
  if (!sitemapUrls.length) {
    const defaultSitemap = `${origin}/sitemap.xml`;
    try {
      const res = await fetch(defaultSitemap, { method: "HEAD", redirect: "follow" });
      if (res.ok) {
        sitemapUrls.push(defaultSitemap);
        defaultSitemapFound = true;
        redirects.push({ url: defaultSitemap, status: res.status });
      }
    } catch {
      // ignore
    }
  }

  const securityHeaders = {
    contentSecurityPolicy: headerLookup(mainHeaders, "content-security-policy"),
    strictTransportSecurity: headerLookup(mainHeaders, "strict-transport-security"),
    xContentTypeOptions: headerLookup(mainHeaders, "x-content-type-options"),
    xFrameOptions: headerLookup(mainHeaders, "x-frame-options"),
    referrerPolicy: headerLookup(mainHeaders, "referrer-policy"),
    permissionsPolicy: headerLookup(mainHeaders, "permissions-policy") || headerLookup(mainHeaders, "feature-policy"),
  };

  return {
    redirects,
    robots: {
      url: robotsUrl,
      status: robotsStatus,
      allowsUrl: robotsAllowsUrl,
      disallowCount: disallows.length,
      error: robotsError,
      xRobotsHeader,
    },
    sitemap: {
      urls: sitemapUrls,
      defaultSitemapFound,
    },
    securityHeaders,
  };
}
