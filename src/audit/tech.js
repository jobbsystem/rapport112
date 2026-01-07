import fetch from "node-fetch";
import * as cheerio from "cheerio";

function headerLookup(headers, key) {
  return headers?.get ? headers.get(key) || "" : headers?.[key] || "";
}

function keywordMatch(html, patterns) {
  return patterns.some((pattern) => pattern.test(html));
}

function detectCms(html, generatorMeta) {
  const lowerGen = (generatorMeta || "").toLowerCase();
  if (lowerGen.includes("wordpress")) return "WordPress";
  if (lowerGen.includes("shopify")) return "Shopify";
  if (lowerGen.includes("joomla")) return "Joomla";
  if (lowerGen.includes("drupal")) return "Drupal";

  const lowerHtml = (html || "").toLowerCase();
  if (lowerHtml.includes("wp-content")) return "WordPress";
  if (lowerHtml.includes("shopify.theme")) return "Shopify";
  if (lowerHtml.includes("cdn.shopify.com")) return "Shopify";
  if (lowerHtml.includes("drupal.settings")) return "Drupal";
  if (lowerHtml.includes("wp-json")) return "WordPress";
  return "";
}

function detectFrameworks(html) {
  const lower = (html || "").toLowerCase();
  const frameworks = [];

  if (keywordMatch(lower, [/__next_data__/, /next-route-announcer/])) {
    frameworks.push("Next.js");
  }
  if (keywordMatch(lower, [/reactdom/, /data-reactroot/, /id="root"/])) {
    frameworks.push("React");
  }
  if (keywordMatch(lower, [/vue-cli-service/, / data-v-[0-9a-f]+/])) {
    frameworks.push("Vue.js");
  }
  if (keywordMatch(lower, [/sveltekit/, /svelte-/])) {
    frameworks.push("Svelte");
  }
  if (keywordMatch(lower, [/nuxt\.config/, /nuxt-link/])) {
    frameworks.push("Nuxt.js");
  }
  if (keywordMatch(lower, [/gatsby/])) {
    frameworks.push("Gatsby");
  }

  return Array.from(new Set(frameworks));
}

function detectUiLibraries(html) {
  const lower = (html || "").toLowerCase();
  const libs = [];

  if (keywordMatch(lower, [/bootstrap(\.min)?\.css/, /bootstrap/])) {
    libs.push("Bootstrap");
  }
  if (keywordMatch(lower, [/tailwind(\.min)?\.css/, /tailwind/])) {
    libs.push("Tailwind CSS");
  }
  if (keywordMatch(lower, [/fontawesome/, /font-awesome/])) {
    libs.push("Font Awesome");
  }
  return Array.from(new Set(libs));
}

function detectAnalytics(html) {
  const lower = (html || "").toLowerCase();
  const analytics = [];

  if (keywordMatch(lower, [/gtag\(.+ga4/, /googletagmanager\.com/, /google-analytics\.com/])) {
    analytics.push("Google Analytics / GTM");
  }
  if (keywordMatch(lower, [/metrik.*yandex/, /mc\.yandex/])) {
    analytics.push("Yandex Metrica");
  }
  if (keywordMatch(lower, [/plausible\.io/])) {
    analytics.push("Plausible");
  }
  if (keywordMatch(lower, [/matomo/])) {
    analytics.push("Matomo");
  }

  return Array.from(new Set(analytics));
}

export async function detectTech(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();
    const headers = response.headers;

    const $ = cheerio.load(body);
    const generator = $('meta[name="generator"]').attr("content") || "";
    const server = headerLookup(headers, "server");
    const poweredBy = headerLookup(headers, "x-powered-by");
    const cms = detectCms(body, generator);
    const frameworks = detectFrameworks(body);
    const uiLibraries = detectUiLibraries(body);
    const analytics = detectAnalytics(body);

    const scripts = $("script[src]")
      .map((i, el) => ($(el).attr("src") || "").trim())
      .get()
      .filter(Boolean)
      .slice(0, 25);

    const stylesheets = $('link[rel="stylesheet"][href]')
      .map((i, el) => ($(el).attr("href") || "").trim())
      .get()
      .filter(Boolean)
      .slice(0, 25);

    const cdn = [];
    if (scripts.concat(stylesheets).some((src) => src.includes("cloudflare"))) {
      cdn.push("Cloudflare");
    }
    if (scripts.concat(stylesheets).some((src) => src.includes("stackpath"))) {
      cdn.push("StackPath / CDN");
    }

    const detected = Array.from(new Set([cms, ...frameworks, ...uiLibraries, ...analytics].filter(Boolean)));

    return {
      server,
      poweredBy,
      cms,
      frameworks,
      uiLibraries,
      analytics,
      cdn,
      scripts,
      stylesheets,
      detected,
      securityHeaders: {
        contentSecurityPolicy: headerLookup(headers, "content-security-policy"),
        strictTransportSecurity: headerLookup(headers, "strict-transport-security"),
        xContentTypeOptions: headerLookup(headers, "x-content-type-options"),
        xFrameOptions: headerLookup(headers, "x-frame-options"),
        referrerPolicy: headerLookup(headers, "referrer-policy"),
        permissionsPolicy: headerLookup(headers, "permissions-policy") || headerLookup(headers, "feature-policy"),
      },
    };
  } catch (err) {
    return { error: err.message };
  }
}
