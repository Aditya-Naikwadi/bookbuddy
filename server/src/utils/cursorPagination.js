/**
 * Helper utility to handle high-performance cursor-based pagination.
 * Avoids offset skipping and duplicates during concurrent updates.
 */
const cursorPagination = {
  /**
   * Decodes a base64 cursor string into a structured object.
   */
  decode: (cursorStr) => {
    if (!cursorStr) return null;
    try {
      const decoded = Buffer.from(cursorStr, 'base64').toString('ascii');
      const [sortValue, lastId] = decoded.split('_');
      return { sortValue, lastId };
    } catch (err) {
      return null;
    }
  },

  /**
   * Encodes a sort value and last document ID into a base64 cursor.
   */
  encode: (sortValue, lastId) => {
    if (!lastId) return null;
    const value = `${sortValue || ''}_${lastId}`;
    return Buffer.from(value).toString('base64');
  },

  /**
   * Appends cursor query constraints onto the Mongoose filter object.
   */
  apply: (filter, decodedCursor, sortBy) => {
    if (!decodedCursor) return filter;

    const { sortValue, lastId } = decodedCursor;

    if (sortBy === 'newest') {
      const cursorDate = new Date(Number(sortValue));
      filter.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: { $eq: cursorDate }, _id: { $lt: lastId } },
      ];
    } else if (sortBy === 'title') {
      filter.$or = [
        { title: { $gt: sortValue } },
        { title: { $eq: sortValue }, _id: { $gt: lastId } },
      ];
    } else if (sortBy === 'relevance' && filter.$text) {
      // For relevance, we'll sort by textScore descending
      const cursorScore = parseFloat(sortValue);
      filter.$or = [
        { score: { $lt: cursorScore } },
        { score: { $eq: cursorScore }, _id: { $lt: lastId } },
      ];
    }

    return filter;
  },
};

module.exports = cursorPagination;
