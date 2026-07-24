/**
 * Presentation DTO for Book & UnifiedBook payload standardization
 */
class BookDTO {
  static transform(book) {
    if (!book) return null;

    const raw = typeof book.toObject === 'function' ? book.toObject() : book;

    return {
      id: raw._id ? raw._id.toString() : raw.id,
      title: raw.title || '',
      authors: Array.isArray(raw.authors) ? raw.authors : raw.author ? [raw.author] : [],
      description: raw.description || '',
      publishYear: raw.publishYear || null,
      isbns: Array.isArray(raw.isbns) ? raw.isbns : raw.isbn ? [raw.isbn] : [],
      coverImageUrl: raw.coverImageUrl || raw.coverImage || null,
      category: raw.category || 'General',
      copiesTotal: raw.copiesTotal !== undefined ? raw.copiesTotal : null,
      copiesAvailable: raw.copiesAvailable !== undefined ? raw.copiesAvailable : null,
      downloadLinks: raw.downloadLinks || {},
      sources: raw.sources || (raw.source ? [raw.source] : []),
      createdAt: raw.createdAt || null,
    };
  }

  static transformMany(books) {
    if (!Array.isArray(books)) return [];
    return books.map((b) => BookDTO.transform(b));
  }
}

module.exports = BookDTO;
