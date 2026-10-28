const ipaddr = require('ipaddr.js');
const config = require('../config');

// Cloudflare Published IPv4 CIDR Blocks (https://www.cloudflare.com/ips-v4)
const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
].map((c) => ipaddr.parseCIDR(c));

// Cloudflare Published IPv6 CIDR Blocks (https://www.cloudflare.com/ips-v6)
const CLOUDFLARE_IPV6_CIDRS = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
].map((c) => ipaddr.parseCIDR(c));

// Standard Loopback / Localhost Subnets
const LOOPBACK_CIDRS = ['127.0.0.0/8', '::1/128'].map((c) => ipaddr.parseCIDR(c));

/**
 * Normalizes an IP string by stripping port, whitespace, and converting IPv4-mapped IPv6.
 *
 * @param {string} rawIp
 * @returns {string}
 */
const cleanIp = (rawIp) => {
  if (!rawIp || typeof rawIp !== 'string') return '';
  let ip = rawIp.trim();

  // Strip port if formatted as ip:port (IPv4 only or [ipv6]:port)
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.substring(1, ip.indexOf(']'));
  } else if (ip.includes(':') && ip.indexOf(':') === ip.lastIndexOf(':')) {
    // Single colon -> IPv4 with port e.g. 192.168.1.1:8080
    ip = ip.split(':')[0];
  }

  // Convert IPv4-mapped IPv6 address (::ffff:192.0.2.1 -> 192.0.2.1)
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    ip = ip.substring(7);
  }

  return ip;
};

/**
 * Checks whether an IP address belongs to Cloudflare's published IP ranges.
 *
 * @param {string} rawIp
 * @returns {boolean}
 */
const isCloudflareIp = (rawIp) => {
  const ip = cleanIp(rawIp);
  if (!ip || !ipaddr.isValid(ip)) return false;

  try {
    const addr = ipaddr.process(ip);
    if (addr.kind() === 'ipv4') {
      return CLOUDFLARE_IPV4_CIDRS.some((cidr) => addr.match(cidr));
    }
    if (addr.kind() === 'ipv6') {
      return CLOUDFLARE_IPV6_CIDRS.some((cidr) => addr.match(cidr));
    }
  } catch {
    return false;
  }
  return false;
};

/**
 * Checks whether an IP address is a trusted local reverse proxy (loopback or configured proxy).
 *
 * @param {string} rawIp
 * @returns {boolean}
 */
const isTrustedProxy = (rawIp) => {
  const ip = cleanIp(rawIp);
  if (!ip) return false;
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') return true;
  if (!ipaddr.isValid(ip)) return false;

  try {
    const addr = ipaddr.process(ip);
    if (LOOPBACK_CIDRS.some((cidr) => addr.match(cidr))) {
      return true;
    }

    // Check additional configured trusted proxy addresses/CIDRs
    if (config.trustedProxies && Array.isArray(config.trustedProxies)) {
      for (const trusted of config.trustedProxies) {
        if (!trusted) continue;
        const cleaned = cleanIp(trusted);
        if (cleaned === ip) return true;
        if (cleaned.includes('/')) {
          try {
            const cidr = ipaddr.parseCIDR(cleaned);
            if (addr.match(cidr)) return true;
          } catch {
            // Ignore malformed CIDR
          }
        }
      }
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Resolves the true visitor IP address.
 *
 * Rule:
 * - CF-Connecting-IP is honored ONLY when the request directly originates from a trusted local proxy
 *   (e.g. Nginx on localhost) or a validated Cloudflare edge IP.
 * - If a direct untrusted caller supplies CF-Connecting-IP, it is rejected and ignored as spoofed.
 * - Otherwise, resolves via Express trust proxy hop count or direct socket address.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
const resolveClientIp = (req) => {
  if (!req) return 'unknown-ip';

  const peerIp = cleanIp(
    req.socket?.remoteAddress || req.connection?.remoteAddress || req.rawSocket?.remoteAddress || ''
  );

  const cfHeader = req.headers?.['cf-connecting-ip'];

  // Check if direct peer is trusted (Cloudflare edge node OR local reverse proxy)
  const isPeerTrusted = (peerIp && isTrustedProxy(peerIp)) || (peerIp && isCloudflareIp(peerIp));

  if (cfHeader && typeof cfHeader === 'string') {
    const candidateCf = cleanIp(cfHeader.split(',')[0]);
    if (isPeerTrusted && ipaddr.isValid(candidateCf)) {
      return candidateCf;
    }
    // If peer is NOT trusted, CF-Connecting-IP was sent by an external attacker -> ignore spoof!
  }

  // If Express trust proxy has resolved req.ip (and peer is a trusted proxy or trust proxy is enabled)
  if (req.ip) {
    const cleanedIp = cleanIp(req.ip);
    if (cleanedIp && ipaddr.isValid(cleanedIp)) {
      return cleanedIp;
    }
  }

  // Fallback to X-Forwarded-For using configured hop count if trust proxy is configured
  if (config.trustProxy && req.headers?.['x-forwarded-for']) {
    const list = String(req.headers['x-forwarded-for'])
      .split(',')
      .map((item) => cleanIp(item))
      .filter((item) => ipaddr.isValid(item));

    if (list.length > 0) {
      const hops =
        typeof config.trustProxyHops === 'number' && config.trustProxyHops > 0
          ? config.trustProxyHops
          : 1;
      const targetIndex = Math.max(0, list.length - hops);
      return list[targetIndex];
    }
  }

  return peerIp || '127.0.0.1';
};

/**
 * Middleware that attaches resolved client IP to req.clientIp
 */
const clientIpMiddleware = (req, res, next) => {
  req.clientIp = resolveClientIp(req);
  next();
};

module.exports = {
  cleanIp,
  isCloudflareIp,
  isTrustedProxy,
  resolveClientIp,
  getClientIp: resolveClientIp,
  clientIpMiddleware,
};
