const express = require('express');
const router = express.Router();
const { getCrossCollegeCatalog } = require('../controllers/crossCollegeCatalogController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getCrossCollegeCatalog);
router.get('/cross-college', getCrossCollegeCatalog);

module.exports = router;
