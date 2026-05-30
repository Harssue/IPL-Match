const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * Represents one match fixture in the IPL season.
 * Tracks toss, playing XI, scores, and result.
 */
const Fixture = sequelize.define('Fixture', {
  gameId:       { type: DataTypes.STRING, allowNull: false },   // UUID from auction DB
  matchNumber:  { type: DataTypes.INTEGER, allowNull: false },
  homeTeamId:   { type: DataTypes.INTEGER, allowNull: false },
  awayTeamId:   { type: DataTypes.INTEGER, allowNull: false },
  venue:        { type: DataTypes.STRING },

  // Lifecycle: scheduled → toss_done → xi_set → live → completed
  status: {
    type: DataTypes.ENUM('scheduled', 'toss_done', 'xi_set', 'live', 'completed'),
    defaultValue: 'scheduled',
  },

  // Toss
  tossWinnerId: { type: DataTypes.INTEGER },
  tossChoice:   { type: DataTypes.STRING }, // 'bat' | 'bowl'

  // Playing XIs (JSON arrays of player IDs)
  homePlayingXI: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('homePlayingXI') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('homePlayingXI', JSON.stringify(v ?? [])); },
  },
  homeImpactSub: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('homeImpactSub') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('homeImpactSub', JSON.stringify(v ?? [])); },
  },
  awayPlayingXI: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('awayPlayingXI') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('awayPlayingXI', JSON.stringify(v ?? [])); },
  },
  awayImpactSub: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
    get() {
      try { return JSON.parse(this.getDataValue('awayImpactSub') || '[]'); }
      catch { return []; }
    },
    set(v) { this.setDataValue('awayImpactSub', JSON.stringify(v ?? [])); },
  },

  // Scores
  homeScore:   { type: DataTypes.INTEGER, defaultValue: 0 },
  awayScore:   { type: DataTypes.INTEGER, defaultValue: 0 },
  homeWickets: { type: DataTypes.INTEGER, defaultValue: 0 },
  awayWickets: { type: DataTypes.INTEGER, defaultValue: 0 },
  homeOvers:   { type: DataTypes.FLOAT, defaultValue: 0 },
  awayOvers:   { type: DataTypes.FLOAT, defaultValue: 0 },

  // Result
  winnerId:    { type: DataTypes.INTEGER },
  matchResult: { type: DataTypes.STRING }, // human-readable e.g. "CSK won by 45 runs"

  // Is this a playoff fixture?
  isPlayoff:     { type: DataTypes.BOOLEAN, defaultValue: false },
  playoffRound:  { type: DataTypes.STRING }, // 'Q1' | 'Eliminator' | 'Q2' | 'Final'
}, { tableName: 'fixtures', timestamps: true });

module.exports = Fixture;
