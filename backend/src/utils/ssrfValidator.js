/**
 * Server-Side Request Forgery (SSRF) Protection Utility
 *
 * Implements strict security controls for all outbound HTTP/HTTPS requests:
 * 1. Protocol restriction (Strictly HTTPS by default; blocks http, file, gopher, ftp, data, etc.)
 * 2. Strict domain allowlist matching (supports exact and wildcard subdomains, e.g., *.gutenberg.org)
 * 3. Comprehensive IP validation against private, loopback, link-local, cloud metadata,
 *    broadcast, multicast, documentation, and reserved ranges for both IPv4 and IPv6.
 * 4. Normalization and decoding of decimal, octal, hex, and IPv4-mapped IPv6 IP encodings.
 * 5. DNS pre-resolution & DNS Rebinding mitigation via custom Agent lookup hook.
 * 6. Re-validation on every redirect (redirect URLs are strictly checked before following).
 * 7. Enforced request timeouts, stream size caps (maxContentLength), and MIME content-type validation.
 * 8. Sanitized error messages to avoid internal network disclosure.
 */

const dns = require('dns');
const https = require('https');
const http = require('http');
const axios = require('axios');
const AppError = require('./AppError');

// ==========================================
// IP Address Parsing & Range Checking
// ==========================================

/**
 * Parses an IPv4 address string into an unsigned 32-bit integer.
 * Handles standard dot-decimal, dot-octal, dot-hex, and single-integer (decimal/hex) representations.
 *
 * @param {string} ipStr
 * @returns {number|null} Unsigned 32-bit integer or null if invalid
 */
function parseIPv4(ipStr) {
  if (typeof ipStr !== 'string') return null;
  const s = ipStr.trim();
  if (!s) return null;

  // Single integer hex (e.g., 0x7f000001)
  if (/^0x[0-9a-fA-F]+$/i.test(s)) {
    const val = parseInt(s, 16);
    return !isNaN(val) && val >= 0 && val <= 0xffffffff ? val >>> 0 : null;
  }

  // Single integer decimal (e.g., 2130706433)
  if (/^\d+$/.test(s)) {
    const val = parseInt(s, 10);
    return !isNaN(val) && val >= 0 && val <= 0xffffffff ? val >>> 0 : null;
  }

  // Dot-separated (standard 4 parts)
  const parts = s.split('.');
  if (parts.length === 4) {
    const nums = [];
    for (const p of parts) {
      let n;
      if (/^0x[0-9a-fA-F]+$/i.test(p)) {
        n = parseInt(p, 16);
      } else if (/^0[0-7]+$/.test(p)) {
        n = parseInt(p, 8);
      } else if (/^\d+$/.test(p)) {
        n = parseInt(p, 10);
      } else {
        return null;
      }
      if (isNaN(n) || n < 0 || n > 255) return null;
      nums.push(n);
    }
    return (((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3]) >>> 0;
  }

  return null;
}

/**
 * Checks if a 32-bit IPv4 integer falls inside a CIDR subnet.
 */
function isInIPv4Subnet(ipLong, netLong, maskBits) {
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipLong & mask) >>> 0 === netLong >>> 0;
}

/**
 * Checks whether an IPv4 address (as a 32-bit unsigned int) belongs to any blocked / private range.
 *
 * Blocked IPv4 ranges:
 * - 0.0.0.0/8        (Current / broadcast source)
 * - 10.0.0.0/8       (Private - RFC 1918)
 * - 100.64.0.0/10    (Carrier-Grade NAT - RFC 6598)
 * - 127.0.0.0/8      (Loopback - RFC 1122)
 * - 169.254.0.0/16   (Link-Local & Cloud Metadata 169.254.169.254 - RFC 3927)
 * - 172.16.0.0/12    (Private - RFC 1918: 172.16.0.0 to 172.31.255.255)
 * - 192.0.0.0/24     (IETF Protocol Assignments - RFC 6890)
 * - 192.0.2.0/24     (TEST-NET-1 - RFC 5737)
 * - 192.88.99.0/24   (6to4 Relay Anycast - RFC 3068)
 * - 192.168.0.0/16   (Private - RFC 1918)
 * - 198.18.0.0/15    (Network Interconnect Benchmark - RFC 2544)
 * - 198.51.100.0/24  (TEST-NET-2 - RFC 5737)
 * - 203.0.113.0/24   (TEST-NET-3 - RFC 5737)
 * - 224.0.0.0/4      (Multicast - RFC 5771)
 * - 240.0.0.0/4      (Reserved / Future use - RFC 1112)
 * - 255.255.255.255  (Broadcast)
 * - Specific cloud metadata: Azure (168.63.129.16), Alibaba (100.100.100.200)
 */
