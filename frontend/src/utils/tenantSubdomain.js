/**
 * Utility to detect and extract tenant subdomain slug from window.location
 */
export function getSubdomainTenantSlug() {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname.toLowerCase();

  const rootHosts = [
    "localhost",
    "127.0.0.1",
    "bookbuddy.com",
    "bookbuddy.app",
    "vercel.app",
  ];

  if (rootHosts.includes(hostname)) {
    return null;
  }

  // Subdomains of localhost: "mit.localhost" -> "mit"
  if (hostname.endsWith(".localhost")) {
    const parts = hostname.split(".");
    if (parts.length === 2 && parts[0]) {
      return parts[0];
    }
  }

  // Subdomains of BookBuddy production / staging
  const match = hostname.match(
    /^([a-z0-9-]+)\.bookbuddy\.(?:com|app|io|org|net)$/i,
  );
  if (match && match[1]) {
    const slug = match[1].toLowerCase();
    const reserved = [
      "admin",
      "api",
      "app",
      "portal",
      "auth",
      "www",
      "static",
      "system",
      "status",
    ];
    if (!reserved.includes(slug)) {
      return slug;
    }
  }

  return null;
}
