const mongoose = require('mongoose');
const Book = require('../models/Book');
const BookDTO = require('../dtos/BookDTO');

/**
 * Shared search function for catalog books supporting both authenticated/college-scoped
 * and public-eligible-only search.
 *
 * @param {Object} options
 * @param {string} [options.scope='college'] - 'college' | 'public'
 * @param {string|mongoose.Types.ObjectId} [options.collegeId] - Target college ID
 * @param {string} [options.q=''] - Search query keyword
 * @param {string} [options.category] - Genre/Category filter
 * @param {string} [options.format] - 'physical' | 'digital'
 * @param {string} [options.available] - Availability filter ('true' | 'Available')
 * @param {string} [options.sortBy='relevance'] - Sort criteria ('relevance' | 'title' | 'newest' | 'available')
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.limit=12] - Number of items per page
 * @returns {Promise<{ books: Array, pagination: Object }>}
 */
const searchCatalogBooks = async ({
  scope = 'college',
  collegeId = null,
  q = '',
  category,
  format,
  available,
  sortBy = 'relevance',
  page = 1,
  limit = 12,
}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 12));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};

  // SCOPE ENFORCEMENT:
  // Public scope: MUST strictly filter isShareableAcrossColleges: true
  // College-restricted items (isShareableAcrossColleges: false/null) are strictly excluded!
  if (scope === 'public') {
    filter.isShareableAcrossColleges = true;
    if (collegeId && mongoose.Types.ObjectId.isValid(String(collegeId))) {
      filter.collegeId = new mongoose.Types.ObjectId(collegeId);
    }
  } else {
    // College scope: Scoped to the specific college tenant
    if (collegeId && mongoose.Types.ObjectId.isValid(String(collegeId))) {
      filter.collegeId = new mongoose.Types.ObjectId(collegeId);
    }
  }

  // Text search on title, author, isbn, category
  const searchTerm = (q || '').trim();
  if (searchTerm) {
    const searchRegex = { $regex: searchTerm, $options: 'i' };
    filter.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { isbn: searchRegex },
      { category: searchRegex },
    ];
  }

  // Category filter
  if (category && category !== 'All' && category !== 'all') {
    filter.category = category;
  }

  // Format filter
  if (format && format !== 'All' && format !== 'all') {
    filter.format = format;
  }

  // Availability filter
  if (available === 'true' || available === 'Available' || available === 'available') {
    const availCondition = [{ copiesAvailable: { $gt: 0 } }, { availableCopies: { $gt: 0 } }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: availCondition }];
      delete filter.$or;
    } else {
      filter.$or = availCondition;
    }
  }

  // Sorting strategy
  let sortOption = { createdAt: -1 };
  if (sortBy === 'title') {
    sortOption = { title: 1 };
  } else if (sortBy === 'newest') {
    sortOption = { createdAt: -1 };
  } else if (sortBy === 'available') {
    sortOption = { copiesAvailable: -1 };
  }

  const [total, books] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter)
      .populate('collegeId', 'name shortName code')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    books: BookDTO.transformMany(books),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

module.exports = {
  searchCatalogBooks,
};
