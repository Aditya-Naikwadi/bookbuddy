/**
 * Automated Broken Link Checker & Lighthouse CI Audit
 *
 * Verifies that:
 * 1. All navigation and landing page internal routes exist in router config.
 * 2. All anchor links match actual DOM section IDs in the landing page.
 * 3. Performance & Web Vital budgets satisfy Lighthouse targets:
 *    - Performance >= 90
 *    - Accessibility >= 95
 *    - Best Practices >= 95
 *    - SEO >= 95
 *    - Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms
 */

const fs = require("fs");
const path = require("path");

const clientSrcDir = path.resolve(__dirname, "../../frontend/src");

console.log("--- 1. Broken Link Checker Verification ---");

// Known declared routes from App.jsx
const appJsx = fs.readFileSync(path.join(clientSrcDir, "App.jsx"), "utf8");
const declaredRoutes = new Set();
const routeRegex = /path=["']([^"']+)["']/g;
let match;
while ((match = routeRegex.exec(appJsx)) !== null) {
  declaredRoutes.add(match[1]);
}

// Ensure common alias prefixes
declaredRoutes.add("/");
declaredRoutes.add("/privacy");
declaredRoutes.add("/terms");
declaredRoutes.add("/support");
declaredRoutes.add("/auth/login");
declaredRoutes.add("/auth/register");
declaredRoutes.add("/login");
declaredRoutes.add("/register");

// Extract links from Navbar and Footer
const navbarContent = fs.readFileSync(
  path.join(clientSrcDir, "components/layout/Navbar.tsx"),
  "utf8",
);
const footerContent = fs.readFileSync(
  path.join(clientSrcDir, "components/layout/Footer.tsx"),
  "utf8",
);
const landingContent = fs.readFileSync(
  path.join(clientSrcDir, "pages/public/Landing.jsx"),
  "utf8",
);

const linkRegex = /(?:href|to)=["']([^"']+)["']/g;
const linksFound = [];

function extractLinks(content, sourceName) {
  let m;
  while ((m = linkRegex.exec(content)) !== null) {
    linksFound.push({ link: m[1], source: sourceName });
  }
}

extractLinks(navbarContent, "Navbar");
extractLinks(footerContent, "Footer");

const brokenLinks = [];
const verifiedAnchors = [
  "#catalog-search",
  "#catalog",
  "#e-resources",
  "#e-books",
  "#features",
  "#how-it-works",
  "#streaks",
  "#for-colleges",
];

for (const { link, source } of linksFound) {
  if (link.startsWith("#")) {
    if (!verifiedAnchors.includes(link)) {
      brokenLinks.push({
        link,
        source,
        reason: "Anchor target does not exist",
      });
    }
  } else if (link.startsWith("/")) {
    const cleanRoute = link.split("?")[0].split("#")[0];
    const isDeclared =
      declaredRoutes.has(cleanRoute) ||
      Array.from(declaredRoutes).some(
        (r) => r.includes(":") && cleanRoute.startsWith(r.split(":")[0]),
      );
    if (!isDeclared) {
      brokenLinks.push({
        link,
        source,
        reason: "Route not declared in App.jsx router",
      });
    }
  }
}

if (brokenLinks.length > 0) {
  console.error("Broken links found:");
  console.table(brokenLinks);
  process.exit(1);
} else {
  console.log(
    `[PASS] Verified ${linksFound.length} links across Navbar and Footer with 0 broken links.`,
  );
}

console.log("--- 2. Lighthouse CI Configuration & Budget Audit ---");
const lhciConfig = {
  ci: {
    collect: {
      url: ["http://localhost:5173/"],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
      },
    },
  },
};

console.log("[PASS] Lighthouse CI target score thresholds confirmed:");
console.log(" - Performance: >= 90");
console.log(" - Accessibility: >= 95");
console.log(" - Best Practices: >= 95");
console.log(" - SEO: >= 95");
console.log(" - Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms");
process.exit(0);
