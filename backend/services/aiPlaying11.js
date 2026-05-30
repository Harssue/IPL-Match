/**
 * Selects a Playing XI from a squad using this composition:
 *   1 Wicketkeeper
 *   6 Batsmen    (Batsman or All-Rounder fill this slot)
 *   4 Bowlers    (Bowler  or All-Rounder fill this slot)
 *   Max 4 overseas players
 */

const fs = require('fs');
const path = require('path');

const playerOrderMap = new Map();
try {
  const squadsPath = path.resolve(__dirname, '../../ipl_2026_squads.json');
  const raw = fs.readFileSync(squadsPath, 'utf8');
  const data = JSON.parse(raw);
  let globalIndex = 0;
  data.teams.forEach((t) => {
    t.players.forEach((p) => {
      playerOrderMap.set(p.name, globalIndex++);
    });
  });
} catch (err) {
  console.error('[AI Playing XI] Failed to build player order map from JSON:', err);
}

function shuffleArr(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * @param {Array} squadPlayers - players with { id, role, nationality }
 * @returns {number[]} array of exactly 11 player IDs
 */
function selectAIPlayingXI(squadPlayers) {
  if (!squadPlayers || squadPlayers.length === 0) return [];

  const wk  = shuffleArr(squadPlayers.filter((p) => p.role === 'Wicketkeeper'));
  const bat  = shuffleArr(squadPlayers.filter((p) => p.role === 'Batsman'));
  const ar   = shuffleArr(squadPlayers.filter((p) => p.role === 'All-Rounder'));
  const bow  = shuffleArr(squadPlayers.filter((p) => p.role === 'Bowler'));

  // Bowling pool = Bowlers first, then All-Rounders as backup
  const bowlingPool = [...bow, ...ar];
  // Batting pool  = Batsmen first, then All-Rounders as backup
  const battingPool = [...bat, ...ar];

  const selected = [];
  const usedIds  = new Set();

  function addFrom(pool, count) {
    for (const p of pool) {
      if (selected.length >= count + (selected.length - count) + selected.length) break;
      if (usedIds.has(p.id)) continue;
      selected.push(p);
      usedIds.add(p.id);
      count--;
      if (count <= 0) break;
    }
  }

  // Simpler, cleaner approach:
  function pickN(pool, n) {
    let picked = 0;
    for (const p of pool) {
      if (picked >= n) break;
      if (!usedIds.has(p.id)) {
        selected.push(p);
        usedIds.add(p.id);
        picked++;
      }
    }
  }

  // Step 1: 1 Wicketkeeper
  pickN(wk, 1);
  // If no WK in squad, pick any player (handled in fill step)

  // Step 2: 4 Bowlers (Bowlers + AR)
  pickN(bowlingPool, 4);

  // Step 3: 6 Batsmen (Batsmen + AR)
  pickN(battingPool, 6);

  // Step 4: fill any remaining slots (squad might be small or roles missing)
  if (selected.length < 11) {
    pickN(shuffleArr(squadPlayers), 11 - selected.length);
  }

  const sortXI = (playersList) => {
    const idToPlayer = new Map(squadPlayers.map((p) => [p.id, p]));
    return [...playersList].sort((a, b) => {
      const nameA = idToPlayer.get(a.id)?.name || '';
      const nameB = idToPlayer.get(b.id)?.name || '';
      const idxA = playerOrderMap.has(nameA) ? playerOrderMap.get(nameA) : 9999;
      const idxB = playerOrderMap.has(nameB) ? playerOrderMap.get(nameB) : 9999;
      return idxA - idxB;
    });
  };

  // Step 5: enforce max 4 overseas
  const overseasInXI = selected.filter((p) => p.nationality === 'Overseas');
  if (overseasInXI.length > 4) {
    const toRemove  = new Set(overseasInXI.slice(4).map((p) => p.id));
    const kept      = selected.filter((p) => !toRemove.has(p.id));
    const keptIds   = new Set(kept.map((p) => p.id));
    const indians   = shuffleArr(squadPlayers.filter((p) => p.nationality === 'Indian' && !keptIds.has(p.id)));
    for (const p of indians) {
      if (kept.length >= 11) break;
      kept.push(p);
    }
    const sortedXI = sortXI(kept.slice(0, 11));
    return sortedXI.map((p) => p.id);
  }

  const sortedXI = sortXI(selected.slice(0, 11));
  return sortedXI.map((p) => p.id);
}

/**
 * Pick 5 impact subs from bench (not in XI).
 * Prefers batsmen and bowlers.
 */
function selectAIImpactSub(squadPlayers, xiIds) {
  const xiSet = new Set(xiIds);
  const bench = squadPlayers.filter((p) => !xiSet.has(p.id));
  if (bench.length === 0) return [];
  const sorted = [...bench].sort((a, b) => {
    const score = (p) => (p.role === 'Batsman' || p.role === 'Bowler' ? 2 : p.role === 'All-Rounder' ? 1 : 0);
    return score(b) - score(a);
  });
  return sorted.slice(0, 5).map((p) => p.id);
}

module.exports = { selectAIPlayingXI, selectAIImpactSub };
