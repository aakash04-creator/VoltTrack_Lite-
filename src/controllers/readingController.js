const { UniqueConstraintError, ValidationError } = require('sequelize');
const { Meter, Reading } = require('../models');

exports.createReading = async (req, res, next) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) return res.status(404).json({ message: 'Meter not found' });

    const reading = await Reading.create({ ...req.body, meterId: meter.id });
    res.status(201).json(reading);
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return next(Object.assign(new Error('A reading already exists for this meter and month'), { status: 409 }));
    }
    if (error instanceof ValidationError) {
      return next(Object.assign(new Error(error.message), { status: 400 }));
    }
    next(error);
  }
};

exports.getReadings = async (req, res) => {
  const meter = await Meter.findByPk(req.params.id);
  if (!meter) return res.status(404).json({ message: 'Meter not found' });
  const readings = await Reading.findAll({
    where: { meterId: meter.id },
    order: [['readingMonth', 'ASC']]
  });
  res.json(readings);
};

exports.deleteReading = async (req, res) => {
  const reading = await Reading.findByPk(req.params.id);
  if (!reading) return res.status(404).json({ message: 'Reading not found' });
  await reading.destroy();
  res.status(204).end();
};
