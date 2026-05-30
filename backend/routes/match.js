/**
 * match.js — Core hand cricket match flow.
 *
 * Flow per user fixture:
 *   1. GET  /:fixtureId          — load fixture + innings state
 *   2. POST /:fixtureId/toss     — conduct coin toss (user picks heads/tails)
 *   3. POST /:fixtureId/playing-xi — confirm user's XI + impact sub; AI XI auto-selected
 *   4. POST /:fixtureId/start-innings — create innings record
 *   5. POST /:fixtureId/deliver  — bowl a ball (user picks fingers every time)
 *   6. POST /:fixtureId/impact-sub — optionally swap in impact sub player
 */

const express  = require('express');
const router   = express.Router();
const { Fixture, MatchInnings, MatchEvent } = require('../models');
const { AGameTeam, ATeam, ASquad, APlayer } = require('../auctionDb');
const { selectAIPlayingXI, selectAIImpactSub } = require('../services/aiPlaying11');
const { pick: aiPick } = require('../services/aiSimulator');

// ── Helpers ───────────────────────────────────────────────────────────

async function getSquadPlayers(gameTeamId) {
  const squad = await ASquad.findAll({
    where: { gameTeamId },
    include: [{ model: APlayer, as: 'Player' }],
  });
  return squad.map((s) => ({
    id:           s.Player?.id,
    name:         s.Player?.name,
    role:         s.Player?.role,
    nationality:  s.Player?.nationality,
    battingStyle: s.Player?.battingStyle,
    bowlingStyle: s.Player?.bowlingStyle,
    basePrice:    s.Player?.basePrice,
    soldPrice:    s.soldPrice,
  })).filter((p) => p.id);
}

async function getGameTeamByTeamId(gameId, teamId) {
  return AGameTeam.findOne({
    where: { gameId, teamId },
    include: [{ model: ATeam, as: 'Team' }],
  });
}

function oversString(balls) {
  return parseFloat(`${Math.floor(balls / 6)}.${balls % 6}`);
}