function isBlockedIPv4(ipLong) {
  if (ipLong === null || ipLong === undefined) return false;

  return (
    isInIPv4Subnet(ipLong, 0x00000000, 8) || // 0.0.0.0/8
    isInIPv4Subnet(ipLong, 0x0a000000, 8) || // 10.0.0.0/8
    isInIPv4Subnet(ipLong, 0x64400000, 10) || // 100.64.0.0/10
    isInIPv4Subnet(ipLong, 0x7f000000, 8) || // 127.0.0.0/8
    isInIPv4Subnet(ipLong, 0xa9fe0000, 16) || // 169.254.0.0/16 (includes 169.254.169.254)
    isInIPv4Subnet(ipLong, 0xac100000, 12) || // 172.16.0.0/12
    isInIPv4Subnet(ipLong, 0xc0000000, 24) || // 192.0.0.0/24
    isInIPv4Subnet(ipLong, 0xc0000200, 24) || // 192.0.2.0/24
    isInIPv4Subnet(ipLong, 0xc0586300, 24) || // 192.88.99.0/24
    isInIPv4Subnet(ipLong, 0xc0a80000, 16) || // 192.168.0.0/16
    isInIPv4Subnet(ipLong, 0xc6120000, 15) || // 198.18.0.0/15
    isInIPv4Subnet(ipLong, 0xc6336400, 24) || // 198.51.100.0/24
    isInIPv4Subnet(ipLong, 0xcb007100, 24) || // 203.0.113.0/24
    isInIPv4Subnet(ipLong, 0xe0000000, 4) || // 224.0.0.0/4 (multicast)
    isInIPv4Subnet(ipLong, 0xf0000000, 4) || // 240.0.0.0/4 (reserved)
    ipLong === 0xffffffff || // 255.255.255.255
    ipLong === 0xa83f8110 || // 168.63.129.16 (Azure DNS/WireServer metadata)
    ipLong === 0x646464c8 // 100.100.100.200 (Alibaba Cloud metadata)
  );
}

/**
 * Parses an IPv6 address string into a 128-bit BigInt.
 * Handles standard, compressed (::), bracketed ([...]), and IPv4-mapped notation.
 *
 * @param {string} ipStr
 * @returns {bigint|null}
 */
function parseIPv6(ipStr) {
  if (typeof ipStr !== 'string') return null;
  let ip = ipStr.trim().replace(/^\[|\]$/g, '');
  if (!ip) return null;

  // IPv4-mapped IPv6 like ::ffff:192.168.1.1
  const v4Match = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) {
    const v4Parsed = parseIPv4(v4Match[2]);
    if (v4Parsed === null) return null;
    const high = ((v4Parsed >>> 16) & 0xffff).toString(16);
    const low = (v4Parsed & 0xffff).toString(16);
    ip = v4Match[1] + high + ':' + low;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;

  let groups;
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = ip.split(':');
  }

  if (groups.length !== 8) return null;

  let val = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    val = (val << 16n) | BigInt(parseInt(g, 16));
  }
  return val;
}

