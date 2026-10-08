const asyncHandler = require('../utils/asyncHandler');
const HelpArticle = require('../models/HelpArticle');
const { escapeRegExp } = require('../utils/sanitize');

// @desc    Get help articles / FAQs
// @route   GET /api/v1/help/articles
// @access  Public / Private
const getHelpArticles = asyncHandler(async (req, res) => {
  const { category, search } = req.query;

  const query = { isPublished: true };

  if (category) query.category = category;
  if (search) {
    const escaped = escapeRegExp(String(search).trim());
    query.$or = [
      { title: { $regex: escaped, $options: 'i' } },
      { content: { $regex: escaped, $options: 'i' } },
      { tags: { $in: [String(search).trim().toLowerCase()] } },
    ];
  }

  const articles = await HelpArticle.find(query).sort('-viewCount -createdAt');

  res.json({
    success: true,
    data: articles,
  });
});

// @desc    Get single article and increment view count
// @route   GET /api/v1/help/articles/:id
// @access  Public / Private
const getHelpArticleById = asyncHandler(async (req, res) => {
  const article = await HelpArticle.findById(req.params.id);

  if (!article || !article.isPublished) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  article.viewCount += 1;
  await article.save();

  res.json({
    success: true,
    data: article,
  });
});

module.exports = {
  getHelpArticles,
  getHelpArticleById,
};
