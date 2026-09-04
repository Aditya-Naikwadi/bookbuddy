/**
 * Presentation DTO for Book & UnifiedBook payload standardization
 * Guarantees canonical Book shape across all dashboards:
 * { _id, title, author, isbn, category, coverUrl, collegeId, totalCopies, availableCopies, availabilityStatus, addedAt }
 */
class BookDTO {
  static transform(book) {
    if (!book) return null;

    const raw = typeof book.toObject === 'function' ? book.toObject() : book;

    const totalCopies =
      raw.totalCopies !== undefined
        ? Number(raw.totalCopies)
        : raw.copiesTotal !== undefined
          ? Number(raw.copiesTotal)
          : 1;

    const availableCopies =
      raw.availableCopies !== undefined
        ? Number(raw.availableCopies)
        : raw.copiesAvailable !== undefined
          ? Number(raw.copiesAvailable)
          : 0;

    let availabilityStatus = raw.availabilityStatus;
    if (!availabilityStatus) {
      if (availableCopies > 0) {
        availabilityStatus = 'available';
      } else if (totalCopies > 0) {
        availabilityStatus = 'checked_out';
      } else {
        availabilityStatus = 'on_hold';
      }
    }

    const idStr = raw._id ? raw._id.toString() : raw.id ? String(raw.id) : null;
    const authorStr = raw.author || (Array.isArray(raw.authors) ? raw.authors.join(', ') : '');

    return {
      _id: idStr,
      id: idStr,
      title: raw.title || '',
      author: authorStr,
      authors: Array.isArray(raw.authors) ? raw.authors : authorStr ? [authorStr] : [],
      isbn: raw.isbn || (Array.isArray(raw.isbns) ? raw.isbns[0] : ''),
      isbns: Array.isArray(raw.isbns) ? raw.isbns : raw.isbn ? [raw.isbn] : [],
      category: raw.category || raw.genre || 'General',
      genre: raw.category || raw.genre || 'General',
      coverUrl: raw.coverUrl || raw.coverImageUrl || raw.coverImage || null,
      coverImageUrl: raw.coverUrl || raw.coverImageUrl || raw.coverImage || null,
      collegeId: raw.collegeId ? raw.collegeId.toString() : null,
      totalCopies,
      copiesTotal: totalCopies,
      availableCopies,
      copiesAvailable: availableCopies,
      availabilityStatus,
      description: raw.description || '',
      publishYear: raw.publishYear || raw.publicationYear || null,
      publicationYear: raw.publishYear || raw.publicationYear || null,
      shelfLocation: raw.shelfLocation || raw.location || 'Main Stacks',
      format: raw.format || 'physical',
      addedAt: raw.addedAt || raw.createdAt || new Date().toISOString(),
      createdAt: raw.createdAt || raw.addedAt || new Date().toISOString(),
    };
  }

  static transformMany(books) {
    if (!Array.isArray(books)) return [];
    return books.map((b) => BookDTO.transform(b));
  }
}

module.exports = BookDTO;
