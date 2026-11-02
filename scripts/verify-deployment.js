#!/usr/bin/env node
/**
 * Root forwarding entrypoint for deployment verification
 */
const { runVerification, ...rest } = require("./deployment/verify-deployment.js");

module.exports = { runVerification, ...rest };

if (require.main === module) {
  runVerification().catch((err) => {
    console.error("❌ Unexpected verification script error:", err);
    process.exit(1);
  });
}

