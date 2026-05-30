const sequelize = require('../database');
const Fixture     = require('./Fixture');
const MatchInnings = require('./MatchInnings');
const MatchEvent  = require('./MatchEvent');

// Associations
Fixture.hasMany(MatchInnings, { foreignKey: 'fixtureId', as: 'Innings' });
MatchInnings.belongsTo(Fixture, { foreignKey: 'fixtureId', as: 'Fixture' });

MatchInnings.hasMany(MatchEvent, { foreignKey: 'inningsId', as: 'Events' });
MatchEvent.belongsTo(MatchInnings, { foreignKey: 'inningsId', as: 'Innings' });

module.exports = { sequelize, Fixture, MatchInnings, MatchEvent };
