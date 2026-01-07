// Hjälpfunktioner (oförändrade men inkluderade för att koden ska fungera direkt)
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderList(items, limit = 10) {
  if (!items || items.length === 0) return "<li class=\"muted\">Inget hittades</li>";
  return items.slice(0, limit).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderHeadingList(headings) {
  const items = [];
  const levels = ["h1", "h2", "h3", "h4", "h5", "h6"];
  levels.forEach((lvl) => {
    const list = headings?.[lvl] || [];
    list.forEach((text) => items.push({ lvl: lvl.toUpperCase(), text }));
  });
  if (!items.length) return '<div class="muted">Inga rubriker</div>';
  return items.map(item => `
    <div class="row-compact">
      <span class="badge-mini">${escapeHtml(item.lvl)}</span>
      <span class="text-truncate">${escapeHtml(item.text)}</span>
    </div>
  `).join("");
}

function renderTags(items) {
  if (!items || items.length === 0) return '<span class="muted">-</span>';
  return items.slice(0, 12).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("");
}

function renderLinkSamples(list, limit = 5) {
   if (!list || list.length === 0) return "<div class=\"muted\">Inga exempel</div>";
   return list.slice(0, limit).map(l => `
     <div class="link-item">
        <div class="link-anchor">${escapeHtml(l.anchor || "Ingen ankartext")}</div>
        <div class="link-href">${escapeHtml(l.href)}</div>
     </div>
   `).join("");
}

function formatMs(value) {
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? value : `${Math.round(value)}ms`;
}

function formatBytes(value) {
  if (value === null || value === undefined) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = value, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function clampScore(v) { return Math.max(0, Math.min(100, Math.round(v))); }

// --- HUVUDFUNKTION ---

export function reportTemplate(data) {
  // 1. Dataförberedelser (Samma logik som förut)
  const generatedAt = new Date().toLocaleDateString('sv-SE') + " " + new Date().toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'});
  
  const screenshotFile = data.screenshotPath ? data.screenshotPath.split(/[/\\\\]/).pop() : "";
  const lighthouse = data.lighthouse || {};
  const metrics = lighthouse.metrics || {};
  const onpage = data.onpage || {};
  const links = data.links || {};
  const tech = data.tech || {};
  const site = data.site || {};
  const navResources = data.navigation?.resources || {};
  
  // Enkla beräkningar för poäng (Samma logik)
  const titleOk = onpage.titleLength >= 30 && onpage.titleLength <= 65;
  const descOk = onpage.metaDescriptionLength >= 50 && onpage.metaDescriptionLength <= 170;
  const headingCount = ["h1", "h2", "h3", "h4", "h5", "h6"].reduce((sum, lvl) => sum + (onpage.headings?.[lvl]?.length || 0), 0);
  
  const onpageScore = clampScore((titleOk?20:5) + (descOk?20:5) + (!!onpage.canonical?15:5) + (!!onpage.lang?10:5) + ((onpage.images?.missingAlt??0)===0?15:5) + (headingCount>6?10:5) + ((lighthouse.scores?.seo||60)/10));
  const linkScore = clampScore(Math.min(60, ((links.total||0)/50)*60) + (links.internal?15:5) + (links.external?10:5));
  const performanceScore = clampScore(lighthouse.scores?.performance || 60);
  const usabilityScore = clampScore(lighthouse.scores?.accessibility || 60);
  const socialScore = clampScore((Object.values(onpage.social?.og||{}).some(Boolean)?50:10) + ((tech.analytics?.length||0)?50:10));
  const brokenLinks = links.brokenTotal || 0;
  const brokenSamples = links.brokenSamples || [];
  const metaRobots = (onpage.robotsMeta || "").toLowerCase();
  const xRobotsTag = (onpage.xRobotsTag || site.robots?.xRobotsHeader || "").toLowerCase();
  const googlebotMeta = (onpage.googlebotMeta || "").toLowerCase();
  const structuredTypes = Array.from(new Set([...(onpage.structuredData?.jsonLdTypes || []), ...(onpage.structuredData?.microdataTypes || [])]));
  const headingIssues = onpage.headingIssues || {};
  const ariaIssues = onpage.ariaIssues || {};
  const imageData = onpage.images || {};
  const cachedCount = navResources.cachedCount || 0;
  const cacheControlMissing = navResources.cacheControlMissing || 0;
  const statusCode = data.status || null;
  const redirectChain = data.redirectChain || site.redirects || [];
  const screenshotMobileFile = data.screenshotMobilePath ? data.screenshotMobilePath.split(/[/\\\\]/).pop() : "";

  const totalScore = Math.round((onpageScore + linkScore + performanceScore + usabilityScore) / 4);

  // Status checks för rendering
  function getStatus(val, type="good") {
    if (type === "good") return val ? "status-ok" : "status-bad";
    if (type === "bad") return val ? "status-bad" : "status-ok";
    return "status-info";
  }

  // --- HTML TEMPLATE ---
  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEO Rapport: ${escapeHtml(data.url)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :root {
      /* Palette från bilden */
      --bg-app: #F2F4F8;
      --card-bg: #FFFFFF;
      --text-dark: #1A1C23;
      --text-muted: #8F95A3;
      --border-light: #F0F2F6;
      
      /* Accenter */
      --accent-orange: #FF5A36;
      --accent-orange-light: #FFF0EB;
      --accent-purple: #5E5CE6;
      --accent-purple-light: #EEEDFC;
      --accent-blue: #3E7BFA;
      --accent-blue-light: #ECF2FF;
      --accent-green: #34C759;
      --accent-green-light: #EBF9EE;
      --accent-red: #FF3B30;
      --accent-red-light: #FFF0EF;

      /* UI */
      --radius-l: 28px;
      --radius-m: 16px;
      --radius-s: 8px;
      --shadow: 0px 8px 24px rgba(149, 157, 165, 0.08);
      --font-main: 'Plus Jakarta Sans', sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      font-family: var(--font-main);
      background-color: var(--bg-app);
      color: var(--text-dark);
      margin: 0;
      padding: 40px 20px;
      line-height: 1.5;
    }

    /* --- LAYOUT GRID (Bento) --- */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      grid-auto-rows: minmax(min-content, max-content);
      gap: 24px;
    }

    /* Grid Spans */
    .col-12 { grid-column: span 12; }
    .col-8 { grid-column: span 8; }
    .col-6 { grid-column: span 6; }
    .col-4 { grid-column: span 4; }
    .col-3 { grid-column: span 3; }

    @media (max-width: 1100px) {
      .col-3 { grid-column: span 6; }
      .col-4 { grid-column: span 6; }
      .col-8 { grid-column: span 12; }
    }
    @media (max-width: 768px) {
      .col-6, .col-4, .col-3 { grid-column: span 12; }
      .container { display: flex; flex-direction: column; }
    }

    /* --- CARDS --- */
    .card {
      background: var(--card-bg);
      border-radius: var(--radius-l);
      padding: 28px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.6);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    h2 { font-size: 18px; font-weight: 700; margin: 0; color: var(--text-dark); }
    h3 { font-size: 14px; font-weight: 600; margin: 0 0 10px 0; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    /* --- TYPOGRAPHY & TAGS --- */
    .display-score {
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1;
      background: linear-gradient(135deg, var(--text-dark) 0%, #555 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .pill {
      display: inline-flex;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      background: var(--bg-app);
      color: var(--text-muted);
      margin-right: 6px; margin-bottom: 6px;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .status-ok { background: var(--accent-green-light); color: var(--accent-green); }
    .status-bad { background: var(--accent-red-light); color: var(--accent-red); }
    .status-info { background: var(--accent-blue-light); color: var(--accent-blue); }

    .muted-text { color: var(--text-muted); font-size: 13px; }

    /* --- COMPONENTS --- */
    /* Custom Progress Bar (Gradient style from image) */
    .progress-group { margin-bottom: 20px; }
    .progress-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: 600; font-size: 14px; }
    
    .progress-track {
      height: 12px;
      background: #F2F4F8;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
    }
    /* De streckade linjerna i bilden simuleras med en repeating gradient */
    .bar-filled {
      height: 100%;
      border-radius: 6px;
      position: relative;
    }
    .bar-orange {
      background: repeating-linear-gradient(90deg, var(--accent-orange), var(--accent-orange) 4px, transparent 4px, transparent 6px);
      opacity: 0.9;
    }
    .bar-purple {
      background: repeating-linear-gradient(90deg, var(--accent-purple), var(--accent-purple) 4px, transparent 4px, transparent 6px);
      opacity: 0.9;
    }
    .bar-blue {
      background: repeating-linear-gradient(90deg, var(--accent-blue), var(--accent-blue) 4px, transparent 4px, transparent 6px);
      opacity: 0.9;
    }

    /* List Rows */
    .data-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px dashed var(--border-light);
    }
    .data-row:last-child { border-bottom: none; }
    .row-label { font-weight: 600; color: var(--text-dark); font-size: 14px; }
    .row-value { font-family: monospace; color: var(--text-muted); }

    /* Heading List items */
    .row-compact {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      font-size: 13px;
    }
    .badge-mini {
      background: var(--bg-app);
      color: var(--text-muted);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 10px;
      min-width: 24px;
      text-align: center;
    }
    .text-truncate {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Link samples */
    .link-item {
      background: #FAFAFC;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .link-anchor { font-weight: 700; margin-bottom: 2px; }
    .link-href { color: var(--accent-blue); word-break: break-all; }

    /* Screenshot Frame */
    .device-mockup {
      background: #fff;
      border: 6px solid #F2F4F8;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .device-mockup img { display: block; width: 100%; height: auto; }

    /* Specific Cards Styling */
    .card-highlight {
      background: linear-gradient(135deg, #FFFFFF 0%, #F8F9FF 100%);
    }

    .flex-center { display: flex; align-items: center; justify-content: center; height: 100%; }

    /* Floating Circle Graph (CSS only implementation of the round charts in image) */
    .circle-chart {
      width: 120px; height: 120px;
      border-radius: 50%;
      background: conic-gradient(var(--c) calc(var(--p)*1%), #F2F4F8 0);
      display: grid;
      place-items: center;
      position: relative;
    }
    .circle-chart::before {
      content: ""; position: absolute; inset: 15px; background: #fff; border-radius: 50%;
    }
    .circle-value { position: relative; font-size: 24px; font-weight: 800; z-index: 1; }

  </style>
</head>
<body>

  <div class="container">
    
    <div class="card col-12 card-highlight" style="flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
      <div>
        <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 8px;">
          <span class="status-badge status-info">Rapport Genererad</span>
          <span class="muted-text">${generatedAt}</span>
        </div>
        <h1 style="font-size: 32px; font-weight: 800; margin: 0; letter-spacing:-1px;">${escapeHtml(data.url)}</h1>
        <div class="muted-text" style="margin-top: 6px;">Slutlig URL: ${escapeHtml(data.finalUrl)}</div>
      </div>
      
      <div style="display: flex; gap: 40px; align-items: center;">
        <div style="text-align: right;">
          <div class="display-score">${totalScore}</div>
          <div style="font-weight: 700; color: var(--text-muted); font-size: 14px;">Total Score</div>
        </div>
        <div style="width: 1px; height: 60px; background: var(--border-light);"></div>
        <div style="text-align: right;">
           <div style="font-size: 24px; font-weight: 700;">${lighthouse.scores?.performance || 0}</div>
           <div class="muted-text">Performance</div>
        </div>
        <div style="text-align: right;">
           <div style="font-size: 24px; font-weight: 700;">${lighthouse.scores?.seo || 0}</div>
           <div class="muted-text">SEO</div>
        </div>
      </div>
    </div>

    <div class="card col-8">
      <div class="card-header">
        <h2>SEO Analys</h2>
        <span class="status-badge ${onpageScore > 80 ? 'status-ok' : 'status-info'}">On-Page Score: ${onpageScore}</span>
      </div>

      <div class="progress-group">
        <div class="progress-label">
          <span>Titellängd (${onpage.titleLength})</span>
          <span>${titleOk ? 'Bra' : 'Justera'}</span>
        </div>
        <div class="progress-track">
          <div class="bar-filled bar-orange" style="width: ${Math.min(100, (onpage.titleLength/65)*100)}%"></div>
        </div>
      </div>

      <div class="progress-group">
        <div class="progress-label">
          <span>Meta Beskrivning (${onpage.metaDescriptionLength})</span>
          <span>${descOk ? 'Bra' : 'Justera'}</span>
        </div>
        <div class="progress-track">
          <div class="bar-filled bar-purple" style="width: ${Math.min(100, (onpage.metaDescriptionLength/160)*100)}%"></div>
        </div>
      </div>

      <div class="progress-group">
        <div class="progress-label">
          <span>Länkar Totalt (${links.total || 0})</span>
          <span>${links.total} st</span>
        </div>
        <div class="progress-track">
          <div class="bar-filled bar-blue" style="width: ${Math.min(100, (links.total/100)*100)}%"></div>
        </div>
      </div>

      <div style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h3>Rubrikstruktur</h3>
          ${renderHeadingList(onpage.headings)}
        </div>
        <div>
           <h3>Viktiga Taggar</h3>
           ${renderTags((onpage.hreflang || []).map(h => h.hreflang))}
           ${renderTags(tech.detected || [])}
        </div>
      </div>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Lighthouse Metrics</h2>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: #FAFAFC; padding: 16px; border-radius: 16px;">
          <div class="muted-text">LCP</div>
          <div style="font-weight: 800; font-size: 20px;">${formatMs(metrics.largestContentfulPaint)}</div>
        </div>
        <div style="background: #FAFAFC; padding: 16px; border-radius: 16px;">
          <div class="muted-text">FCP</div>
          <div style="font-weight: 800; font-size: 20px;">${formatMs(metrics.firstContentfulPaint)}</div>
        </div>
        <div style="background: #FAFAFC; padding: 16px; border-radius: 16px;">
          <div class="muted-text">CLS</div>
          <div style="font-weight: 800; font-size: 20px;">${metrics.cumulativeLayoutShift || 0}</div>
        </div>
        <div style="background: #FAFAFC; padding: 16px; border-radius: 16px;">
          <div class="muted-text">TBT</div>
          <div style="font-weight: 800; font-size: 20px;">${formatMs(metrics.totalBlockingTime)}</div>
        </div>
      </div>
      
      <div style="margin-top: 24px;">
        <h3>Skärmdump</h3>
        <div class="device-mockup">
           ${screenshotFile 
             ? `<img src="${escapeHtml(screenshotFile)}" alt="Desktop">` 
             : '<div style="padding:40px; text-align:center; color:#ccc;">Ingen bild</div>'
           }
        </div>
      </div>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Länkstatus</h2>
        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--accent-orange-light); color: var(--accent-orange); display:flex; align-items:center; justify-content:center; font-weight:700;">
          ${brokenLinks}
        </div>
      </div>
      <div class="data-row"><span class="row-label">Interna</span> <span class="row-value">${links.internal||0}</span></div>
      <div class="data-row"><span class="row-label">Externa</span> <span class="row-value">${links.external||0}</span></div>
      <div class="data-row"><span class="row-label">Nofollow</span> <span class="row-value">${links.externalNofollow||0}</span></div>
      
      <h3 style="margin-top: 20px;">Brutna Länkar</h3>
      <ul>
        ${(links.brokenSamples || []).slice(0,3).map(l => `
          <li style="font-size:12px; margin-bottom:4px; color: var(--accent-red);">
            ${escapeHtml(l.href)} (${l.status})
          </li>`).join("") || '<li class="muted-text">Inga brutna länkar funna.</li>'
        }
      </ul>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Teknik & Resurser</h2>
      </div>
      <div class="data-row">
        <span class="row-label">Resurser</span>
        <span class="pill">${navResources.requests||0} st</span>
      </div>
      <div class="data-row">
        <span class="row-label">Sidvikt</span>
        <span class="pill">${formatBytes(navResources.totalBytes)}</span>
      </div>
      <div class="data-row">
        <span class="row-label">Server</span>
        <span class="row-value">${escapeHtml(tech.server || "-")}</span>
      </div>
      <div class="data-row">
        <span class="row-label">CMS</span>
        <span class="status-badge status-info">${escapeHtml(tech.cms || "Okänd")}</span>
      </div>
      <div style="margin-top: 16px;">
        <h3>Säkerhet</h3>
        <div style="display:flex; gap: 8px; flex-wrap: wrap;">
           <span class="status-badge ${site.securityHeaders?.contentSecurityPolicy ? 'status-ok':'status-bad'}">CSP</span>
           <span class="status-badge ${site.securityHeaders?.strictTransportSecurity ? 'status-ok':'status-bad'}">HSTS</span>
           <span class="status-badge ${site.securityHeaders?.xContentTypeOptions ? 'status-ok':'status-bad'}">Sniffing</span>
        </div>
      </div>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Hälsa & Problem</h2>
      </div>
      
      <div class="data-row">
        <span class="row-label">Canonical</span>
        <span class="status-badge ${onpage.canonical ? 'status-ok' : 'status-bad'}">${onpage.canonical ? 'OK' : 'Saknas'}</span>
      </div>
      <div class="data-row">
        <span class="row-label">Robots.txt</span>
        <span class="status-badge ${site.robots?.allowsUrl === false ? 'status-bad' : 'status-ok'}">${site.robots?.allowsUrl === false ? 'Block' : 'OK'}</span>
      </div>
      <div class="data-row">
        <span class="row-label">Alt-texter</span>
        <span class="status-badge ${(onpage.images?.missingAlt || 0) > 0 ? 'status-bad' : 'status-ok'}">${onpage.images?.missingAlt || 0} saknas</span>
      </div>
      <div class="data-row">
        <span class="row-label">Blandat innehåll</span>
        <span class="status-badge ${(navResources.mixedContentCount || 0) > 0 ? 'status-bad' : 'status-ok'}">${navResources.mixedContentCount || 0} st</span>
      </div>
      
      <h3 style="margin-top: 20px;">Lighthouse Varningar</h3>
      <ul style="padding-left: 20px; font-size: 12px; color: var(--text-muted);">
        ${renderList(lighthouse.warnings, 3)}
      </ul>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Indexering</h2>
      </div>
      <div class="data-row"><span class="row-label">Meta robots</span><span class="row-value">${metaRobots || "saknas"}</span></div>
      <div class="data-row"><span class="row-label">X-Robots-Tag</span><span class="row-value">${xRobotsTag || "saknas"}</span></div>
      <div class="data-row"><span class="row-label">Googlebot</span><span class="row-value">${googlebotMeta || "saknas"}</span></div>
      <div class="data-row"><span class="row-label">Sitemap</span><span class="row-value">${(site.sitemap?.urls||[])[0] || "saknas"}</span></div>
      <div class="data-row"><span class="row-label">Hreflang</span><span class="row-value">${(onpage.hreflang||[]).length} st</span></div>
      <div class="data-row"><span class="row-label">Robots allow</span><span class="row-value">${site.robots?.allowsUrl === false ? "Blockerad" : "OK"}</span></div>
      <h3 style="margin-top:16px;">Hreflang-detaljer</h3>
      <ul style="padding-left:20px; color: var(--text-muted); font-size: 12px;">${renderList((onpage.hreflang||[]).map(h=>`${h.hreflang} → ${h.href}`),6)}</ul>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Bilder & A11y</h2>
      </div>
      <div class="data-row"><span class="row-label">Bilder utan alt</span><span class="row-value">${imageData.missingAlt||0}</span></div>
      <div class="data-row"><span class="row-label">Med dimensioner</span><span class="row-value">${imageData.withDimensions||0} / ${imageData.total||0}</span></div>
      <div class="data-row"><span class="row-label">Lazy-loading</span><span class="row-value">${imageData.lazy||0}</span></div>
      <div class="data-row"><span class="row-label">Base64-bilder</span><span class="row-value">${imageData.base64||0}</span></div>
      <div class="data-row"><span class="row-label">Saknar width/height</span><span class="row-value">${imageData.missingDimensions||0}</span></div>
      <h3 style="margin-top:16px;">A11y snabbkoll</h3>
      <ul style="padding-left:20px; color: var(--text-muted); font-size: 12px;">
        <li>${ariaIssues.buttonsMissingLabel||0} knappar saknar label</li>
        <li>${ariaIssues.inputsMissingLabel||0} inputs/fields saknar label</li>
        <li>${ariaIssues.tabindexNegative||0} element med tabindex=-1</li>
      </ul>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Redirect/Status</h2>
      </div>
      <div class="data-row"><span class="row-label">HTTP status</span><span class="row-value">${statusCode || "okänd"}</span></div>
      <div class="data-row"><span class="row-label">Redirect-steg</span><span class="row-value">${redirectChain.length}</span></div>
      <div class="data-row"><span class="row-label">Cached</span><span class="row-value">${cachedCount} st</span></div>
      <div class="data-row"><span class="row-label">Saknar cache-control</span><span class="row-value">${cacheControlMissing}</span></div>
      <div class="data-row"><span class="row-label">Blandat innehåll</span><span class="row-value">${navResources.mixedContentCount||0}</span></div>
      <h3 style="margin-top:16px;">Kedja</h3>
      <ul style="padding-left:20px; color: var(--text-muted); font-size: 12px;">${renderList((redirectChain||[]).map(r=>`${r.method||"GET"} ${r.url}${r.status?` (${r.status})`:``}`),6)}</ul>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Structured Data</h2>
      </div>
      <div class="data-row"><span class="row-label">Typer</span><span class="row-value">${structuredTypes.length ? structuredTypes.join(", ") : "Inget hittat"}</span></div>
      <div class="data-row"><span class="row-label">JSON-LD</span><span class="row-value">${(onpage.structuredData?.jsonLdTypes||[]).length}</span></div>
      <div class="data-row"><span class="row-label">Microdata</span><span class="row-value">${(onpage.structuredData?.microdataTypes||[]).length}</span></div>
    </div>

    <div class="card col-4">
      <div class="card-header">
        <h2>Mobil vy</h2>
      </div>
      <div class="device-mockup">
        ${
          screenshotMobileFile
            ? `<img src="${escapeHtml(screenshotMobileFile)}" alt="Mobil">`
            : '<div style="padding:40px; text-align:center; color:#ccc;">Ingen mobilbild</div>'
        }
      </div>
    </div>

  </div>

</body>
</html>
  `;
}
