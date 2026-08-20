const express = require('express');
const router = express.Router();
const { autocompleteTags } = require('../controllers/tagController');

// GET /api/tags/autocomplete?q=
router.get('/autocomplete', autocompleteTags);

module.exports = router;
