const { UniqueConstraintError } = require('sequelize');
const { Meter } = require('../models');

function handleDatabaseError(error, next) {
  if (error instanceof UniqueConstraintError) {
    return next(Object.assign(new Error('A meter with this meterNumber already exists'), { status: 409 }));
  }
  next(error);
}

exports.createMeter = async (req, res, next) => {
  try {
    const meter = await Meter.create(req.body);
    res.status(201).json(meter);
  } catch (error) {
    handleDatabaseError(error, next);
  }
};

exports.getMeters = async (req, res) => {
  const meters = await Meter.findAll({ order: [['id', 'ASC']] });
  res.json(meters);
};

exports.getMeter = async (req, res) => {
  const meter = await Meter.findByPk(req.params.id);
  if (!meter) return res.status(404).json({ message: 'Meter not found' });
  res.json(meter);
};

exports.updateMeter = async (req, res, next) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) return res.status(404).json({ message: 'Meter not found' });
    await meter.update(req.body);
    res.json(meter);
  } catch (error) {
    handleDatabaseError(error, next);
  }
};

exports.deleteMeter = async (req, res) => {
  const meter = await Meter.findByPk(req.params.id);
  if (!meter) return res.status(404).json({ message: 'Meter not found' });
  await meter.destroy();
  res.status(204).end();
};