/**
 * Checks whether an IPv6 address (as BigInt) belongs to any blocked / private range.
 *
 * Blocked IPv6 ranges:
 * - ::/128        (Unspecified)
 * - ::1/128       (Loopback)
 * - fc00::/7      (Unique Local Addresses / private ULA)
 * - fe80::/10     (Link-Local unicast)
 * - ff00::/8      (Multicast)
 * - 100::/64      (Discard-Only)
 * - 2001:db8::/32 (Documentation)
 * - ::ffff:0:0/96 (IPv4-mapped IPv6 - validates embedded IPv4)
 * - 64:ff9b::/96  (Well-known NAT64 prefix - validates embedded IPv4)
 * - 2002::/16     (6to4 prefix - validates embedded IPv4)
 */
function isBlockedIPv6(ipBigInt) {
  if (ipBigInt === null || ipBigInt === undefined) return false;

  const inSubnet = (netBigInt, maskBits) => {
    const shift = 128n - BigInt(maskBits);
    return ipBigInt >> shift === netBigInt >> shift;
  };

  // ::1/128 (loopback) and ::/128 (unspecified)
  if (ipBigInt === 0n || ipBigInt === 1n) return true;

  // fc00::/7 (Unique local / private), fe80::/10 (Link-local), ff00::/8 (Multicast)
  if (inSubnet(0xfc000000000000000000000000000000n, 7)) return true;
  if (inSubnet(0xfe800000000000000000000000000000n, 10)) return true;
  if (inSubnet(0xff000000000000000000000000000000n, 8)) return true;
  if (inSubnet(0x01000000000000000000000000000000n, 64)) return true;
  if (inSubnet(0x20010db8000000000000000000000000n, 32)) return true;

  // IPv4-mapped IPv6 (::ffff:0:0/96)
  if (inSubnet(0x00000000000000000000ffff00000000n, 96)) {
    const embeddedV4 = Number(ipBigInt & 0xffffffffn) >>> 0;
    return isBlockedIPv4(embeddedV4);
  }

  // NAT64 well-known prefix (64:ff9b::/96)
  if (inSubnet(0x0064ff9b000000000000000000000000n, 96)) {
    const embeddedV4 = Number(ipBigInt & 0xffffffffn) >>> 0;
    return isBlockedIPv4(embeddedV4);
  }

  // 6to4 (2002::/16)
  if (inSubnet(0x20020000000000000000000000000000n, 16)) {
    const embeddedV4 = Number((ipBigInt >> 80n) & 0xffffffffn) >>> 0;
    return isBlockedIPv4(embeddedV4);
  }

  return false;
}

/**
 * Checks if an IP address string (IPv4 or IPv6) is in any forbidden / private range.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isBlockedIp(ip) {
  if (typeof ip !== 'string') return true;
  const clean = ip.trim();

  // Try IPv4 first
  const v4Long = parseIPv4(clean);
  if (v4Long !== null) {
    return isBlockedIPv4(v4Long);
  }

  // Try IPv6
  const v6Big = parseIPv6(clean);
  if (v6Big !== null) {
    return isBlockedIPv6(v6Big);
  }

  // If it doesn't parse as a valid IP, treat as unsafe
  return true;
}

// ==========================================
// Hostname & Domain Allowlist Validation
// ==========================================

const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'local',
  'internal',
  'lan',
  'home.arpa',
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
]);

/**
 * Matches a hostname against an array of allowed domain patterns (supports *.domain.com and domain.com).
 *
 * @param {string} hostname
 * @param {string[]} allowedPatterns
 * @returns {boolean}
 */
function isDomainAllowed(hostname, allowedPatterns) {
  if (!Array.isArray(allowedPatterns) || allowedPatterns.length === 0) {
    return true; // No allowlist restriction specified
  }

  const h = hostname.toLowerCase().trim();

  return allowedPatterns.some((pattern) => {
    const p = pattern.toLowerCase().trim();
    if (p.startsWith('*.')) {
      const rootDomain = p.slice(2);
      return h === rootDomain || h.endsWith('.' + rootDomain);
    }
    return h === p;
  });
}

