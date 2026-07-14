const asyncHandler = require('express-async-handler');
const Book = require('../../models/Book');
const EResource = require('../../models/EResource');

// @desc    Advanced Search across physical books
// @route   GET /api/dashboards/general/search
// @access  Public
const searchPublicCatalog = asyncHandler(async (req, res) => {
  const { keyword, category, author } = req.query;

  const query = {};

  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: 'i' } },
      { description: { $regex: keyword, $options: 'i' } },
    ];
  }

  if (category) {
    query.category = { $regex: category, $options: 'i' };
  }

  if (author) {
    query.author = { $regex: author, $options: 'i' };
  }

  const books = await Book.find(query).limit(50);

  res.json({
    success: true,
    data: books,
    count: books.length,
  });
});

// @desc    Get public access E-Resources
// @route   GET /api/dashboards/general/eresources
// @access  Public
const getPublicEResources = asyncHandler(async (req, res) => {
  // Only return resources meant for public viewing
  const resources = await EResource.find({ accessLevel: 'public', status: 'approved' }).limit(50);

  res.json({
    success: true,
    data: resources,
    count: resources.length,
  });
});

// @desc    Get General Dashboard summary data
// @route   GET /api/dashboards/general/summary
// @access  Public
const getGeneralDashboardSummary = asyncHandler(async (req, res) => {
  const totalCatalogBooks = await Book.countDocuments();
  const publicResources = await EResource.countDocuments({
    accessLevel: 'public',
    status: 'approved',
  });

  res.json({
    success: true,
    data: {
      totalCatalogBooks,
      publicResources,
      libraryHours: '8:00 AM - 10:00 PM',
      announcements: 'Welcome to BookBuddy Open Catalog.',
    },
  });
});

module.exports = {
  searchPublicCatalog,
  getPublicEResources,
  getGeneralDashboardSummary,
};
