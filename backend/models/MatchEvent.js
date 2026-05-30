const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * A single ball delivery event.
 */
const MatchEvent = sequelize.define('MatchEvent', {
  inningsId:    { type: DataTypes.INTEGER, allowNull: false },
  ballNumber:   { type: DataTypes.INTEGER, allowNull: false }, // overall ball in innings (1-based)
  overNumber:   { type: DataTypes.INTEGER },  // 0-based over index
  ballInOver:   { type: DataTypes.INTEGER },  // 0-based ball within over

  batterFingers: { type: DataTypes.INTEGER },
  bowlerFingers: { type: DataTypes.INTEGER },

  isWicket:   { type: DataTypes.BOOLEAN, defaultValue: false },
  runsScored: { type: DataTypes.INTEGER, defaultValue: 0 },

  batterPlayerId: { type: DataTypes.INTEGER },
}, { tableName: 'match_events', timestamps: true });

module.exports = MatchEvent;
