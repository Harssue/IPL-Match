const express  = require('express');
const router   = express.Router();
const { Op }   = require('sequelize');
const { Fixture } = require('../models');
const { AGameTeam, ATeam } = require('../auctionDb');
const { simulateFullMatch } = require('../services/aiSimulator');

// ── Helper: build points table ────────────────────────────────────────
function buildPointsTable(fixtures, teamMap) {
  const standings = {};

  for (const teamId of Object.keys(teamMap)) {
    standings[teamId] = {
      teamId:       parseInt(teamId),
      team:         teamMap[teamId],
      played: 0, won: 0, lost: 0, tied: 0, nr: 0,
      points: 0,
      runsFor: 0, runsAgainst: 0, ballsFor: 0, ballsAgainst: 0,
      nrr: 0,
    };
  }

  function oversToLegalBalls(overs) {
    const o = parseFloat(overs) || 0;
    return Math.floor(o) * 6 + Math.round((o % 1) * 10);
  }

  for (const f of fixtures) {
    if (f.status !== 'completed') continue;
    const home = standings[f.homeTeamId];
    const away = standings[f.awayTeamId];
    if (!home || !away) continue;

    home.played++;
    away.played++;

    home.runsFor     += f.homeScore   || 0;
    home.runsAgainst += f.awayScore   || 0;
    home.ballsFor    += oversToLegalBalls(f.homeOvers);
    home.ballsAgainst+= oversToLegalBalls(f.awayOvers);

    away.runsFor     += f.awayScore   || 0;
    away.runsAgainst += f.homeScore   || 0;
    away.ballsFor    += oversToLegalBalls(f.awayOvers);
    away.ballsAgainst+= oversToLegalBalls(f.homeOvers);

    if (f.winnerId === f.homeTeamId) {
      home.won++; home.points += 2; away.lost++;
    } else if (f.winnerId === f.awayTeamId) {
      away.won++; away.points += 2; home.lost++;
    } else {
      home.tied++; home.points += 1;
      away.tied++; away.points += 1;
    }
  }

  for (const s of Object.values(standings)) {
    const rrFor     = s.ballsFor      > 0 ? (s.runsFor      / s.ballsFor)      * 6 : 0;
    const rrAgainst = s.ballsAgainst  > 0 ? (s.runsAgainst  / s.ballsAgainst)  * 6 : 0;
    s.nrr = parseFloat((rrFor - rrAgainst).toFixed(3));
  }

  return Object.values(standings).sort((a, b) =>
    b.points !== a.points ? b.points - a.points : b.nrr - a.nrr
  );
}

