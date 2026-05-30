const express = require('express');
const router  = express.Router();
const { AGame, AGameTeam, ATeam, AUser, ASquad, APlayer } = require('../auctionDb');
const { Fixture, MatchInnings, MatchEvent } = require('../models');
const { generateDoubleRoundRobin } = require('../services/fixtureGenerator');
const { seedTestGame } = require('../services/testSeeder');
const { Op } = require('sequelize');

// ── GET /api/setup/games ─────────────────────────────────────────────
// Lists all auction games that have at least one squad entry (i.e. auction happened).
router.get('/games', async (req, res) => {
  try {
    const games = await AGame.findAll({
      order: [['createdAt', 'DESC']],
    });

    const result = await Promise.all(
      games.map(async (g) => {
        const gameTeams = await AGameTeam.findAll({
          where: { gameId: g.id },
          include: [
            { model: ATeam, as: 'Team' },
            { model: AUser, as: 'User' },
          ],
        });

        // Count total squad players for this game
        const squadCount = await ASquad.count({ where: { gameId: g.id } });

        return {
          id:         g.id,
          lobbyCode:  g.lobbyCode,
          status:     g.status,
          squadCount,
          gameTeams: gameTeams.map((gt) => ({
            id:            gt.id,
            teamId:        gt.teamId,
            isAI:          gt.isAI,
            squadSize:     gt.squadSize,
            overseasCount: gt.overseasCount,
            team: gt.Team ? {
              id:            gt.Team.id,
              name:          gt.Team.name,
              shortName:     gt.Team.shortName,
              primaryColor:  gt.Team.primaryColor,
              secondaryColor:gt.Team.secondaryColor,
              city:          gt.Team.city,
              logoInitials:  gt.Team.logoInitials,
            } : null,
            user: gt.User ? { id: gt.User.id, username: gt.User.username } : null,
          })),
        };
      })
    );

    // Only show games that have squad data (auction happened)
    const playable = result.filter((g) => g.squadCount > 0);

    res.json({ games: playable });
  } catch (err) {
    console.error('[setup/games]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/setup/init ─────────────────────────────────────────────
// Creates fixtures for the chosen auction game (idempotent).
router.post('/init', async (req, res) => {
  try {
    const { auctionGameId, userGameTeamId } = req.body;
    if (!auctionGameId || !userGameTeamId) {
      return res.status(400).json({ error: 'auctionGameId and userGameTeamId required' });
    }

    // Set the chosen GameTeam as Human (isAI = false)
    await AGameTeam.update(
      { isAI: false },
      { where: { id: userGameTeamId } }
    );

    // Idempotency check
    const existing = await Fixture.count({ where: { gameId: auctionGameId } });
    if (existing > 0) {
      return res.json({ success: true, fixturesCreated: existing, alreadyExists: true });
    }

    // Load all game teams + their franchise teams
    const gameTeams = await AGameTeam.findAll({
      where: { gameId: auctionGameId },
      include: [{ model: ATeam, as: 'Team' }],
    });

    if (gameTeams.length < 2) {
      return res.status(400).json({ error: 'Not enough teams in this game' });
    }

    const teams = gameTeams.map((gt) => ({ id: gt.teamId }));
    const fixtures = generateDoubleRoundRobin(teams, auctionGameId);
    await Fixture.bulkCreate(fixtures);

    res.json({ success: true, fixturesCreated: fixtures.length });
  } catch (err) {
    console.error('[setup/init]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/setup/squad/:gameTeamId ─────────────────────────────────
// Returns full squad for a GameTeam (from auction DB).
router.get('/squad/:gameTeamId', async (req, res) => {
  try {
    const squad = await ASquad.findAll({
      where: { gameTeamId: req.params.gameTeamId },
      include: [{ model: APlayer, as: 'Player' }],
    });

    res.json({
      squad: squad.map((s) => ({
        squadId:   s.id,
        playerId:  s.playerId,
        soldPrice: s.soldPrice,
        player: s.Player ? {
          id:           s.Player.id,
          name:         s.Player.name,
          role:         s.Player.role,
          nationality:  s.Player.nationality,
          battingStyle: s.Player.battingStyle,
          bowlingStyle: s.Player.bowlingStyle,
          basePrice:    s.Player.basePrice,
        } : null,
      })),
    });
  } catch (err) {
    console.error('[setup/squad]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/setup/seed-test ─────────────────────────────────────────
// Creates a full test game with 10 IPL teams + 25 random players each.
// No auction required — seeded directly into the DB.
router.post('/seed-test', async (req, res) => {
  try {
    const result = await seedTestGame();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[setup/seed-test]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/setup/game-by-code/:code ────────────────────────────────
router.get('/game-by-code/:code', async (req, res) => {
  try {
    const game = await AGame.findOne({
      where: { lobbyCode: req.params.code.toUpperCase() },
    });
    if (!game) return res.status(404).json({ error: 'Game not found. Check the lobby code.' });

    const gameTeams = await AGameTeam.findAll({
      where: { gameId: game.id },
      include: [
        { model: ATeam, as: 'Team' },
        { model: AUser, as: 'User' },
      ],
    });
    const squadCount = await ASquad.count({ where: { gameId: game.id } });

    res.json({
      id:        game.id,
      lobbyCode: game.lobbyCode,
      status:    game.status,
      squadCount,
      gameTeams: gameTeams.map((gt) => ({
        id:            gt.id,
        teamId:        gt.teamId,
        isAI:          gt.isAI,
        squadSize:     gt.squadSize,
        overseasCount: gt.overseasCount,
        team: gt.Team ? {
          id:            gt.Team.id,
          name:          gt.Team.name,
          shortName:     gt.Team.shortName,
          primaryColor:  gt.Team.primaryColor,
          secondaryColor:gt.Team.secondaryColor,
          city:          gt.Team.city,
          logoInitials:  gt.Team.logoInitials || gt.Team.shortName,
        } : null,
        user: gt.User ? { id: gt.User.id, username: gt.User.username } : null,
      })),
    });
  } catch (err) {
    console.error('[setup/game-by-code]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/setup/clear-all ───────────────────────────────────────
// Deletes all games, game teams, squads, players created for those squads,
// and all match fixtures, innings, and events.
router.post('/clear-all', async (req, res) => {
  try {
    const games = await AGame.findAll();
    const gameIds = games.map((g) => g.id);

    if (gameIds.length > 0) {
      // Find all player IDs in squads of these games to delete them
      const squads = await ASquad.findAll({
        where: { gameId: { [Op.in]: gameIds } },
      });
      const playerIds = squads.map((s) => s.playerId).filter(Boolean);

      // Delete squads
      await ASquad.destroy({
        where: { gameId: { [Op.in]: gameIds } },
      });

      // Delete players created for these squads
      if (playerIds.length > 0) {
        await APlayer.destroy({
          where: { id: { [Op.in]: playerIds } },
        });
      }

      // Delete game teams
      await AGameTeam.destroy({
        where: { gameId: { [Op.in]: gameIds } },
      });

      // Delete games
      await AGame.destroy({
        where: { id: { [Op.in]: gameIds } },
      });

      // Delete match-specific rows (Fixtures, Innings, Events)
      const fixtures = await Fixture.findAll({
        where: { gameId: { [Op.in]: gameIds.map(String) } },
      });
      const fixtureIds = fixtures.map((f) => f.id);

      if (fixtureIds.length > 0) {
        const innings = await MatchInnings.findAll({
          where: { fixtureId: { [Op.in]: fixtureIds } },
        });
        const inningsIds = innings.map((inn) => inn.id);

        if (inningsIds.length > 0) {
          await MatchEvent.destroy({
            where: { inningsId: { [Op.in]: inningsIds } },
          });
          await MatchInnings.destroy({
            where: { id: { [Op.in]: inningsIds } },
          });
        }

        await Fixture.destroy({
          where: { id: { [Op.in]: fixtureIds } },
        });
      }
    }

    res.json({ success: true, message: 'All game rooms cleared successfully.' });
  } catch (err) {
    console.error('[setup/clear-all]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