/**
 * Validates a URL against strict SSRF criteria.
 *
 * @param {string} rawUrl - Target URL to evaluate
 * @param {object} options
 * @param {string[]} [options.allowedDomains] - Array of permitted domains/patterns (e.g., ['*.gutenberg.org', 'gutendex.com'])
 * @param {boolean} [options.allowHttp=false] - Only allow HTTPS by default
 * @param {function} [options.dnsLookup] - Optional custom DNS lookup function for mocking/testing
 * @returns {Promise<{isSafe: boolean, url: string, hostname: string, resolvedIps: string[]}>}
 */
async function validateSafeUrl(rawUrl, options = {}) {
  const { allowedDomains, allowHttp = false, dnsLookup = dns.promises.lookup } = options;

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new AppError('Invalid or empty URL provided for external request.', 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new AppError('Malformed URL syntax.', 400);
  }

  // 1. Protocol Enforcement
  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== 'https:' && (!allowHttp || protocol !== 'http:')) {
    throw new AppError('Only secure HTTPS requests are permitted for external resources.', 400);
  }

  // 2. Hostname Check
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname) {
    throw new AppError('Missing hostname in request URL.', 400);
  }

  // Check if hostname is directly an IP (including decimal/hex/IPv6)
  const directV4 = parseIPv4(hostname);
  if (directV4 !== null) {
    if (isBlockedIPv4(directV4)) {
      throw new AppError(
        'Direct requests to private, loopback, or metadata IP ranges are blocked.',
        403
      );
    }
  }

  const directV6 = parseIPv6(hostname);
  if (directV6 !== null) {
    if (isBlockedIPv6(directV6)) {
      throw new AppError(
        'Direct requests to private, loopback, or metadata IPv6 ranges are blocked.',
        403
      );
    }
  }

  // Reject known internal/reserved hostnames
  if (
    FORBIDDEN_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp')
  ) {
    throw new AppError('Access to local or internal loopback destinations is forbidden.', 403);
  }

  // 3. Domain Allowlist Check
  if (allowedDomains && allowedDomains.length > 0) {
    if (!isDomainAllowed(hostname, allowedDomains)) {
      throw new AppError(
        'Requested destination domain is not on the permitted access allowlist.',
        403
      );
    }
  }

  // 4. DNS Resolution & IP Blocklist Verification
  let records;
  try {
    records = await dnsLookup(hostname, { all: true });
  } catch (dnsErr) {
    throw new AppError(
      `DNS resolution failed for external destination host: ${dnsErr.message}`,
      400
    );
  }

  if (!records || records.length === 0) {
    throw new AppError('DNS resolution yielded no address records for destination host.', 400);
  }

  const resolvedIps = [];
  for (const record of records) {
    const address = record.address;
    resolvedIps.push(address);

    if (isBlockedIp(address)) {
      throw new AppError(
        'Destination host resolved to a prohibited private, loopback, or metadata address.',
        403
      );
    }
  }

  return {
    isSafe: true,
    url: parsedUrl.toString(),
    hostname,
    protocol,
    resolvedIps,
  };
}

// ==========================================
// SSRF-Safe HTTP Client & DNS Rebinding Mitigation
// ==========================================

/**
 * Creates an HTTPS/HTTP Agent with an inline DNS lookup hook that validates
 * every resolved IP address at socket connection time. This defeats DNS rebinding
 * (TOCTOU) attacks where an attacker changes DNS records between validation and connection.
 *
 * @param {object} options
 * @returns {https.Agent}
 */
function createSsrfSafeAgent(options = {}) {
  const dnsLookup = options.dnsLookup || dns.promises.lookup;

  const lookupHook = async (hostname, lookupOpts, cb) => {
    try {
      const records = await dnsLookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return cb(new Error('DNS lookup returned no IP addresses for host.'));
      }
      for (const rec of records) {
        if (isBlockedIp(rec.address)) {
          return cb(new Error(`SSRF blocked: Host resolved to prohibited address ${rec.address}`));
        }
      }
      if (lookupOpts && lookupOpts.all) {
        return cb(null, records);
      }
      return cb(null, records[0].address, records[0].family);
    } catch (err) {
      return cb(err);
    }
  };

  return new https.Agent({
    lookup: lookupHook,
    keepAlive: false,
    timeout: options.timeout || 15000,
  });
}

