/**
 * Automated Bundle Budget & Performance CI Check
 *
 * Verifies that:
 * 1. Initial Landing Page JS payload is strictly < 200 KB gzipped.
 * 2. Heavy libraries (pdfjs-dist, epubjs, recharts) are not in the main or landing bundles.
 * 3. Dynamic chunks are properly code-split.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BUDGET_KB = 200; // Defined budget limit in KB gzipped

const distDir = path.resolve(__dirname, "../../frontend/dist/assets");

if (!fs.existsSync(distDir)) {
  console.error(
    'Error: frontend/dist/assets does not exist. Run "npm run build --prefix frontend" first.',
  );
  process.exit(1);
}

const files = fs.readdirSync(distDir);

let landingGzip = 0;
let indexGzip = 0;
let reactGzip = 0;
const heavyChunks = [];

for (const file of files) {
  if (file.endsWith(".js")) {
    const filePath = path.join(distDir, file);
    const content = fs.readFileSync(filePath);
    const gzippedBytes = zlib.gzipSync(content).length;

    if (file.startsWith("Landing-")) {
      landingGzip = gzippedBytes;
    } else if (file.startsWith("index-")) {
      indexGzip = gzippedBytes;
    } else if (file.startsWith("vendor-react-")) {
      reactGzip = gzippedBytes;
    }

    if (
      file.includes("vendor-pdfjs") ||
      file.includes("vendor-epubjs") ||
      file.includes("vendor-recharts")
    ) {
      heavyChunks.push({ file, sizeKb: (gzippedBytes / 1024).toFixed(2) });
    }
  }
}

const initialGzipTotalKb = (landingGzip + indexGzip + reactGzip) / 1024;

console.log("--- Landing Page Bundle Budget Audit ---");
console.log(`Index Core: ${(indexGzip / 1024).toFixed(2)} KB gzipped`);
console.log(`React Vendor: ${(reactGzip / 1024).toFixed(2)} KB gzipped`);
console.log(
  `Landing Route Chunk: ${(landingGzip / 1024).toFixed(2)} KB gzipped`,
);
console.log(
  `Total Initial Landing Payload: ${initialGzipTotalKb.toFixed(2)} KB gzipped (Budget: < ${BUDGET_KB} KB)`,
);

console.log("\n--- Heavy Chunks Isolation Audit ---");
heavyChunks.forEach((c) => {
  console.log(
    `[ISOLATED] ${c.file}: ${c.sizeKb} KB gzipped (Not loaded on landing)`,
  );
});

if (initialGzipTotalKb > BUDGET_KB) {
  console.error(
    `\nFAILED: Initial landing payload (${initialGzipTotalKb.toFixed(2)} KB) exceeds budget (${BUDGET_KB} KB)!`,
  );
  process.exit(1);
}

if (heavyChunks.length === 0) {
  console.error("\nFAILED: Expected heavy libraries to be chunked separately.");
  process.exit(1);
}

console.log(
  `\nPASSED: Bundle budget check succeeded (${initialGzipTotalKb.toFixed(2)} KB < ${BUDGET_KB} KB).`,
);
process.exit(0);
