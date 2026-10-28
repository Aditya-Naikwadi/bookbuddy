const fs = require('fs');

/**
 * Loads secrets from a single JSON string or JSON file into the target environment (process.env).
 *
 * Evaluation Order:
 * 1. SECRETS_JSON (environment variable containing a JSON string)
 * 2. SECRETS_FILE_PATH (explicit file path to a JSON secrets file)
 * 3. /etc/bookbuddy/secrets.json (default production VM secrets path, if present)
 * 4. Fallback: No-op, preserves existing individual environment variables (Render / Vercel compatibility).
 *
 * Security:
 * - Prototype pollution protection (rejects __proto__, constructor, prototype)
 * - Secrets are NEVER logged to console or stdout
 *
 * @param {Object} options
 * @param {string} [options.secretsJson] - Optional override for SECRETS_JSON content
 * @param {string} [options.filePath] - Optional override for SECRETS_FILE_PATH
 * @param {string} [options.defaultPath] - Default file path (defaults to '/etc/bookbuddy/secrets.json')
 * @param {Object} [options.targetEnv] - Target environment object (defaults to process.env)
 * @returns {{ loaded: boolean, source: string | null, count: number }}
 */
function loadSecrets(options = {}) {
  const targetEnv = options.targetEnv || process.env;
  const secretsJson =
    options.secretsJson !== undefined ? options.secretsJson : targetEnv.SECRETS_JSON;
  const filePath = options.filePath !== undefined ? options.filePath : targetEnv.SECRETS_FILE_PATH;
  const defaultPath =
    options.defaultPath !== undefined ? options.defaultPath : '/etc/bookbuddy/secrets.json';

  let rawContent = null;
  let source = null;

  if (secretsJson && typeof secretsJson === 'string' && secretsJson.trim().length > 0) {
    rawContent = secretsJson.trim();
    source = 'SECRETS_JSON';
  } else if (filePath && typeof filePath === 'string' && filePath.trim().length > 0) {
    const resolvedPath = filePath.trim();
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Explicit SECRETS_FILE_PATH not found: ${resolvedPath}`);
    }
    rawContent = fs.readFileSync(resolvedPath, 'utf8');
    source = `file:${resolvedPath}`;
  } else if (defaultPath && fs.existsSync(defaultPath)) {
    try {
      rawContent = fs.readFileSync(defaultPath, 'utf8');
      source = `file:${defaultPath}`;
    } catch (_err) {
      // Inaccessible default path is ignored to maintain fallback compatibility
      return { loaded: false, source: null, count: 0 };
    }
  }

  if (!rawContent) {
    return { loaded: false, source: null, count: 0 };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Failed to parse secrets JSON from ${source}: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Secrets JSON from ${source} must be a key-value object`);
  }

  const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
  let count = 0;

  for (const [key, value] of Object.entries(parsed)) {
    if (forbiddenKeys.has(key)) {
      continue;
    }
    if (value !== undefined && value !== null) {
      targetEnv[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      count += 1;
    }
  }

  return { loaded: true, source, count };
}

// Auto-execute on require
loadSecrets();

module.exports = {
  loadSecrets,
};
