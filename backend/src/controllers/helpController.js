const asyncHandler = require('../utils/asyncHandler');
const HelpArticle = require('../models/HelpArticle');

// @desc    Get help articles / FAQs
// @route   GET /api/v1/help/articles
// @access  Public / Private
const getHelpArticles = asyncHandler(async (req, res) => {
  const { category, search } = req.query;

  const query = { isPublished: true };

  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [search.toLowerCase()] } },
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
