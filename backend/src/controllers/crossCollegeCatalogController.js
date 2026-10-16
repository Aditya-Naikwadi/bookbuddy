const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const EResource = require('../models/EResource');
const { escapeRegExp } = require('../utils/sanitize');

// @desc    Get cross-college shareable catalog resources (query-level flag filtered)
// @route   GET /api/v1/catalog/cross-college OR GET /api/catalog/cross-college
// @access  Private
const getCrossCollegeCatalog = asyncHandler(async (req, res) => {
  const { q, type } = req.query;

  // ACCEPTANCE CRITERIA F6.3: The DB query itself MUST filter isShareableAcrossColleges: true
  // Never fetch broadly and filter in application code or client.
  const query = {
    isShareableAcrossColleges: true,
  };

  if (q && q.trim()) {
    const searchRegex = { $regex: escapeRegExp(q.trim()), $options: 'i' };
    query.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { category: searchRegex },
      { isbn: searchRegex },
    ];
  }

  let books = [];
  let eresources = [];

  const bookSelect =
    'title author category genre format copiesAvailable reservedCopies copiesTotal coverImage shelfLocation collegeId isShareableAcrossColleges createdAt isbn';

  if (!type || type === 'book') {
    books = await Book.find(query)
      .select(bookSelect)
      .populate('collegeId', 'name shortName code')
      .sort({ createdAt: -1 })
      .lean();
  }

  if (!type || type === 'eresource') {
    eresources = await EResource.find(query)
      .populate('collegeId', 'name shortName code')
      .sort({ createdAt: -1 })
      .lean();
  }

  res.json({
    success: true,
    data: {
      books,
      eresources,
      total: books.length + eresources.length,
    },
  });
});

module.exports = {
  getCrossCollegeCatalog,
};
