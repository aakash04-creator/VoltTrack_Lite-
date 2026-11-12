const { body, param } = require('express-validator');

const meterIdParam = [
  param('id').isInt({ min: 1 }).withMessage('Meter id must be a positive integer')
];

const readingIdParam = [
  param('id').isInt({ min: 1 }).withMessage('Reading id must be a positive integer')
];

const createReading = [
  ...meterIdParam,
  body('readingMonth')
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage('readingMonth must use YYYY-MM format'),
  body('unitsConsumed').isFloat({ min: 0 }).withMessage('unitsConsumed must be zero or greater'),
  body('readingValue').isFloat().withMessage('readingValue must be a number')
];

module.exports = { meterIdParam, readingIdParam, createReading };
