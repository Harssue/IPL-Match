/**
 * Read-only connection to the existing auction database (ipl_auction.sqlite3).
 * IDs are UUID strings in this DB.
 */
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
require('dotenv').config();

const AUCTION_DB = path.resolve(
  __dirname,
  process.env.AUCTION_DB_PATH || '../../IPL/backend/ipl_auction.sqlite3'
);

const auctionSeq = new Sequelize({
  dialect: 'sqlite',
  storage: AUCTION_DB,
  logging: false,
});

// ── Read-only Models ──────────────────────────────────────────────────
// Note: IDs are UUID strings in this DB schema
const AGame = auctionSeq.define('Game', {
  id:          { type: DataTypes.STRING, primaryKey: true },
  lobbyCode:   { type: DataTypes.STRING(8) },
  status:      { type: DataTypes.STRING },
  hostUserId:  { type: DataTypes.STRING },
  maxPlayers:  { type: DataTypes.INTEGER },
}, { tableName: 'Games', timestamps: true });

const AUser = auctionSeq.define('User', {
  id:       { type: DataTypes.STRING, primaryKey: true },
  username: { type: DataTypes.STRING },
  email:    { type: DataTypes.STRING },
}, { tableName: 'Users', timestamps: true });

const ATeam = auctionSeq.define('Team', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:           { type: DataTypes.STRING },
  shortName:      { type: DataTypes.STRING(5) },
  primaryColor:   { type: DataTypes.STRING(10) },
  secondaryColor: { type: DataTypes.STRING(10) },
  city:           { type: DataTypes.STRING },
  logoInitials:   { type: DataTypes.STRING(5) },
}, { tableName: 'Teams', timestamps: true });

const APlayer = auctionSeq.define('Player', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:         { type: DataTypes.STRING },
  role:         { type: DataTypes.STRING },
  nationality:  { type: DataTypes.STRING },
  basePrice:    { type: DataTypes.INTEGER },
  battingStyle: { type: DataTypes.STRING },
  bowlingStyle: { type: DataTypes.STRING },
}, { tableName: 'Players', timestamps: true });

const AGameTeam = auctionSeq.define('GameTeam', {
  id:              { type: DataTypes.STRING, primaryKey: true },
  gameId:          { type: DataTypes.STRING },
  teamId:          { type: DataTypes.INTEGER },
  userId:          { type: DataTypes.STRING },
  isAI:            { type: DataTypes.BOOLEAN },
  purseRemaining:  { type: DataTypes.INTEGER },
  squadSize:       { type: DataTypes.INTEGER },
  overseasCount:   { type: DataTypes.INTEGER },
}, { tableName: 'GameTeams', timestamps: true });

const ASquad = auctionSeq.define('Squad', {
  id:          { type: DataTypes.STRING, primaryKey: true },
  gameId:      { type: DataTypes.STRING },
  gameTeamId:  { type: DataTypes.STRING },
  playerId:    { type: DataTypes.INTEGER },
  soldPrice:   { type: DataTypes.INTEGER },
}, { tableName: 'Squads', timestamps: true });

// ── Associations ──────────────────────────────────────────────────────
AGameTeam.belongsTo(ATeam, { foreignKey: 'teamId', as: 'Team' });
AGameTeam.belongsTo(AUser, { foreignKey: 'userId', as: 'User' });
ASquad.belongsTo(APlayer,   { foreignKey: 'playerId',   as: 'Player' });
ASquad.belongsTo(AGameTeam, { foreignKey: 'gameTeamId', as: 'GameTeam' });
AGame.hasMany(AGameTeam,    { foreignKey: 'gameId',     as: 'GameTeams' });

module.exports = { auctionSeq, AGame, AUser, ATeam, APlayer, AGameTeam, ASquad };
