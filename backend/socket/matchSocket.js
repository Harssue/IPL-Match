/**
 * matchSocket.js
 * Coordinates real-time multiplayer hand cricket matches.
 */

const { Fixture, MatchInnings, MatchEvent } = require('../models');
const { AGameTeam, ATeam, ASquad, APlayer } = require('../auctionDb');
const { selectAIPlayingXI, selectAIImpactSub } = require('../services/aiPlaying11');
const { pick: aiPick } = require('../services/aiSimulator');

// In-memory active match states
// Maps fixtureId (string) -> { fixtureId, homeChoice, awayChoice, homeConnected, awayConnected }
const activeMatches = new Map();

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

async function startInningsHelper(fixtureId, inningsNumber) {
  const fixture = await Fixture.findByPk(fixtureId);
  if (!fixture) return null;

  let completed = [];
  if (inningsNumber === 2) {
    completed = await MatchInnings.findAll({
      where: { fixtureId, inningsNumber: 1, status: 'completed' }
    });
  }

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

  // Assign playing XI + impact sub based on batting team
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
    fixtureId,
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

  await fixture.update({ status: 'live' });
  return innings;
}

module.exports = function registerMatchSocket(io) {
  io.on('connection', (socket) => {
    // ── JOIN LOBBY ROOM ──────────────────────────────────────────────
    socket.on('join-lobby', ({ gameId }) => {
      if (!gameId) return;
      const room = `lobby-${gameId}`;
      socket.join(room);
      socket.gameId = String(gameId);
      console.log(`[Match Socket] Socket ${socket.id} joined lobby room ${room}`);
    });

    // ── JOIN MATCH ROOM ──────────────────────────────────────────────
    socket.on('join-match', async ({ fixtureId, userGameTeamId }) => {
      try {
        if (!fixtureId || !userGameTeamId) {
          return socket.emit('error', { message: 'fixtureId and userGameTeamId required' });
        }

        const room = `fixture-${fixtureId}`;
        socket.join(room);
        socket.fixtureId = String(fixtureId);
        socket.userGameTeamId = userGameTeamId;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture) return socket.emit('error', { message: 'Fixture not found' });

        const gameTeam = await AGameTeam.findByPk(userGameTeamId);
        if (!gameTeam) return socket.emit('error', { message: 'GameTeam not found' });

        socket.teamId = gameTeam.teamId;

        // Resolve side
        let side = null;
        if (gameTeam.teamId === fixture.homeTeamId) side = 'home';
        else if (gameTeam.teamId === fixture.awayTeamId) side = 'away';

        if (!side) {
          return socket.emit('error', { message: 'You are not a player in this fixture' });
        }

        socket.side = side;

        // Fetch or create in-memory match state
        let state = activeMatches.get(String(fixtureId));
        if (!state) {
          // Check if opponent is AI
          const opponentTeamId = side === 'home' ? fixture.awayTeamId : fixture.homeTeamId;
          const opponentGT = await getGameTeamByTeamId(fixture.gameId, opponentTeamId);
          const isOpponentAI = opponentGT ? opponentGT.isAI : true;

          state = {
            fixtureId: String(fixtureId),
            homeConnected: false,
            awayConnected: false,
            homeChoice: null,
            awayChoice: null,
            isOpponentAI,
          };
          activeMatches.set(String(fixtureId), state);
        }

        if (side === 'home') state.homeConnected = true;
        if (side === 'away') state.awayConnected = true;

        console.log(`[Match Socket] Joined Room ${room}: ${side.toUpperCase()} team (${socket.id})`);

        // Send current status to the room
        io.to(room).emit('match-status', {
          fixture,
          homeConnected: state.homeConnected,
          awayConnected: state.awayConnected,
          isOpponentAI: state.isOpponentAI,
        });

      } catch (err) {
        console.error('[Match Socket] join-match error:', err);
        socket.emit('error', { message: 'Failed to join match' });
      }
    });

    // ── FLIP COIN (TOSS) ──────────────────────────────────────────────
    socket.on('conduct-toss', async ({ call, choice }) => {
      try {
        const fixtureId = socket.fixtureId;
        const side = socket.side;
        if (!fixtureId || !side) return;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture || fixture.status !== 'scheduled') return;

        if (!['heads', 'tails'].includes(call)) return;
        if (!['bat', 'bowl'].includes(choice)) return;

        const result   = Math.random() < 0.5 ? 'heads' : 'tails';
        const userWon  = call === result;

        let tossWinnerId, tossChoice;
        if (userWon) {
          tossWinnerId = socket.teamId;
          tossChoice   = choice;
        } else {
          tossWinnerId = side === 'home' ? fixture.awayTeamId : fixture.homeTeamId;
          tossChoice   = Math.random() < 0.5 ? 'bat' : 'bowl';
        }

        await fixture.update({ tossWinnerId, tossChoice, status: 'toss_done' });

        io.to(`fixture-${fixtureId}`).emit('toss-resolved', {
          result,
          userWon,
          tossWinnerId,
          tossChoice,
          fixtureStatus: 'toss_done',
        });

      } catch (err) {
        console.error('[Match Socket] conduct-toss error:', err);
      }
    });

    // ── SUBMIT PLAYING XI ─────────────────────────────────────────────
    socket.on('submit-playing-xi', async ({ playerIds, impactSubId }) => {
      try {
        const fixtureId = socket.fixtureId;
        const side = socket.side;
        if (!fixtureId || !side) return;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture || !['toss_done', 'xi_set'].includes(fixture.status)) return;

        if (!playerIds || playerIds.length !== 11) {
          return socket.emit('error', { message: 'Select exactly 11 players' });
        }

        // Validate overseas count
        const userSquad = await getSquadPlayers(socket.userGameTeamId);
        const playerMap = Object.fromEntries(userSquad.map((p) => [p.id, p]));
        const overseasInXI = playerIds.filter((id) => playerMap[id]?.nationality === 'Overseas').length;
        if (overseasInXI > 4) {
          return socket.emit('error', { message: 'Max 4 overseas players allowed in Playing XI' });
        }

        const updates = {};
        if (side === 'home') {
          updates.homePlayingXI = playerIds;
          updates.homeImpactSub = impactSubId || [];
        } else {
          updates.awayPlayingXI = playerIds;
          updates.awayImpactSub = impactSubId || [];
        }

        await fixture.update(updates);

        // Notify the opponent
        socket.to(`fixture-${fixtureId}`).emit('opponent-xi-submitted', { side });

        // Check if both sides are set
        const state = activeMatches.get(fixtureId);
        const updatedFixture = await Fixture.findByPk(fixtureId);

        let mustStart = false;
        if (state && state.isOpponentAI) {
          // Auto build AI squad
          const aiTeamId = side === 'home' ? fixture.awayTeamId : fixture.homeTeamId;
          const aiGT = await getGameTeamByTeamId(fixture.gameId, aiTeamId);
          const aiSquad = aiGT ? await getSquadPlayers(aiGT.id) : [];
          const aiXI = selectAIPlayingXI(aiSquad);
          const aiSub = selectAIImpactSub(aiSquad, aiXI);

          if (side === 'home') {
            await updatedFixture.update({
              awayPlayingXI: aiXI,
              awayImpactSub: aiSub || [],
              status: 'xi_set',
            });
          } else {
            await updatedFixture.update({
              homePlayingXI: aiXI,
              homeImpactSub: aiSub || [],
              status: 'xi_set',
            });
          }
          mustStart = true;
        } else {
          // Human opponent
          if (updatedFixture.homePlayingXI?.length === 11 && updatedFixture.awayPlayingXI?.length === 11) {
            await updatedFixture.update({ status: 'xi_set' });
            mustStart = true;
          }
        }

        if (mustStart) {
          const innings = await startInningsHelper(fixtureId, 1);
          io.to(`fixture-${fixtureId}`).emit('match-started', {
            fixture: await Fixture.findByPk(fixtureId),
            innings,
          });
          io.to(`lobby-${fixture.gameId}`).emit('lobby-update');
        } else {
          // Emit updated fixture status
          io.to(`fixture-${fixtureId}`).emit('match-status', {
            fixture: updatedFixture,
            homeConnected: state?.homeConnected,
            awayConnected: state?.awayConnected,
            isOpponentAI: state?.isOpponentAI,
          });
          io.to(`lobby-${fixture.gameId}`).emit('lobby-update');
        }

      } catch (err) {
        console.error('[Match Socket] submit-playing-xi error:', err);
      }
    });

    // ── PLAY BALL (DELIVERY RESOLUTION) ───────────────────────────────
    socket.on('play-ball', async ({ fingers }) => {
      try {
        const fixtureId = socket.fixtureId;
        const side = socket.side;
        if (!fixtureId || !side) return;

        const num = parseInt(fingers);
        if (![1, 2, 3, 4, 6].includes(num)) return;

        const state = activeMatches.get(fixtureId);
        if (!state) return;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture || fixture.status !== 'live') return;

        const innings = await MatchInnings.findOne({
          where: { fixtureId, status: 'in-progress' },
          order: [['inningsNumber', 'DESC']],
        });
        if (!innings) return;

        // Register choice
        if (side === 'home') state.homeChoice = num;
        else if (side === 'away') state.awayChoice = num;

        // Notify opponent that player has played
        socket.to(`fixture-${fixtureId}`).emit('opponent-played', { side });

        // Auto-generate AI choice if opponent is AI
        if (state.isOpponentAI) {
          const aiChoice = aiPick();
          if (side === 'home') state.awayChoice = aiChoice;
          else state.homeChoice = aiChoice;
        }

        // Check if both have played
        if (state.homeChoice !== null && state.awayChoice !== null) {
          // Resolve ball!
          const isHomeBatting = innings.battingTeamId === fixture.homeTeamId;
          const batterFingers = isHomeBatting ? state.homeChoice : state.awayChoice;
          const bowlerFingers = isHomeBatting ? state.awayChoice : state.homeChoice;

          const isWicket = batterFingers === bowlerFingers;
          const runsScored = isWicket ? 0 : batterFingers;

          const ballNumber = innings.totalBalls + 1;
          const overNumber = Math.floor(innings.totalBalls / 6);
          const ballInOver = innings.totalBalls % 6;

          const currentBatterPlayerId = innings.playingXI[innings.currentBatterIdx] || null;

          // Save Match Event
          await MatchEvent.create({
            inningsId: innings.id,
            ballNumber,
            overNumber,
            ballInOver,
            batterFingers,
            bowlerFingers,
            isWicket,
            runsScored,
            batterPlayerId: currentBatterPlayerId,
          });

          let newRuns     = innings.totalRuns    + runsScored;
          let newWickets  = innings.totalWickets + (isWicket ? 1 : 0);
          let newBalls    = innings.totalBalls   + 1;
          let newBatterIdx = innings.currentBatterIdx;
          let newNonStrikerIdx = innings.nonStrikerIdx;
          let newNextIdx   = innings.nextBatterIdx;

          if (isWicket) {
            newBatterIdx = innings.nextBatterIdx;
            newNextIdx   = innings.nextBatterIdx + 1;
          }

          // Striker and non-striker exchange positions at the end of each over
          if (newBalls > 0 && newBalls % 6 === 0) {
            const temp = newBatterIdx;
            newBatterIdx = newNonStrikerIdx;
            newNonStrikerIdx = temp;
          }

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
          let winnerId = null;
          let matchResult = null;

          if (inningsComplete) {
            if (innings.inningsNumber === 1) {
              await fixture.update({
                homeScore:    isHome ? newRuns    : fixture.homeScore,
                awayScore:    isHome ? fixture.awayScore : newRuns,
                homeWickets:  isHome ? newWickets : fixture.homeWickets,
                awayWickets:  isHome ? fixture.awayWickets : newWickets,
                homeOvers:    isHome ? overs      : fixture.homeOvers,
                awayOvers:    isHome ? fixture.awayOvers : overs,
              });
            } else {
              matchComplete = true;
              const inn1 = await MatchInnings.findOne({
                where: { fixtureId, inningsNumber: 1 },
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
                awayOvers:    isHome ? fixture.awayOvers : overs,
                winnerId,
                matchResult:  fullResult,
                status:       'completed',
              });
            }
          }

          // Clear choices for next ball
          const homePlayChoice = state.homeChoice;
          const awayPlayChoice = state.awayChoice;
          state.homeChoice = null;
          state.awayChoice = null;

          // Reload states
          const updatedInnings = await innings.reload();
          const updatedFixture = await fixture.reload();

          // Get events to include commentary
          const allEvents = await MatchEvent.findAll({
            where: { inningsId: innings.id },
            order: [['ballNumber', 'ASC']],
          });

          io.to(`fixture-${fixtureId}`).emit('delivery-resolved', {
            batterFingers,
            bowlerFingers,
            isWicket,
            runsScored,
            isHomeBatting,
            inningsComplete,
            matchComplete,
            winnerId,
            matchResult,
            innings: {
              ...updatedInnings.toJSON(),
              Events: allEvents,
            },
            fixture: updatedFixture.toJSON(),
            homePlayChoice,
            awayPlayChoice,
          });

          if (matchComplete) {
            io.to(`lobby-${fixture.gameId}`).emit('lobby-update');
          }
        }

      } catch (err) {
        console.error('[Match Socket] play-ball error:', err);
      }
    });

    // ── START SECOND INNINGS ──────────────────────────────────────────
    socket.on('start-second-innings', async () => {
      try {
        const fixtureId = socket.fixtureId;
        if (!fixtureId) return;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture || fixture.status !== 'live') return;

        const completed1 = await MatchInnings.findOne({
          where: { fixtureId, inningsNumber: 1, status: 'completed' },
        });
        const completed2 = await MatchInnings.findOne({
          where: { fixtureId, inningsNumber: 2 },
        });

        if (completed1 && !completed2) {
          const innings = await startInningsHelper(fixtureId, 2);
          io.to(`fixture-${fixtureId}`).emit('second-innings-started', {
            fixture,
            innings,
          });
        }
      } catch (err) {
        console.error('[Match Socket] start-second-innings error:', err);
      }
    });

    // ── USE IMPACT SUB ────────────────────────────────────────────────
    socket.on('use-impact-sub', async ({ subInPlayerId, subOutPlayerId }) => {
      try {
        const fixtureId = socket.fixtureId;
        const side = socket.side;
        if (!fixtureId || !side) return;

        const fixture = await Fixture.findByPk(fixtureId);
        if (!fixture || fixture.status !== 'live') return;

        const innings = await MatchInnings.findOne({
          where: { fixtureId, status: 'in-progress' },
          order: [['inningsNumber', 'DESC']],
        });
        if (!innings || innings.impactSubUsed) return;

        const subInId = parseInt(subInPlayerId);
        const subOutId = parseInt(subOutPlayerId);
        if (isNaN(subInId) || isNaN(subOutId)) {
          return socket.emit('error', { message: 'Invalid player IDs provided' });
        }

        // Ensure the player is in the team's designated impact sub options
        const subOptions = side === 'home' ? fixture.homeImpactSub : fixture.awayImpactSub;
        if (!subOptions.includes(subInId)) {
          return socket.emit('error', { message: 'Player is not in designated impact sub list' });
        }

        // Ensure the sub-out player is in the active playing XI
        const subOutIdx = innings.playingXI.indexOf(subOutId);
        if (subOutIdx === -1) {
          return socket.emit('error', { message: 'Sub-out player is not in the active Playing XI' });
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
          return socket.emit('error', { message: 'Substitution violates the maximum 4 overseas players rule' });
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
        if (side === 'home') {
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

        // Broadcast to the room!
        const updatedInnings = await innings.reload();
        const updatedFixture = await fixture.reload();

        // Get events to include commentary/events
        const allEvents = await MatchEvent.findAll({
          where: { inningsId: innings.id },
          order: [['ballNumber', 'ASC']],
        });

        io.to(`fixture-${fixtureId}`).emit('impact-sub-resolved', {
          side,
          subInPlayerId: subInId,
          subOutPlayerId: subOutId,
          innings: {
            ...updatedInnings.toJSON(),
            Events: allEvents,
          },
          fixture: updatedFixture.toJSON(),
        });

      } catch (err) {
        console.error('[Match Socket] use-impact-sub error:', err);
      }
    });

    // ── DISCONNECT ───────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const { fixtureId, side } = socket;
      if (fixtureId && side) {
        const state = activeMatches.get(fixtureId);
        if (state) {
          if (side === 'home') state.homeConnected = false;
          if (side === 'away') state.awayConnected = false;

          console.log(`[Match Socket] Disconnected: ${side.toUpperCase()} team (${socket.id})`);

          socket.to(`fixture-${fixtureId}`).emit('opponent-disconnected', { side });

          // Clean up memory if both left
          if (!state.homeConnected && !state.awayConnected) {
            activeMatches.delete(fixtureId);
          }
        }
      }
    });
  });
};
