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

// Build-Time Environment Variable Validation
const apiUrl = process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || "/api/v1";
if (apiUrl.startsWith("http://") && process.env.NODE_ENV === "production" && !apiUrl.includes("localhost")) {
  console.warn("⚠️ Warning: Production VITE_API_URL is using insecure http:// protocol instead of https://");
}
if (!apiUrl.startsWith("/") && !apiUrl.startsWith("http://") && !apiUrl.startsWith("https://")) {
  throw new Error(`Build Error: Invalid VITE_API_URL specified: "${apiUrl}". Must be relative or absolute http(s) URL.`);
}

// Ensure no secrets leaked into VITE_ prefixed environment variables
Object.keys(process.env).forEach((key) => {
  if (key.startsWith("VITE_")) {
    const val = process.env[key] || "";
    if (/mongodb(\+srv)?:\/\/|bearer |secret_key|private_key/i.test(val)) {
      throw new Error(`Build Security Error: Potentially sensitive secret detected in frontend environment variable ${key}!`);
    }
  }
});
console.log("✅ Build-time environment variable validation passed. Base API:", apiUrl);

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
  const workerDest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");
  if (fs.existsSync(workerSrc)) {
    fs.copyFileSync(workerSrc, workerDest);
    console.log(
      "✅ Synced installed pdfjs-dist worker (v6.2.108) to client/public/pdf.worker.min.mjs",
    );
  }
} catch (err) {
  console.warn("⚠️ Could not sync pdf.worker.min.mjs:", err.message);
}
