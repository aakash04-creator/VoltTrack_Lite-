const sequelize = require('../config/db');
const Meter = require('./Meter');
const Reading = require('./Reading');

Meter.hasMany(Reading, {
  foreignKey: { name: 'meterId', allowNull: false },
  onDelete: 'CASCADE',
  hooks: true
});
Reading.belongsTo(Meter, {
  foreignKey: { name: 'meterId', allowNull: false }
});

module.exports = { sequelize, Meter, Reading };
