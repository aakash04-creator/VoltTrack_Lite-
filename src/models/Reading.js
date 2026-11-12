const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Reading = sequelize.define('Reading', {
  readingMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
    validate: {
      is: /^\d{4}-(0[1-9]|1[0-2])$/
    }
  },
  unitsConsumed: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  readingValue: {
    type: DataTypes.FLOAT,
    allowNull: false
  }
}, {
  indexes: [{ unique: true, fields: ['meterId', 'readingMonth'] }]
});

module.exports = Reading;