// ── GET /api/match/:fixtureId ─────────────────────────────────────────
router.get('/:fixtureId', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId, {
      include: [
        {
          model: MatchInnings, as: 'Innings',
          include: [{ model: MatchEvent, as: 'Events', order: [['ballNumber', 'ASC']] }],
        },
      ],
    });
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const homeGT = await getGameTeamByTeamId(fixture.gameId, fixture.homeTeamId);
    const awayGT = await getGameTeamByTeamId(fixture.gameId, fixture.awayTeamId);

    const [homeSquad, awaySquad] = await Promise.all([
      homeGT ? getSquadPlayers(homeGT.id) : [],
      awayGT ? getSquadPlayers(awayGT.id) : [],
    ]);

    const toTeamObj = (gt) => gt ? {
      id:            gt.Team?.id,
      name:          gt.Team?.name,
      shortName:     gt.Team?.shortName,
      primaryColor:  gt.Team?.primaryColor,
      secondaryColor:gt.Team?.secondaryColor,
      logoInitials:  gt.Team?.logoInitials,
      gameTeamId:    gt.id,
      userId:        gt.userId,
      isAI:          gt.isAI,
    } : null;

    res.json({
      fixture:   fixture.toJSON(),
      homeTeam:  toTeamObj(homeGT),
      awayTeam:  toTeamObj(awayGT),
      homeSquad,
      awaySquad,
    });
  } catch (err) {
    console.error('[match/get]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/match/:fixtureId/toss ───────────────────────────────────
// Body: { call: 'heads'|'tails', userTeamId, choice: 'bat'|'bowl' }
// choice is only used when user wins toss.
router.post('/:fixtureId/toss', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId);
    if (!fixture)                        return res.status(404).json({ error: 'Fixture not found' });
    if (fixture.status !== 'scheduled')  return res.status(400).json({ error: 'Toss already conducted' });

    const { call, userTeamId, choice } = req.body;
    if (!['heads', 'tails'].includes(call)) return res.status(400).json({ error: 'call must be heads or tails' });
    if (!['bat', 'bowl'].includes(choice))  return res.status(400).json({ error: 'choice must be bat or bowl' });

    const result   = Math.random() < 0.5 ? 'heads' : 'tails';
    const userWon  = call === result;

    let tossWinnerId, tossChoice;
    if (userWon) {
      tossWinnerId = parseInt(userTeamId);
      tossChoice   = choice;
    } else {
      const otherTeamId = fixture.homeTeamId === parseInt(userTeamId)
        ? fixture.awayTeamId : fixture.homeTeamId;
      tossWinnerId = otherTeamId;
      tossChoice   = Math.random() < 0.5 ? 'bat' : 'bowl';
    }

    await fixture.update({ tossWinnerId, tossChoice, status: 'toss_done' });

    res.json({ result, userWon, tossWinnerId, tossChoice });
  } catch (err) {
    console.error('[match/toss]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/match/:fixtureId/playing-xi ────────────────────────────
// Body: { playerIds: number[], impactSubId: number, userTeamId, userGameTeamId }
router.post('/:fixtureId/playing-xi', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    if (!['toss_done', 'xi_set'].includes(fixture.status)) {
      return res.status(400).json({ error: 'Toss must be done first' });
    }

    const { playerIds, impactSubId, userTeamId, userGameTeamId } = req.body;

    if (!playerIds || playerIds.length !== 11) {
      return res.status(400).json({ error: 'Select exactly 11 players' });
    }

    // Validate overseas count
    const userSquad = await getSquadPlayers(userGameTeamId);
    const playerMap = Object.fromEntries(userSquad.map((p) => [p.id, p]));
    const overseasInXI = playerIds.filter((id) => playerMap[id]?.nationality === 'Overseas').length;
    if (overseasInXI > 4) {
      return res.status(400).json({ error: 'Max 4 overseas players allowed in Playing XI' });
    }

    const isHome = parseInt(userTeamId) === fixture.homeTeamId;
    const otherTeamId = isHome ? fixture.awayTeamId : fixture.homeTeamId;
    const otherGT = await getGameTeamByTeamId(fixture.gameId, otherTeamId);
    const isOtherAI = otherGT ? otherGT.isAI : true;

    const updates = {};
    if (isHome) {
      updates.homePlayingXI = playerIds;
      updates.homeImpactSub = impactSubId || null;
    } else {
      updates.awayPlayingXI = playerIds;
      updates.awayImpactSub = impactSubId || null;
    }

    let aiXIPlayers = [];
    let aiSubPlayer = null;

    if (isOtherAI) {
      // Build AI XI
      const aiSquad = otherGT ? await getSquadPlayers(otherGT.id) : [];
      const aiXI    = selectAIPlayingXI(aiSquad);
      const aiSub   = selectAIImpactSub(aiSquad, aiXI);

      if (isHome) {
        updates.awayPlayingXI = aiXI;
        updates.awayImpactSub = aiSub || null;
      } else {
        updates.homePlayingXI = aiXI;
        updates.homeImpactSub = aiSub || null;
      }
      updates.status = 'xi_set';

      const aiPlayerMap = Object.fromEntries(aiSquad.map((p) => [p.id, p]));
      aiXIPlayers = aiXI.map((id) => aiPlayerMap[id]).filter(Boolean);
      aiSubPlayer = aiSub ? aiPlayerMap[aiSub] : null;
    } else {
      // For Human vs Human, check if both have selected
      await fixture.update(updates);
      const updated = await Fixture.findByPk(fixture.id);
      
      const homeXI = updated.homePlayingXI;
      const awayXI = updated.awayPlayingXI;
      if (homeXI && homeXI.length === 11 && awayXI && awayXI.length === 11) {
        updates.status = 'xi_set';
      }
    }

    await fixture.update(updates);

    res.json({ success: true, aiPlayingXI: aiXIPlayers, aiImpactSub: aiSubPlayer });
  } catch (err) {
    console.error('[match/playing-xi]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/match/:fixtureId/start-innings ─────────────────────────
// Body: { userTeamId }
router.post('/:fixtureId/start-innings', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId, {
      include: [{ model: MatchInnings, as: 'Innings' }],
    });
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const completed = (fixture.Innings || []).filter((i) => i.status === 'completed');
    const inningsNumber = completed.length + 1;
    if (inningsNumber > 2) return res.status(400).json({ error: 'Both innings already played' });

    // Resolve batting / bowling teams
    const tossWinner    = fixture.tossWinnerId;
    const tossChoice    = fixture.tossChoice;
    const homeWinsToss  = tossWinner === fixture.homeTeamId;
    const homeBatsFirst = (homeWinsToss && tossChoice === 'bat') ||
                          (!homeWinsToss && tossChoice === 'bowl');

    let battingTeamId, bowlingTeamId;
    if (inningsNumber === 1) {
      battingTeamId = homeBatsFirst ? fixture.homeTeamId : fixture.awayTeamId;
      bowlingTeamId = homeBatsFirst ? fixture.awayTeamId : fixture.homeTeamId;
    } else {
      battingTeamId = homeBatsFirst ? fixture.awayTeamId : fixture.homeTeamId;
      bowlingTeamId = homeBatsFirst ? fixture.homeTeamId : fixture.awayTeamId;
    }

    // Assign playing XI + impact sub based on which team is batting
    let playingXI, impactSubId;
    if (battingTeamId === fixture.homeTeamId) {
      playingXI   = fixture.homePlayingXI;
      impactSubId = fixture.homeImpactSub;
    } else {
      playingXI   = fixture.awayPlayingXI;
      impactSubId = fixture.awayImpactSub;
    }

    const target = inningsNumber === 2
      ? (completed[0]?.totalRuns ?? 0) + 1
      : null;

    const innings = await MatchInnings.create({
      fixtureId:    fixture.id,
      inningsNumber,
      battingTeamId,
      bowlingTeamId,
      playingXI,
      impactSubId,
      target,
      currentBatterIdx: 0,
      nonStrikerIdx:    1,
      nextBatterIdx:    2,
    });

    if (['xi_set', 'toss_done'].includes(fixture.status)) {
      await fixture.update({ status: 'live' });
    }

    res.json({ success: true, innings: innings.toJSON() });
  } catch (err) {
    console.error('[match/start-innings]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/match/:fixtureId/deliver ───────────────────────────────
// Body: { fingers: 1|2|3|4|6, userTeamId }
//
// Batter & bowler both pick from {1,2,3,4,6}.
// User always provides their number; CPU always randomises.
// If user bats → user=batter, cpu=bowler.
// If user bowls → user=bowler, cpu=batter.
// Same number → WICKET. Different → batter's number added as runs.
router.post('/:fixtureId/deliver', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId);
    if (!fixture || fixture.status !== 'live') {
      return res.status(400).json({ error: 'Match is not live' });
    }

    const { fingers, userTeamId } = req.body;
    if (![1, 2, 3, 4, 6].includes(parseInt(fingers))) {
      return res.status(400).json({ error: 'fingers must be 1, 2, 3, 4, or 6' });
    }

    const innings = await MatchInnings.findOne({
      where: { fixtureId: fixture.id, status: 'in-progress' },
      order: [['inningsNumber', 'DESC']],
    });
    if (!innings) return res.status(400).json({ error: 'No active innings' });

    const isUserBatting = innings.battingTeamId === parseInt(userTeamId);
    const cpuFingers    = aiPick();
    const userFingers   = parseInt(fingers);

    const batterFingers = isUserBatting ? userFingers : cpuFingers;
    const bowlerFingers = isUserBatting ? cpuFingers  : userFingers;

    const isWicket  = batterFingers === bowlerFingers;
    const runsScored = isWicket ? 0 : batterFingers;

    const ballNumber  = innings.totalBalls + 1;
    const overNumber  = Math.floor(innings.totalBalls / 6);
    const ballInOver  = innings.totalBalls % 6;

    const currentBatterPlayerId = innings.playingXI[innings.currentBatterIdx] || null;

    // Persist event
    await MatchEvent.create({
      inningsId:      innings.id,
      ballNumber,
      overNumber,
      ballInOver,
      batterFingers,
      bowlerFingers,
      isWicket,
      runsScored,
      batterPlayerId: currentBatterPlayerId,
    });

    // Update innings counters
    let newRuns     = innings.totalRuns    + runsScored;
    let newWickets  = innings.totalWickets + (isWicket ? 1 : 0);
    let newBalls    = innings.totalBalls   + 1;
    let newBatterIdx = innings.currentBatterIdx;
    let newNonStrikerIdx = innings.nonStrikerIdx;
    let newNextIdx   = innings.nextBatterIdx;

    if (isWicket) {
      // Next batsman comes in
      newBatterIdx = innings.nextBatterIdx;
      newNextIdx   = innings.nextBatterIdx + 1;
    }

    // Striker and non-striker exchange positions at the end of each over
    if (newBalls > 0 && newBalls % 6 === 0) {
      const temp = newBatterIdx;
      newBatterIdx = newNonStrikerIdx;
      newNonStrikerIdx = temp;
    }

    // Innings end conditions
    const targetReached = innings.target !== null && newRuns >= innings.target;
    const inningsComplete = newWickets >= 10 || newBalls >= 120 || targetReached;

    await innings.update({
      totalRuns:       newRuns,
      totalWickets:    newWickets,
      totalBalls:      newBalls,
      currentBatterIdx: newBatterIdx,
      nonStrikerIdx:    newNonStrikerIdx,
      nextBatterIdx:    newNextIdx,
      status:          inningsComplete ? 'completed' : 'in-progress',
    });

    const overs = oversString(newBalls);
    const isHome = innings.battingTeamId === fixture.homeTeamId;

    let matchComplete = false;
    let winnerId      = null;
    let matchResult   = null;

    if (inningsComplete) {
      if (innings.inningsNumber === 1) {
        // Store innings 1 score on fixture
        await fixture.update({
          homeScore:    isHome ? newRuns    : fixture.homeScore,
          awayScore:    isHome ? fixture.awayScore : newRuns,
          homeWickets:  isHome ? newWickets : fixture.homeWickets,
          awayWickets:  isHome ? fixture.awayWickets : newWickets,
          homeOvers:    isHome ? overs      : fixture.homeOvers,
          awayOvers:    isHome ? fixture.awayOvers : overs,
        });
      } else {
        // Match complete — determine winner
        matchComplete = true;
        const inn1 = await MatchInnings.findOne({
          where: { fixtureId: fixture.id, inningsNumber: 1 },
        });
        const inn1Runs = inn1?.totalRuns ?? 0;

        if (targetReached) {
          winnerId    = innings.battingTeamId;
          const wkts  = 10 - newWickets;
          matchResult = `won by ${wkts} wicket${wkts !== 1 ? 's' : ''}`;
        } else {
          winnerId    = innings.bowlingTeamId;
          const diff  = inn1Runs - newRuns;
          matchResult = `won by ${diff} run${diff !== 1 ? 's' : ''}`;
        }

        // Fetch winner team name for display
        const winnerGT = await AGameTeam.findOne({
          where: { gameId: fixture.gameId, teamId: winnerId },
          include: [{ model: ATeam, as: 'Team' }],
        });
        const fullResult = `${winnerGT?.Team?.name ?? 'Team'} ${matchResult}`;

        await fixture.update({
          homeScore:    isHome ? newRuns    : fixture.homeScore,
          awayScore:    isHome ? fixture.awayScore : newRuns,
          homeWickets:  isHome ? newWickets : fixture.homeWickets,
          awayWickets:  isHome ? fixture.awayWickets : newWickets,
          homeOvers:    isHome ? overs      : fixture.homeOvers,
          awayOvers:    isHome ? fixture.awayOvers   : overs,
          winnerId,
          matchResult:  fullResult,
          status:       'completed',
        });
      }
    }

    const [updatedInnings, updatedFixture] = await Promise.all([
      innings.reload(),
      fixture.reload(),
    ]);

    res.json({
      batterFingers,
      bowlerFingers,
      isWicket,
      runsScored,
      isUserBatting,
      inningsComplete,
      matchComplete,
      winnerId,
      matchResult,
      innings: updatedInnings.toJSON(),
      fixture: updatedFixture.toJSON(),
    });
  } catch (err) {
    console.error('[match/deliver]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/match/:fixtureId/impact-sub ────────────────────────────
// Body: { subInPlayerId, subOutPlayerId }  — swap in the designated impact sub player
router.post('/:fixtureId/impact-sub', async (req, res) => {
  try {
    const fixture = await Fixture.findByPk(req.params.fixtureId);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const innings = await MatchInnings.findOne({
      where: { fixtureId: fixture.id, status: 'in-progress' },
      order: [['inningsNumber', 'DESC']],
    });
    if (!innings)            return res.status(400).json({ error: 'No active innings' });
    if (innings.impactSubUsed) return res.status(400).json({ error: 'Impact sub already used' });
    if (innings.totalBalls >= 90) {
      return res.status(400).json({ error: 'Impact sub must be used before over 16' });
    }

    const { subInPlayerId, subOutPlayerId } = req.body;
    if (!subInPlayerId || !subOutPlayerId) {
      return res.status(400).json({ error: 'Both subInPlayerId and subOutPlayerId are required' });
    }

    const subInId = parseInt(subInPlayerId);
    const subOutId = parseInt(subOutPlayerId);
    if (isNaN(subInId) || isNaN(subOutId)) {
      return res.status(400).json({ error: 'Invalid player IDs provided' });
    }

    // Ensure the player is in the team's designated impact sub options
    const isHome = innings.battingTeamId === fixture.homeTeamId;
    const subOptions = isHome ? fixture.homeImpactSub : fixture.awayImpactSub;
    if (!subOptions.includes(subInId)) {
      return res.status(400).json({ error: 'Player is not in designated impact sub list' });
    }

    // Ensure the sub-out player is in the active playing XI
    const subOutIdx = innings.playingXI.indexOf(subOutId);
    if (subOutIdx === -1) {
      return res.status(400).json({ error: 'Sub-out player is not in the active Playing XI' });
    }

    // Validate overseas count
    const dbPlayers = await APlayer.findAll({
      where: { id: [...innings.playingXI, subInId] }
    });
    const natMap = {};
    dbPlayers.forEach((p) => {
      natMap[p.id] = p.nationality;
    });

    const currentOverseas = innings.playingXI.filter(id => natMap[id] === 'Overseas').length;
    const subInIsOverseas = natMap[subInId] === 'Overseas';
    const subOutIsOverseas = natMap[subOutId] === 'Overseas';
    const nextOverseas = currentOverseas - (subOutIsOverseas ? 1 : 0) + (subInIsOverseas ? 1 : 0);

    if (nextOverseas > 4) {
      return res.status(400).json({ error: 'Substitution violates the maximum 4 overseas players rule' });
    }

    // Swap the player at their exact index in playingXI
    const newXI = [...innings.playingXI];
    newXI[subOutIdx] = subInId;

    // Persist to innings
    await innings.update({
      impactSubUsed:     true,
      impactSubPlayerId: subInId,
      playingXI:         newXI,
    });

    // Also persist to the fixture's playing XI so that it persists for future innings / bowling
    if (isHome) {
      const fXI = [...fixture.homePlayingXI];
      const fIdx = fXI.indexOf(subOutId);
      if (fIdx !== -1) {
        fXI[fIdx] = subInId;
        await fixture.update({ homePlayingXI: fXI });
      }
    } else {
      const fXI = [...fixture.awayPlayingXI];
      const fIdx = fXI.indexOf(subOutId);
      if (fIdx !== -1) {
        fXI[fIdx] = subInId;
        await fixture.update({ awayPlayingXI: fXI });
      }
    }

    res.json({ success: true, message: 'Impact sub activated', innings: innings.toJSON() });
  } catch (err) {
    console.error('[match/impact-sub]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
