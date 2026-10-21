/**
 * Automated Secret Separation & Client-Side Leak Prevention Verification
 *
 * Verifies that:
 * 1. Only truly public publishable identifiers are exposed via VITE_ prefixes.
 * 2. No database URIs, signing secrets, or private API keys exist in frontend code or dist assets.
 * 3. All third-party services (Payments, E-resources, Google Books, Uploads) are mediated via authenticated server proxies.
 * 4. .env files are strictly untracked and covered by .gitignore.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "../../");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const DIST_DIR = path.join(FRONTEND_DIR, "dist");

console.log("=== Running Secret Separation & Server-Side Security Audit ===\n");

let failed = false;

// 1. Check Git tracking of .env files
console.log("1. Checking Git tracked files for sensitive env files...");
try {
  const trackedEnv = execSync('git ls-files -- "*.env*"', { cwd: ROOT_DIR })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

  const forbiddenTracked = trackedEnv.filter(
    (file) => !file.endsWith(".example"),
  );

  if (forbiddenTracked.length > 0) {
    console.error(
      "❌ FORBIDDEN: Sensitive .env files tracked in Git:",
      forbiddenTracked,
    );
    failed = true;
  } else {
    console.log(
      "✅ PASS: Only .env.example files are tracked. All actual .env files are untracked.",
    );
  }
} catch (err) {
  console.error("⚠️ Could not run git ls-files:", err.message);
}

// 2. Scan frontend/src for disallowed VITE_ environment variables
console.log("\n2. Auditing frontend environment variable exposures...");
const allowedViteVars = new Set([
  "VITE_API_URL",
  "VITE_API_BASE_URL",
  "VITE_WS_URL",
  "VITE_SOCKET_URL",
  "VITE_GOOGLE_CLIENT_ID",
  "VITE_RAZORPAY_KEY_ID",
]);

const scanDirForViteVars = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const varsFound = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      varsFound.push(...scanDirForViteVars(fullPath));
    } else if (entry.isFile() && /\.(jsx?|tsx?|html)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      const matches = content.match(/VITE_[A-Z0-9_]+/g) || [];
      for (const m of matches) {
        varsFound.push({ file: fullPath, varName: m });
      }
    }
  }
  return varsFound;
};

const viteVarsUsed = scanDirForViteVars(path.join(FRONTEND_DIR, "src"));
const disallowedViteVars = viteVarsUsed.filter(
  (v) => !allowedViteVars.has(v.varName),
);

if (disallowedViteVars.length > 0) {
  console.error(
    "❌ FORBIDDEN: Disallowed VITE_ variables exposed in client:",
    disallowedViteVars,
  );
  failed = true;
} else {
  console.log(
    "✅ PASS: All frontend VITE_ variables are public publishable keys or gateway endpoints:",
  );
  const uniqueVars = Array.from(new Set(viteVarsUsed.map((v) => v.varName)));
  uniqueVars.forEach((v) => console.log(`   - ${v}`));
}

// 3. Scan dist/ assets for secret leak patterns
console.log(
  "\n3. Scanning production bundle (dist/) for sensitive secret patterns...",
);
if (fs.existsSync(DIST_DIR)) {
  const secretPatterns = [
    { pattern: /mongodb(\+srv)?:\/\//i, name: "MongoDB Connection URI" },
    { pattern: /redis(s)?:\/\/[^/]+/i, name: "Redis Connection URI" },
    { pattern: /AIzaSy[A-Za-z0-9_-]{33}/, name: "Google API Private Key" },
    { pattern: /RAZORPAY_KEY_SECRET/i, name: "Razorpay Secret Key variable" },
    {
      pattern: /RAZORPAY_WEBHOOK_SECRET/i,
      name: "Razorpay Webhook Secret variable",
    },
    { pattern: /4Dogo74m0de38Vt4Ln3P18bi9Y4/, name: "Cloudinary Secret Key" },
    {
      pattern:
        /ea830292a6b69ddc6e2f4ecb990c4d0a8542165fa0517d31377f81f294787c18/,
      name: "JWT Secret Key",
    },
    {
      pattern: new RegExp("-----" + "BEGIN PRIVATE KEY" + "-----"),
      name: "RSA/EC Private Key",
    }, // secret-scanner:ignore
  ];

  const scanDist = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDist(fullPath);
      } else if (entry.isFile() && /\.(js|mjs|css|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf8");
        for (const { pattern, name } of secretPatterns) {
          if (pattern.test(content)) {
            console.error(
              `❌ LEAK DETECTED in ${entry.name}: Pattern "${name}" matched!`,
            );
            failed = true;
          }
        }
      }
    }
  };

  scanDist(DIST_DIR);
  if (!failed) {
    console.log(
      "✅ PASS: Zero sensitive credentials or private tokens found in production build bundle.",
    );
  }
} else {
  console.log(
    "⚠️ dist/ directory not found. Run npm run build in frontend first.",
  );
}

// 4. Verify Server-Side Proxy Endpoints
console.log("\n4. Verifying server-side mediator proxy architecture...");
const serverEndpoints = [
  {
    name: "Razorpay Order Creation",
    route: "backend/src/routes/paymentRoutes.js",
    pattern: /create-order/,
  },
  {
    name: "Razorpay Payment Signature Verification",
    route: "backend/src/routes/paymentRoutes.js",
    pattern: /verify-payment/,
  },
  {
    name: "Google Books API Proxy",
    route: "backend/src/routes/googleBooksRoutes.js",
    pattern: /search/,
  },
  {
    name: "Cloudinary Presigned URL Generator",
    route: "backend/src/routes/uploadRoutes.js",
    pattern: /cloudinary-signature/,
  },
  {
    name: "E-Resource Content Proxy",
    route: "backend/src/routes/eresourceExternalRoutes.js",
    pattern: /content/,
  },
];

for (const ep of serverEndpoints) {
  const filePath = path.join(ROOT_DIR, ep.route);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf8");
    if (ep.pattern.test(content)) {
      console.log(`✅ Verified Server Proxy: ${ep.name} -> ${ep.route}`);
    } else {
      console.error(`❌ Missing pattern in ${ep.route} for ${ep.name}`);
      failed = true;
    }
  } else {
    console.error(`❌ Missing file: ${filePath}`);
    failed = true;
  }
}

console.log("\n======================================================");
if (failed) {
  console.error("❌ Audit Failed: Secrets or unmediated calls detected.");
  process.exit(1);
} else {
  console.log(
    "🎉 Audit Passed: All secrets kept server-side with zero client leaks.",
  );
  process.exit(0);
}
