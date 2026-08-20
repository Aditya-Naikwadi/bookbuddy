const asyncHandler = require('../utils/asyncHandler');
const Book = require('../models/Book');
const EResource = require('../models/EResource');

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
    const searchRegex = { $regex: q.trim(), $options: 'i' };
    query.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { category: searchRegex },
      { isbn: searchRegex },
    ];
  }

  let books = [];
  let eresources = [];

  if (!type || type === 'book') {
    books = await Book.find(query)
      .populate('collegeId', 'name shortName code')
      .lean();
  }

  if (!type || type === 'eresource') {
    eresources = await EResource.find(query)
      .populate('collegeId', 'name shortName code')
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
