/**
 * Normalizes a raw tag string into a standardized slug and clean display name.
 *
 * Example:
 *   normalizeTag(" Computer Science!! ") -> { slug: "computer-science", name: "Computer Science" }
 *   normalizeTag("c++") -> { slug: "cpp", name: "C++" }
 *   normalizeTag("node.js") -> { slug: "nodejs", name: "Node.js" }
 */
const normalizeTag = (rawTag) => {
  if (!rawTag || typeof rawTag !== 'string') {
    return null;
  }

  const cleanName = rawTag.trim();
  if (!cleanName) return null;

  // Custom mapping for common tech terms
  const knownMappings = {
    'c++': 'cpp',
    'c#': 'csharp',
    '.net': 'dotnet',
    'node.js': 'nodejs',
    'react.js': 'reactjs',
    'vue.js': 'vuejs',
  };

  const lowerRaw = cleanName.toLowerCase();
  if (knownMappings[lowerRaw]) {
    return {
      slug: knownMappings[lowerRaw],
      name: cleanName,
    };
  }

  const slug = lowerRaw
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces & hyphens
    .replace(/\s+/g, '-') // convert spaces to single hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  if (!slug) return null;

  return {
    slug,
    name: cleanName,
  };
};

module.exports = {
  normalizeTag,
};