// ── GET /api/fixtures/:gameId ─────────────────────────────────────────
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    const [fixtures, gameTeams] = await Promise.all([
      Fixture.findAll({ where: { gameId }, order: [['matchNumber', 'ASC']] }),
      AGameTeam.findAll({ where: { gameId }, include: [{ model: ATeam, as: 'Team' }] }),
    ]);

    // Build teamId → team info map
    const teamMap = {};
    for (const gt of gameTeams) {
      if (gt.Team) {
        teamMap[gt.teamId] = {
          id:            gt.Team.id,
          name:          gt.Team.name,
          shortName:     gt.Team.shortName,
          primaryColor:  gt.Team.primaryColor,
          secondaryColor:gt.Team.secondaryColor,
          city:          gt.Team.city,
          logoInitials:  gt.Team.logoInitials,
          gameTeamId:    gt.id,
          userId:        gt.userId,
          isAI:          gt.isAI,
        };
      }
    }

    const fixturesRaw = fixtures.map((f) => ({
      ...f.toJSON(),
      homeTeam: teamMap[f.homeTeamId] || null,
      awayTeam: teamMap[f.awayTeamId] || null,
    }));

    const pointsTable = buildPointsTable(fixturesRaw, teamMap);

    // Check if league stage is complete (all non-playoff fixtures done)
    const leagueFixtures   = fixturesRaw.filter((f) => !f.isPlayoff);
    const leagueComplete   = leagueFixtures.length > 0 &&
      leagueFixtures.every((f) => f.status === 'completed');

    res.json({ fixtures: fixturesRaw, pointsTable, teamMap, leagueComplete });
  } catch (err) {
    console.error('[fixtures/get]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/fixtures/:gameId/simulate-ai ────────────────────────────
// Simulates AI matches up to (but not including) the user's next scheduled match.
router.post('/:gameId/simulate-ai', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userTeamId } = req.body;
    const userTeamIdInt = userTeamId ? parseInt(userTeamId) : null;

    // Find ALL scheduled non-playoff fixtures, ordered by matchNumber
    const allScheduled = await Fixture.findAll({
      where: { gameId, status: 'scheduled', isPlayoff: false },
      order: [['matchNumber', 'ASC']],
    });

    if (allScheduled.length === 0) {
      return res.json({ success: true, simulated: 0, message: 'No matches to simulate' });
    }

    // Load game teams to resolve franchise names and identify which teams are human vs AI
    const gameTeams = await AGameTeam.findAll({
      where: { gameId },
      include: [{ model: ATeam, as: 'Team' }],
    });
    const teamMap = {};
    const aiMap = {};
    for (const gt of gameTeams) {
      if (gt.Team) {
        teamMap[gt.teamId] = gt.Team.name;
        aiMap[gt.teamId] = gt.isAI; // true = AI, false = Human
      }
    }

    // Find the match number of the user's NEXT scheduled match
    let cutoffMatchNumber = null;
    if (userTeamIdInt) {
      const nextUserMatch = allScheduled.find(
        (f) => f.homeTeamId === userTeamIdInt || f.awayTeamId === userTeamIdInt
      );
      if (nextUserMatch) {
        cutoffMatchNumber = nextUserMatch.matchNumber;
      }
    }

    // Pick only true AI-vs-AI matches (both home and away are AI) that come BEFORE the user's next match
    const toSimulate = allScheduled.filter((f) => {
      // Must be a true AI vs AI match (both teams are AI-controlled)
      const homeIsAI = aiMap[f.homeTeamId] !== false; // default to true if not specified
      const awayIsAI = aiMap[f.awayTeamId] !== false; // default to true if not specified
      if (!homeIsAI || !awayIsAI) return false;

      // Do not simulate current user's own matches
      const isUserMatch = userTeamIdInt &&
        (f.homeTeamId === userTeamIdInt || f.awayTeamId === userTeamIdInt);
      if (isUserMatch) return false;

      // Do not simulate matches after the user's next scheduled match
      if (cutoffMatchNumber !== null && f.matchNumber > cutoffMatchNumber) return false;

      return true;
    });

    let simulated = 0;
    for (const fixture of toSimulate) {
      const result = simulateFullMatch(fixture.homeTeamId, fixture.awayTeamId);
      const winnerName = teamMap[result.winnerId] || 'Team';
      await fixture.update({ ...result, matchResult: `${winnerName} ${result.matchResult}` });
      simulated++;
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`lobby-${gameId}`).emit('lobby-update');
    }

    res.json({ success: true, simulated, nextUserMatchNumber: cutoffMatchNumber });
  } catch (err) {
    console.error('[fixtures/simulate-ai]', err);
    res.status(500).json({ error: err.message });
  }
});


