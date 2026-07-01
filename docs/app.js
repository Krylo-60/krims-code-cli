// KRIMS CODE CLI — RELEASE HUB — FULLY FUNCTIONAL LIVE DATA ENGINE
// Fetches real releases from GitHub API, npm registry, and PyPI

const GITHUB_REPO = "Krylo-60/aether-ai-cli";
const NPM_PACKAGE = "@krishivpb60/krims-code-cli";
const PYPI_PACKAGE = "aether-ai-agent-cli";

// ══════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════
let RELEASES = [];
let activeVersion = null;

// ══════════════════════════════════════════════════════
//  Data Fetching — GitHub Releases API
// ══════════════════════════════════════════════════════
async function fetchGitHubReleases() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=50`, {
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("GitHub fetch failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════
//  Data Fetching — npm Registry
// ══════════════════════════════════════════════════════
async function fetchNpmData() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}`);
    if (!res.ok) throw new Error(`npm API ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("npm fetch failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════
//  Data Fetching — PyPI
// ══════════════════════════════════════════════════════
async function fetchPyPIData() {
  try {
    const res = await fetch(`https://pypi.org/pypi/${PYPI_PACKAGE}/json`);
    if (!res.ok) throw new Error(`PyPI API ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("PyPI fetch failed:", err);
    return null;
  }
}

// ══════════════════════════════════════════════════════
//  Markdown → HTML (lightweight converter)
// ══════════════════════════════════════════════════════
function markdownToHtml(md) {
  if (!md) return "";
  let html = md
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, "").replace(/```/g, "");
      return `<pre class="md-code-block"><code>${escapeHtml(code.trim())}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="highlight-item">$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="md-link">$1</a>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li class="highlight-item">.*?<\/li>\s*(?:<br>)?)+)/g, (match) => {
    const cleaned = match.replace(/<br>/g, "");
    return `<ul class="highlights-list">${cleaned}</ul>`;
  });

  return `<p>${html}</p>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ══════════════════════════════════════════════════════
//  Parse GitHub release into normalized format
// ══════════════════════════════════════════════════════
function parseGitHubRelease(ghRelease, npmVersions, pypiVersions) {
  const version = ghRelease.tag_name;
  const cleanVer = version.replace(/^v/, "");
  const date = new Date(ghRelease.published_at || ghRelease.created_at);
  const dateStr = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Build badges dynamically based on what registries actually have this version
  const badges = [];
  if (npmVersions.has(cleanVer)) badges.push(`NPM: ${cleanVer}`);
  if (pypiVersions.has(cleanVer)) badges.push(`PyPI: ${cleanVer}`);
  badges.push("GitHub");

  // Extract summary from first paragraph of release body
  const bodyLines = (ghRelease.body || "").split("\n").filter(l => l.trim());
  const summary = bodyLines[0] || ghRelease.name || `Release ${version}`;

  // Parse highlights from markdown list items
  const highlights = [];
  const listItemRegex = /^[-*]\s+(.+)$/gm;
  let match;
  while ((match = listItemRegex.exec(ghRelease.body || "")) !== null) {
    highlights.push(match[1]);
  }
  if (highlights.length === 0 && ghRelease.body) {
    // If no list items, use body paragraphs as highlights
    bodyLines.slice(0, 5).forEach(line => {
      const cleaned = line.replace(/^#+\s*/, "").trim();
      if (cleaned) highlights.push(cleaned);
    });
  }

  // Parse features from ### headers
  const features = [];
  const sectionRegex = /^###\s+(.+)$/gm;
  while ((match = sectionRegex.exec(ghRelease.body || "")) !== null) {
    features.push({ title: match[1], desc: "" });
  }

  // Download assets
  const assets = (ghRelease.assets || []).map(a => ({
    name: a.name,
    size: a.size,
    downloadUrl: a.browser_download_url,
    downloadCount: a.download_count
  }));

  return {
    version,
    cleanVer,
    date: dateStr,
    dateObj: date,
    summary,
    badges,
    highlights,
    features,
    assets,
    body: ghRelease.body || "",
    htmlUrl: ghRelease.html_url,
    prerelease: ghRelease.prerelease,
    author: ghRelease.author ? ghRelease.author.login : "unknown"
  };
}

// ══════════════════════════════════════════════════════
//  Render version timeline sidebar
// ══════════════════════════════════════════════════════
function renderTimeline(list) {
  const container = document.getElementById("version-timeline");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<li class="timeline-empty">No versions match search</li>`;
    return;
  }

  list.forEach((rel, index) => {
    const li = document.createElement("li");
    li.className = `timeline-item ${rel.version === activeVersion ? "active" : ""}`;
    li.onclick = () => selectVersion(rel.version);
    li.style.animationDelay = `${index * 40}ms`;
    li.classList.add("timeline-animate-in");

    const prerelaseTag = rel.prerelease ? `<span class="prerelease-tag">PRE</span>` : "";

    li.innerHTML = `
      <span class="timeline-node"></span>
      <div class="timeline-content">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="timeline-version">${rel.version}</span>
          ${prerelaseTag}
        </div>
        <span class="timeline-date">${rel.date}</span>
      </div>
    `;
    container.appendChild(li);
  });
}

// ══════════════════════════════════════════════════════
//  Select a version and render its detail card
// ══════════════════════════════════════════════════════
function selectVersion(ver) {
  activeVersion = ver;

  // Re-render timeline to update active class
  filterVersions();

  const rel = RELEASES.find(r => r.version === ver);
  const detailCard = document.getElementById("release-detail-card");

  if (!rel) return;

  // Render Badges
  const badgesHtml = rel.badges.map(b => {
    let typeClass = "badge-github";
    if (b.toLowerCase().includes("npm")) typeClass = "badge-npm";
    if (b.toLowerCase().includes("pypi")) typeClass = "badge-pypi";
    return `<span class="release-badge ${typeClass}">${b}</span>`;
  }).join("");

  // Render download assets
  let assetsHtml = "";
  if (rel.assets && rel.assets.length > 0) {
    assetsHtml = `
      <div class="detail-highlights">
        <span class="highlights-title">DOWNLOAD ASSETS</span>
        <div class="assets-grid">
          ${rel.assets.map(a => `
            <a href="${a.downloadUrl}" class="asset-card" download>
              <div class="asset-icon">📦</div>
              <div class="asset-info">
                <span class="asset-name">${a.name}</span>
                <span class="asset-meta">${formatBytes(a.size)} · ${a.downloadCount.toLocaleString()} downloads</span>
              </div>
              <div class="asset-download-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </div>
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  // Render install commands
  const installHtml = `
    <div class="version-install-boxes">
      <div class="install-box">
        <span class="install-label">INSTALL FROM NPM</span>
        <div class="copy-field">
          <code>npm install -g @krishivpb60/krims-code-cli@${rel.cleanVer}</code>
          <button class="copy-btn" onclick="copyText('npm install -g @krishivpb60/krims-code-cli@${rel.cleanVer}', this)">COPY</button>
        </div>
      </div>
      <div class="install-box">
        <span class="install-label">INSTALL FROM PYPI</span>
        <div class="copy-field">
          <code>pip install aether-ai-agent-cli==${rel.cleanVer}</code>
          <button class="copy-btn" onclick="copyText('pip install aether-ai-agent-cli==${rel.cleanVer}', this)">COPY</button>
        </div>
      </div>
    </div>
  `;

  // Render release body as parsed markdown
  const bodyHtml = markdownToHtml(rel.body);

  detailCard.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-area">
        <span class="detail-version">${rel.version}</span>
        <span class="detail-date">RELEASED ON: ${rel.date}${rel.prerelease ? " · PRE-RELEASE" : ""}</span>
        <span class="detail-author">by <a href="https://github.com/${rel.author}" target="_blank" class="md-link">@${rel.author}</a></span>
      </div>
      <div class="badges-row">
        ${badgesHtml}
        <a href="${rel.htmlUrl}" target="_blank" class="release-badge badge-view-github" title="View on GitHub">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          View on GitHub
        </a>
      </div>
    </div>
    
    ${installHtml}

    ${assetsHtml}
    
    <div class="detail-body-section">
      <span class="highlights-title">RELEASE NOTES</span>
      <div class="release-body-content">
        ${bodyHtml}
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
//  Filter versions based on search input
// ══════════════════════════════════════════════════════
function filterVersions() {
  const query = document.getElementById("version-search").value.toLowerCase();

  const filtered = RELEASES.filter(rel => {
    return (
      rel.version.toLowerCase().includes(query) ||
      rel.summary.toLowerCase().includes(query) ||
      rel.body.toLowerCase().includes(query) ||
      rel.badges.some(b => b.toLowerCase().includes(query))
    );
  });

  renderTimeline(filtered);
}

// ══════════════════════════════════════════════════════
//  Helper: Copy to clipboard with feedback
// ══════════════════════════════════════════════════════
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = "<span>COPIED!</span>";
    btn.style.background = "var(--google-green)";
    btn.style.color = "#ffffff";

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = "";
      btn.style.color = "";
    }, 2000);
  }).catch(() => {
    // Fallback for insecure contexts
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    const originalText = btn.innerHTML;
    btn.innerHTML = "<span>COPIED!</span>";
    btn.style.background = "var(--google-green)";
    btn.style.color = "#ffffff";
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = "";
      btn.style.color = "";
    }, 2000);
  });
}

// ══════════════════════════════════════════════════════
//  Helper: Format bytes
// ══════════════════════════════════════════════════════
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
}

// ══════════════════════════════════════════════════════
//  Helper: Relative time
// ══════════════════════════════════════════════════════
function relativeTime(dateObj) {
  const now = new Date();
  const diff = now - dateObj;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months} month${months > 1 ? "s" : ""} ago`;
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}

// ══════════════════════════════════════════════════════
//  Bootstrap: Load everything on page load
// ══════════════════════════════════════════════════════
async function bootstrap() {
  const detailCard = document.getElementById("release-detail-card");
  detailCard.innerHTML = `
    <div class="loader-container">
      <span class="hud-loader"></span>
      <p>Fetching live release data from GitHub, npm & PyPI...</p>
    </div>
  `;

  // Fetch all data sources in parallel
  const [ghReleases, npmData, pypiData] = await Promise.all([
    fetchGitHubReleases(),
    fetchNpmData(),
    fetchPyPIData()
  ]);

  // Build lookup sets for which versions exist on npm and pypi
  const npmVersions = new Set();
  if (npmData && npmData.versions) {
    Object.keys(npmData.versions).forEach(v => npmVersions.add(v));
  }

  const pypiVersions = new Set();
  if (pypiData && pypiData.releases) {
    Object.keys(pypiData.releases).forEach(v => pypiVersions.add(v));
  }

  if (ghReleases && ghReleases.length > 0) {
    // Parse all GitHub releases into our normalized format
    RELEASES = ghReleases
      .filter(r => !r.draft)
      .map(r => parseGitHubRelease(r, npmVersions, pypiVersions))
      .sort((a, b) => b.dateObj - a.dateObj);

    activeVersion = RELEASES[0].version;

    // Update stats panel with live data
    document.getElementById("stat-latest-version").textContent = RELEASES[0].version;
    document.getElementById("stat-total-releases").textContent = RELEASES.length;

    // Update footer version
    const footerVersion = document.querySelector(".hud-footer .footer-left");
    if (footerVersion) {
      footerVersion.innerHTML = `
        <span>STATION STATE: <span class="text-green">ONLINE</span></span>
        <span class="footer-divider">|</span>
        <span>VERSION HUB ${RELEASES[0].version} · Last updated ${relativeTime(RELEASES[0].dateObj)}</span>
      `;
    }

    // Render
    renderTimeline(RELEASES);
    selectVersion(RELEASES[0].version);
  } else {
    // Fallback: show error state
    detailCard.innerHTML = `
      <div class="loader-container" style="color: var(--google-red);">
        <p>⚠️ Failed to fetch release data from GitHub API.</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">
          This may be due to rate limiting. Try refreshing in a minute.<br/>
          <a href="https://github.com/${GITHUB_REPO}/releases" target="_blank" style="color: var(--google-blue);">
            View releases directly on GitHub →
          </a>
        </p>
      </div>
    `;
  }
}

// Launch
bootstrap();
