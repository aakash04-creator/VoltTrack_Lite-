const { body, param } = require('express-validator');

const connectionTypes = ['residential', 'commercial', 'industrial'];

const meterIdParam = [
  param('id').isInt({ min: 1 }).withMessage('Meter id must be a positive integer')
];

const createMeter = [
  body('meterNumber').trim().notEmpty().withMessage('meterNumber is required'),
  body('connectionType').isIn(connectionTypes).withMessage('connectionType must be residential, commercial, or industrial'),
  body('consumerName').optional({ nullable: true }).isString(),
  body('address').optional({ nullable: true }).isString()
];

const updateMeter = [
  ...meterIdParam,
  body().custom((value) => {
    if (!value || !['meterNumber', 'consumerName', 'address', 'connectionType'].some((key) => key in value)) {
      throw new Error('Provide at least one meter field to update');
    }
    return true;
  }),
  body('meterNumber').optional().trim().notEmpty(),
  body('connectionType').optional().isIn(connectionTypes),
  body('consumerName').optional({ nullable: true }).isString(),
  body('address').optional({ nullable: true }).isString()
];

module.exports = { meterIdParam, createMeter, updateMeter };
