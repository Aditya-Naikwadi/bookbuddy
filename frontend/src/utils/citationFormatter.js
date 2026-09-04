/**
 * Formats a book or e-resource object into APA 7th, MLA 9th, or Chicago 17th citation styles.
 * Safely handles missing fields (authors, publication years, publishers, DOIs/URLs).
 */

const parseAuthor = (rawAuthor) => {
  if (!rawAuthor || typeof rawAuthor !== "string") return null;
  const cleaned = rawAuthor.trim();
  if (!cleaned) return null;

  // Handle "Last, First" or "First Last"
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((p) => p.trim());
    return { last: parts[0], first: parts[1] || "" };
  }

  const parts = cleaned.split(" ");
  if (parts.length === 1) return { last: parts[0], first: "" };
  const last = parts.pop();
  const first = parts.join(" ");
  return { last, first };
};

export const formatAPA7 = (item) => {
  if (!item) return "";
  const title = item.title?.trim() || "Untitled work";
  const authorObj = parseAuthor(item.author || item.authors);
  const year =
    item.year || item.publicationYear || item.publishedYear || "n.d.";
  const publisher = item.publisher || item.source || "Library Collection";
  const url = item.doi
    ? `https://doi.org/${item.doi}`
    : item.fileUrl || item.url || null;

  const firstInitial = authorObj?.first ? ` ${authorObj.first.charAt(0)}.` : "";
  const authorStr = authorObj ? `${authorObj.last},${firstInitial}` : title;
  const titleFormatted = authorObj ? `*${title}*` : `(n.d.)`;
  let citation = `${authorStr} (${year}). ${authorObj ? titleFormatted : title}. ${publisher}.`;

  if (url) {
    citation += ` ${url}`;
  }

  return citation;
};

export const formatMLA9 = (item) => {
  if (!item) return "";
  const title = item.title?.trim() || "Untitled work";
  const authorObj = parseAuthor(item.author || item.authors);
  const year =
    item.year || item.publicationYear || item.publishedYear || "n.d.";
  const publisher = item.publisher || item.source || "Library Repository";
  const url = item.doi
    ? `https://doi.org/${item.doi}`
    : item.fileUrl || item.url || null;

  const authorStr = authorObj ? `${authorObj.last}, ${authorObj.first}. ` : "";
  let citation = `${authorStr}*${title}*. ${publisher}, ${year}.`;

  if (url) {
    citation += ` ${url}.`;
  }

  return citation;
};

export const formatChicago17 = (item) => {
  if (!item) return "";
  const title = item.title?.trim() || "Untitled work";
  const authorObj = parseAuthor(item.author || item.authors);
  const year =
    item.year || item.publicationYear || item.publishedYear || "n.d.";
  const publisher = item.publisher || item.source || "Library Catalog";
  const url = item.doi
    ? `https://doi.org/${item.doi}`
    : item.fileUrl || item.url || null;

  const authorStr = authorObj ? `${authorObj.last}, ${authorObj.first}. ` : "";
  let citation = `${authorStr}*${title}*. ${publisher}, ${year}.`;

  if (url) {
    citation += ` ${url}.`;
  }

  return citation;
};

export const generateCitation = (item, style = "apa7") => {
  switch (style?.toLowerCase()) {
    case "mla9":
    case "mla":
      return formatMLA9(item);
    case "chicago17":
    case "chicago":
      return formatChicago17(item);
    case "apa7":
    case "apa":
    default:
      return formatAPA7(item);
  }
};