// ── POST /api/fixtures/:gameId/create-playoffs ────────────────────────
// Creates 4 playoff fixtures (Q1, Eliminator, Q2, Final) from points table top-4.
router.post('/:gameId/create-playoffs', async (req, res) => {
  try {
    const { gameId } = req.params;

    // Check none exist
    const existing = await Fixture.count({ where: { gameId, isPlayoff: true } });
    if (existing > 0) {
      return res.json({ success: true, message: 'Playoffs already created' });
    }

    const [fixtures, gameTeams] = await Promise.all([
      Fixture.findAll({ where: { gameId, isPlayoff: false } }),
      AGameTeam.findAll({ where: { gameId }, include: [{ model: ATeam, as: 'Team' }] }),
    ]);

    const teamMap = {};
    for (const gt of gameTeams) {
      if (gt.Team) teamMap[gt.teamId] = { ...gt.Team.dataValues, gameTeamId: gt.id };
    }

    const fixturesRaw = fixtures.map((f) => f.toJSON());
    const table = buildPointsTable(fixturesRaw, teamMap);
    const top4  = table.slice(0, 4);

    if (top4.length < 4) {
      return res.status(400).json({ error: 'Need at least 4 teams in standings' });
    }

    const playoffFixtures = [
      // Q1: 1st vs 2nd (winner goes to Final directly)
      {
        gameId, matchNumber: 91, isPlayoff: true, playoffRound: 'Q1',
        homeTeamId: top4[0].teamId, awayTeamId: top4[1].teamId,
        venue: 'Narendra Modi Stadium, Ahmedabad', status: 'scheduled',
      },
      // Eliminator: 3rd vs 4th (loser eliminated)
      {
        gameId, matchNumber: 92, isPlayoff: true, playoffRound: 'Eliminator',
        homeTeamId: top4[2].teamId, awayTeamId: top4[3].teamId,
        venue: 'Eden Gardens, Kolkata', status: 'scheduled',
      },
      // Q2: Q1 Loser vs Eliminator Winner (winner goes to Final)
      {
        gameId, matchNumber: 93, isPlayoff: true, playoffRound: 'Q2',
        homeTeamId: 0, awayTeamId: 0,     // TBD after Q1 + Eliminator
        venue: 'Wankhede Stadium, Mumbai', status: 'scheduled',
      },
      // Final: Q1 Winner vs Q2 Winner
      {
        gameId, matchNumber: 94, isPlayoff: true, playoffRound: 'Final',
        homeTeamId: 0, awayTeamId: 0,
        venue: 'Narendra Modi Stadium, Ahmedabad', status: 'scheduled',
      },
    ];

    await Fixture.bulkCreate(playoffFixtures);
    const io = req.app.get('io');
    if (io) {
      io.to(`lobby-${gameId}`).emit('lobby-update');
    }

    res.json({ success: true, top4: top4.map((t) => t.team) });
  } catch (err) {
    console.error('[fixtures/create-playoffs]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/fixtures/:gameId/update-playoff-teams ──────────────────
// After Q1 + Eliminator complete, fill in Q2 team IDs.
router.post('/:gameId/update-playoff-teams', async (req, res) => {
  try {
    const { gameId } = req.params;

    const q1   = await Fixture.findOne({ where: { gameId, playoffRound: 'Q1' } });
    const elim = await Fixture.findOne({ where: { gameId, playoffRound: 'Eliminator' } });
    const q2   = await Fixture.findOne({ where: { gameId, playoffRound: 'Q2' } });
    const final = await Fixture.findOne({ where: { gameId, playoffRound: 'Final' } });

    if (!q1 || !elim || !q2 || !final) {
      return res.status(400).json({ error: 'Playoff fixtures not set up' });
    }

    if (q1.status === 'completed' && elim.status === 'completed') {
      const q1LoserTeamId  = q1.winnerId === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
      const elimWinnerId   = elim.winnerId;
      if (q2.homeTeamId === 0) {
        await q2.update({ homeTeamId: q1LoserTeamId, awayTeamId: elimWinnerId });
      }
    }

    if (q1.status === 'completed' && q2.status === 'completed') {
      const q2WinnerId = q2.winnerId;
      if (final.homeTeamId === 0) {
        await final.update({ homeTeamId: q1.winnerId, awayTeamId: q2WinnerId });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[fixtures/update-playoff-teams]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/fixtures/simulate/:fixtureId ──────────────────────────
// Simulates a single fixture (used for individual playoff matches).
router.post('/simulate/:fixtureId', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    if (fixture.status === 'completed') return res.json({ success: true, message: 'Already completed' });

    const [gameTeams] = await Promise.all([
      AGameTeam.findAll({ where: { gameId: fixture.gameId }, include: [{ model: ATeam, as: 'Team' }] }),
    ]);
    const teamMap = {};
    for (const gt of gameTeams) {
      if (gt.Team) teamMap[gt.teamId] = gt.Team.name;
    }

    const result = simulateFullMatch(fixture.homeTeamId, fixture.awayTeamId);
    const winnerName = teamMap[result.winnerId] || 'Team';
    await fixture.update({ ...result, matchResult: `${winnerName} ${result.matchResult}` });

    // Update playoff teams if Q1 or Eliminator just completed
    if (fixture.isPlayoff && ['Q1', 'Eliminator'].includes(fixture.playoffRound)) {
      const q1   = await Fixture.findOne({ where: { gameId: fixture.gameId, playoffRound: 'Q1' } });
      const elim = await Fixture.findOne({ where: { gameId: fixture.gameId, playoffRound: 'Eliminator' } });
      const q2   = await Fixture.findOne({ where: { gameId: fixture.gameId, playoffRound: 'Q2' } });
      const fin  = await Fixture.findOne({ where: { gameId: fixture.gameId, playoffRound: 'Final' } });

      if (q1?.status === 'completed' && elim?.status === 'completed' && q2 && q2.homeTeamId === 0) {
        const q1LoserTeamId = q1.winnerId === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
        await q2.update({ homeTeamId: q1LoserTeamId, awayTeamId: elim.winnerId });
      }
      if (q1?.status === 'completed' && q2?.status === 'completed' && fin && fin.homeTeamId === 0) {
        await fin.update({ homeTeamId: q1.winnerId, awayTeamId: q2.winnerId });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`lobby-${fixture.gameId}`).emit('lobby-update');
    }

    res.json({ success: true, fixture: (await fixture.reload()).toJSON() });
  } catch (err) {
    console.error('[fixtures/simulate/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
