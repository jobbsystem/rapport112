import * as cheerio from "cheerio";

export function analyzeOnPage(html) {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";

  const canonical = $('link[rel="canonical"]').attr("href") || "";
  const lang = $("html").attr("lang") || "";
  const robotsMeta = $('meta[name="robots"]').attr("content") || "";
  const googlebotMeta = $('meta[name="googlebot"]').attr("content") || "";
  const xRobotsTag = $('meta[http-equiv="X-Robots-Tag"]').attr("content") || "";

  const headings = {
    h1: $("h1").map((i, el) => $(el).text().trim()).get(),
    h2: $("h2").map((i, el) => $(el).text().trim()).get(),
    h3: $("h3").map((i, el) => $(el).text().trim()).get(),
    h4: $("h4").map((i, el) => $(el).text().trim()).get(),
    h5: $("h5").map((i, el) => $(el).text().trim()).get(),
    h6: $("h6").map((i, el) => $(el).text().trim()).get(),
  };

  const images = $("img")
    .map((i, el) => {
      const src = (($(el).attr("src") || "") + "").trim();
      const alt = (($(el).attr("alt") || "") + "").trim();
      const loading = (($(el).attr("loading") || "") + "").toLowerCase();
      const width = $(el).attr("width") || "";
      const height = $(el).attr("height") || "";
      return { src, alt, loading, width, height };
    })
    .get();

  const missingAlt = images.filter((img) => !img.alt);
  const missingDimensions = images.filter((img) => !(img.width && img.height));

  const og = {
    title: $('meta[property="og:title"]').attr("content") || "",
    description: $('meta[property="og:description"]').attr("content") || "",
    image: $('meta[property="og:image"]').attr("content") || "",
    url: $('meta[property="og:url"]').attr("content") || "",
    siteName: $('meta[property="og:site_name"]').attr("content") || "",
  };

  const twitter = {
    card: $('meta[name="twitter:card"]').attr("content") || "",
    title: $('meta[name="twitter:title"]').attr("content") || "",
    description: $('meta[name="twitter:description"]').attr("content") || "",
    image: $('meta[name="twitter:image"]').attr("content") || "",
  };

  const hreflang = $('link[rel="alternate"][hreflang]')
    .map((i, el) => ({
      hreflang: ($(el).attr("hreflang") || "").trim(),
      href: ($(el).attr("href") || "").trim(),
    }))
    .get()
    .filter((item) => item.hreflang && item.href);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const headingIssues = {
    multipleH1: headings.h1.length > 1,
    emptyH1: headings.h1.some((t) => !t),
    emptyH2: headings.h2.some((t) => !t),
  };
  const ariaIssues = {
    buttonsMissingLabel: $("button")
      .map((i, el) => {
        const text = $(el).text().trim();
        const hasLabel = $(el).attr("aria-label") || $(el).attr("title") || text;
        return hasLabel ? null : el;
      })
      .get().length,
    inputsMissingLabel: $("input:not([type='hidden']), textarea, select")
      .map((i, el) => {
        const label =
          $(el).attr("aria-label") ||
          $(el).attr("title") ||
          $(el).attr("placeholder") ||
          $(el).attr("name");
        return label ? null : el;
      })
      .get().length,
    tabindexNegative: $('[tabindex="-1"]').length,
  };

  const jsonLdTypes = $('script[type="application/ld+json"]')
    .map((i, el) => {
      try {
        const content = $(el).text();
        const parsed = JSON.parse(content);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        return nodes
          .map((node) => {
            const t = node?.["@type"];
            if (Array.isArray(t)) return t.join(", ");
            return t || "Okänd";
          })
          .filter(Boolean);
      } catch {
        return [];
      }
    })
    .get()
    .flat()
    .filter(Boolean);

  const microdataTypes = $('[itemscope][itemtype]')
    .map((i, el) => ($(el).attr("itemtype") || "").split(/\s+/).filter(Boolean))
    .get()
    .flat()
    .filter(Boolean);

  return {
    title,
    titleLength: title.length,
    metaDescription,
    metaDescriptionLength: metaDescription.length,
    canonical,
    lang,
    robotsMeta,
    googlebotMeta,
    xRobotsTag,
    headings,
    images: {
      total: images.length,
      missingAlt: missingAlt.length,
      missingAltSamples: missingAlt.slice(0, 20),
      lazy: images.filter((img) => img.loading === "lazy").length,
      withDimensions: images.filter((img) => img.width && img.height).length,
      base64: images.filter((img) => img.src.startsWith("data:")).length,
      missingDimensions: missingDimensions.length,
    },
    social: { og, twitter },
    hreflang,
    wordCount,
    headingIssues,
    ariaIssues,
    structuredData: {
      jsonLdTypes,
      microdataTypes,
    },
  };
}
