const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * One innings in a fixture.
 * Tracks all batting state: score, wickets, current batsmen, impact sub.
 */
const MatchInnings = sequelize.define('MatchInnings', {
  fixtureId:     { type: DataTypes.INTEGER, allowNull: false },
  inningsNumber: { type: DataTypes.INTEGER, allowNull: false }, // 1 or 2

  battingTeamId: { type: DataTypes.INTEGER, allowNull: false },
  bowlingTeamId: { type: DataTypes.INTEGER, allowNull: false },

  // Running totals
  totalRuns:    { type: DataTypes.INTEGER, defaultValue: 0 },
  totalWickets: { type: DataTypes.INTEGER, defaultValue: 0 },
  totalBalls:   { type: DataTypes.INTEGER, defaultValue: 0 },

  // Only set for innings 2
  target: { type: DataTypes.INTEGER },

  // Playing XI: ordered array of player IDs (batting order)
  playingXI: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('playingXI') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('playingXI', JSON.stringify(v ?? [])); },
  },

  // Impact sub state
  impactSubId: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('impactSubId') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('impactSubId', JSON.stringify(v ?? [])); },
  },
  impactSubUsed:     { type: DataTypes.BOOLEAN, defaultValue: false },
  impactSubPlayerId: { type: DataTypes.INTEGER },        // player who came on

  // Batting order pointers
  currentBatterIdx: { type: DataTypes.INTEGER, defaultValue: 0 },  // on-strike index in playingXI
  nonStrikerIdx:    { type: DataTypes.INTEGER, defaultValue: 1 },  // non-striker index in playingXI
  nextBatterIdx:    { type: DataTypes.INTEGER, defaultValue: 2 },  // next to come in

  status: {
    type: DataTypes.ENUM('in-progress', 'completed'),
    defaultValue: 'in-progress',
  },
}, { tableName: 'match_innings', timestamps: true });

module.exports = MatchInnings;
