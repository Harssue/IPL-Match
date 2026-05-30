/**
 * Generates double round-robin fixtures for 10 IPL teams.
 * Each team plays every other team TWICE (home & away) = 18 matches per team, 90 total.
 * Fixtures are shuffled so no team plays back-to-back.
 */

const VENUES = [
  'Wankhede Stadium, Mumbai',
  'MA Chidambaram Stadium, Chennai',
  'Eden Gardens, Kolkata',
  'M Chinnaswamy Stadium, Bengaluru',
  'Sawai Mansingh Stadium, Jaipur',
  'Arun Jaitley Stadium, Delhi',
  'PCA Stadium, Mohali',
  'Rajiv Gandhi Intl. Stadium, Hyderabad',
  'Ekana Cricket Stadium, Lucknow',
  'Narendra Modi Stadium, Ahmedabad',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Interleave fixtures so no team plays consecutive matches.
 * Uses a greedy approach: pick next fixture where neither team played in last 2 picks.
 */
function interleave(fixtures) {
  const result = [];
  const remaining = [...fixtures];
  const recentTeams = new Set();

  while (remaining.length > 0) {
    // Try to find a fixture where no team has recently played
    let idx = remaining.findIndex(
      (f) => !recentTeams.has(f.homeTeamId) && !recentTeams.has(f.awayTeamId)
    );
    if (idx === -1) idx = 0; // fallback: just take next

    const [picked] = remaining.splice(idx, 1);
    result.push(picked);

    recentTeams.add(picked.homeTeamId);
    recentTeams.add(picked.awayTeamId);
    if (recentTeams.size > 6) {
      // Keep only the last 6 teams in the "recent" window
      const arr = [...recentTeams];
      recentTeams.clear();
      arr.slice(-6).forEach((t) => recentTeams.add(t));
    }
  }

  return result;
}

/**
 * @param {Array<{id: number}>} teams  - list of team objects (must have .id)
 * @param {number} gameId              - auction game ID
 * @returns {Array} fixture objects ready for bulkCreate
 */
function generateDoubleRoundRobin(teams, gameId) {
  const raw = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      // Home leg
      raw.push({
        homeTeamId: teams[i].id,
        awayTeamId: teams[j].id,
        venueIdx: i,
      });
      // Away leg
      raw.push({
        homeTeamId: teams[j].id,
        awayTeamId: teams[i].id,
        venueIdx: j,
      });
    }
  }

  const shuffled = shuffle(raw);
  const ordered  = interleave(shuffled);

  return ordered.map((f, idx) => ({
    gameId,
    matchNumber: idx + 1,
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    venue: VENUES[f.venueIdx % VENUES.length],
    status: 'scheduled',
  }));
}

module.exports = { generateDoubleRoundRobin };