/**
 * Executes a secure HTTP/HTTPS fetch with full SSRF mitigation:
 * - Preliminary URL & domain validation
 * - Dynamic socket-level IP check to defeat DNS rebinding
 * - Strict re-validation on every redirect
 * - Response size capping on incoming streams
 * - Timeouts and content-type enforcement
 * - Sanitized, non-leaking error responses
 *
 * @param {string} targetUrl - Initial URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<import('axios').AxiosResponse>}
 */
async function safeFetch(targetUrl, options = {}) {
  const {
    allowedDomains,
    allowHttp = false,
    maxRedirects = 5,
    timeout = 15000,
    maxContentLength = 50 * 1024 * 1024, // 50MB default limit
    allowedContentTypes = [],
    responseType = 'stream',
    headers = {},
    dnsLookup = dns.promises.lookup,
    method = 'GET',
    axiosClient = axios,
  } = options;

  let currentUrl = targetUrl;
  let redirectsFollowed = 0;
  const safeAgent = createSsrfSafeAgent({ timeout, dnsLookup });

  while (true) {
    // Re-validate URL, protocol, domain allowlist, and resolved IP on every hop
    await validateSafeUrl(currentUrl, { allowedDomains, allowHttp, dnsLookup });

    let response;
    try {
      response = await axiosClient({
        url: currentUrl,
        method,
        headers,
        responseType,
        timeout,
        maxRedirects: 0, // Disable automatic redirects to intercept every hop
        validateStatus: (status) => status >= 200 && status < 400,
        httpsAgent: safeAgent,
        httpAgent: allowHttp
          ? new http.Agent({ lookup: safeAgent.options.lookup, keepAlive: false })
          : undefined,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Do not leak internal network details
      throw new AppError('Failed to fetch external resource from upstream.', 502);
    }

    // Handle 3xx redirects securely
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) {
        throw new AppError('Redirect response missing Location header.', 400);
      }

      redirectsFollowed++;
      if (redirectsFollowed > maxRedirects) {
        throw new AppError('Maximum allowed redirect hops exceeded.', 400);
      }

      // Resolve relative or absolute redirect destination
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new AppError('Invalid Location URL in upstream redirect.', 400);
      }

      continue;
    }

    // Content-Type validation
    if (allowedContentTypes.length > 0) {
      const contentType = (response.headers['content-type'] || '').toLowerCase();
      const isAllowed = allowedContentTypes.some((type) =>
        contentType.includes(type.toLowerCase())
      );
      if (!isAllowed) {
        throw new AppError(
          'Upstream resource responded with an unsupported or prohibited media type.',
          415
        );
      }
    }

    // Response size enforcement via Content-Length header
    if (maxContentLength && response.headers['content-length']) {
      const cl = parseInt(response.headers['content-length'], 10);
      if (!isNaN(cl) && cl > maxContentLength) {
        throw new AppError('Upstream resource exceeds the maximum permitted download size.', 413);
      }
    }

    // Response size enforcement on stream chunks
    if (responseType === 'stream' && response.data && typeof response.data.on === 'function') {
      let bytesRead = 0;
      response.data.on('data', (chunk) => {
        bytesRead += chunk.length;
        if (maxContentLength && bytesRead > maxContentLength) {
          response.data.destroy(
            new AppError('Resource size exceeded maximum permitted limit.', 413)
          );
        }
      });
    }

    return response;
  }
}

module.exports = {
  parseIPv4,
  isBlockedIPv4,
  parseIPv6,
  isBlockedIPv6,
  isBlockedIp,
  isDomainAllowed,
  validateSafeUrl,
  createSsrfSafeAgent,
  safeFetch,
};
