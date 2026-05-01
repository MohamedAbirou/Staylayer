const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function findSourceFile(urlPath) {
  const pagesDir = path.join(process.cwd(), "pages");
  const tryExts = [".js", ".jsx", ".ts", ".tsx", ".mdx"];

  if (urlPath === "/") {
    for (const ext of tryExts) {
      const f = path.join(pagesDir, `index${ext}`);
      if (fs.existsSync(f)) return f;
    }
  } else {
    const rel = urlPath.replace(/^\//, "");
    for (const ext of tryExts) {
      let f = path.join(pagesDir, rel + ext);
      if (fs.existsSync(f)) return f;
      f = path.join(pagesDir, rel, `index${ext}`);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

function lastGitDateISO(filePath) {
  try {
    return execSync(`git log -1 --format=%cI -- "${filePath}"`, {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function findHtmlFile(urlPath) {
  const outDir = process.env.OUT_DIR || path.join(process.cwd(), "out");
  if (urlPath === "/") {
    return path.join(outDir, "index.html");
  }
  return path.join(outDir, urlPath.replace(/^\//, ""), "index.html");
}

module.exports = {
  siteUrl: `https://${process.env.NEXT_PUBLIC_BRAND_NAME?.toLowerCase()}.com`,
  generateRobotsTxt: true,

  robotsTxtOptions: {
    policies: [{ userAgent: "*", allow: "/" }],
    transformRobotsTxt: async (_, txt) => txt.replace(/^Host:.*\r?\n?/gm, ""),
  },

  exclude: ["/api/*", "/404.html"],
  autoLastmod: false,
  changefreq: "daily",
  priority: 0.7,

  transform: async (config, urlPath) => {
    let lastmod;

    const src = findSourceFile(urlPath);
    if (src) {
      const gitDate = lastGitDateISO(src);
      if (gitDate) lastmod = gitDate;
    }

    if (!lastmod) {
      try {
        const html = findHtmlFile(urlPath);
        const stats = fs.statSync(html);
        lastmod = stats.mtime.toISOString();
      } catch {
        lastmod = new Date().toISOString();
      }
    }

    return {
      loc: urlPath,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod,
    };
  },
};
