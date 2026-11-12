const express = require('express');
const readingController = require('../controllers/readingController');
const { readingIdParam } = require('../validators/readingValidators');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.delete('/:id', readingIdParam, validate, asyncHandler(readingController.deleteReading));

module.exports = router;
