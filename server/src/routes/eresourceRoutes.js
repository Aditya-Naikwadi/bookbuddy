const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/ebooks/' });

const {
  listInternalResources,
  submitEResource,
  getMySubmissions,
  updateProgress,
} = require('../controllers/eresourceController');

const { protect } = require('../middlewares/auth');
const scopeToTenant = require('../middlewares/scopeToTenant');
const validate = require('../middlewares/validate');
const { updateProgressSchema } = require('../validations/personalization.validation');

router.use(protect);
router.use(scopeToTenant);

router.get('/my-submissions', getMySubmissions);
router.post('/submit', upload.single('file'), submitEResource);

router.route('/').get(listInternalResources);
router.route('/:eresourceId/progress').post(validate(updateProgressSchema), updateProgress);

module.exports = router;
