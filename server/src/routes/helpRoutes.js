const express = require('express');
const router = express.Router();
const { getHelpArticles, getHelpArticleById } = require('../controllers/helpController');

router.get('/articles', getHelpArticles);
router.get('/articles/:id', getHelpArticleById);

module.exports = router;
