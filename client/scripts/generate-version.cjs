const fs = require("fs");
const path = require("path");

const commitSha =
  process.env.RENDER_GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  process.env.BUILD_ID ||
  "local-dev";

const shortCommitSha =
  commitSha.length >= 7 ? commitSha.substring(0, 7) : commitSha;
const version = process.env.npm_package_version || "1.0.0";

const versionData = {
  status: "ok",
  success: true,
  app: "BookBuddy Frontend Client",
  commitSha,
  shortCommitSha,
  version,
  buildTime: new Date().toISOString(),
  environment: process.env.NODE_ENV || "production",
};

const targetPath = path.join(__dirname, "..", "public", "version.json");
try {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(versionData, null, 2), "utf8");
  console.log(
    "✅ Generated client/public/version.json with SHA:",
    shortCommitSha,
  );
} catch (err) {
  console.error("⚠️ Could not generate version.json:", err.message);
}

// Automatically sync installed pdfjs-dist worker file into public/pdf.worker.min.mjs
try {
  const workerSrc = path.join(
    __dirname,
    "..",
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs",
  );
  const workerDest = path.join(
    __dirname,
    "..",
    "public",
    "pdf.worker.min.mjs",
  );
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
    console.log(
      "✅ Synced installed pdfjs-dist worker (v6.2.108) to client/public/pdf.worker.min.mjs",
    );
  }
} catch (err) {
  console.warn("⚠️ Could not sync pdf.worker.min.mjs:", err.message);
}

