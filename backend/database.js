const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const MATCH_DB = path.resolve(__dirname, process.env.MATCH_DB_PATH || './match.sqlite3');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: MATCH_DB,
  logging: false,
});

module.exports = sequelize;
