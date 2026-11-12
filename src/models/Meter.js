const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Meter = sequelize.define('Meter', {
  meterNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  consumerName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  connectionType: {
    type: DataTypes.ENUM('residential', 'commercial', 'industrial'),
    allowNull: false
  }
});

module.exports = Meter;
