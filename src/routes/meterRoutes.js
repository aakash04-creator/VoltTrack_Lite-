const express = require('express');
const meterController = require('../controllers/meterController');
const { meterIdParam, createMeter, updateMeter } = require('../validators/meterValidators');
const { createReading, meterIdParam: readingMeterIdParam } = require('../validators/readingValidators');
const readingController = require('../controllers/readingController');
const validate = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/', createMeter, validate, asyncHandler(meterController.createMeter));
router.get('/', asyncHandler(meterController.getMeters));
router.get('/:id', meterIdParam, validate, asyncHandler(meterController.getMeter));
router.put('/:id', updateMeter, validate, asyncHandler(meterController.updateMeter));
router.delete('/:id', meterIdParam, validate, asyncHandler(meterController.deleteMeter));
router.post('/:id/readings', createReading, validate, asyncHandler(readingController.createReading));
router.get('/:id/readings', readingMeterIdParam, validate, asyncHandler(readingController.getReadings));

module.exports = router;
