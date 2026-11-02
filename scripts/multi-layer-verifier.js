#!/usr/bin/env node
/**
 * Root forwarding entrypoint for multi-layer verifier
 */
const { runMultiLayerVerification } = require("./testing/multi-layer-verifier.js");

module.exports = { runMultiLayerVerification };

if (require.main === module) {
  runMultiLayerVerification().catch((err) => {
    console.error("❌ Unexpected multi-layer verification failure:", err);
    process.exit(1);
  });
}

