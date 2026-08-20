const asyncHandler = require('../utils/asyncHandler');
const Tag = require('../models/Tag');
const { normalizeTag } = require('../utils/tagUtils');

// Helper to escape regex special characters
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// @desc    Autocomplete tags by prefix search
// @route   GET /api/tags/autocomplete?q=
// @access  Public / Private
const autocompleteTags = asyncHandler(async (req, res) => {
  const rawQuery = req.query.q || req.query.query || req.query.tag || '';
  const cleanQuery = rawQuery.trim();

  let filter = {};

  if (cleanQuery) {
    // Attempt tag normalization for clean slug comparison or fallback to clean string
    const normalized = normalizeTag(cleanQuery);
    const searchTerm = normalized && normalized.slug ? normalized.slug : cleanQuery.toLowerCase();
    const escapedTerm = escapeRegex(searchTerm);

    // Prefix match on slug or name
    filter = {
      $or: [
        { slug: { $regex: new RegExp('^' + escapedTerm, 'i') } },
        { name: { $regex: new RegExp('^' + escapeRegex(cleanQuery), 'i') } },
      ],
    };
  }

  // Tenant scoping optional if collegeId filter provided
  if (req.user?.collegeId) {
    filter.$and = [
      { $or: filter.$or },
      { $or: [{ collegeId: req.user.collegeId }, { collegeId: null }] },
    ];
    delete filter.$or;
  }

  const tags = await Tag.find(filter).sort({ usageCount: -1, slug: 1 }).limit(10).lean();

  res.json({
    success: true,
    count: tags.length,
    data: tags,
  });
});

module.exports = {
  autocompleteTags,
};
