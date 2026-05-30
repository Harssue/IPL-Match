/**
 * AI match simulator using hand cricket rules.
 *
 * Hand Cricket Rules:
 *   - Both sides pick from {1, 2, 3, 4, 6}
 *   - If batter fingers == bowler fingers → WICKET (0 runs)
 *   - Else → batter scores that many runs
 *   - Innings ends at 10 wickets or 120 balls (20 overs)
 */

const FINGERS = [1, 2, 3, 4, 6];

/** Pick a random finger count from the legal set */
function pick() {
  return FINGERS[Math.floor(Math.random() * FINGERS.length)];
}

/**
 * Simulate a single innings.
 * @param {number} maxBalls - max deliveries (default 120)
 * @param {number|null} target - if set, innings ends when this is reached (batting team wins)
 * @returns {{ runs, wickets, balls, overs }}
 */
function simulateInnings(maxBalls = 120, target = null) {
  let runs = 0, wickets = 0, balls = 0;

  while (balls < maxBalls && wickets < 10) {
    if (target !== null && runs >= target) break;

    const batter = pick();
    const bowler = pick();

    if (batter === bowler) {
      wickets++;
    } else {
      runs += batter;
    }
    balls++;
  }

  return {
    runs,
    wickets,
    balls,
    overs: parseFloat(`${Math.floor(balls / 6)}.${balls % 6}`),
  };
}

/**
 * Simulate a complete match between two teams.
 * @returns Fixture update object (scores, winner, toss)
 */
function simulateFullMatch(homeTeamId, awayTeamId) {
  // Toss
  const tossWinnerId = Math.random() < 0.5 ? homeTeamId : awayTeamId;
  const tossChoice   = Math.random() < 0.5 ? 'bat' : 'bowl';

  // Determine batting order
  const homeWinsToss   = tossWinnerId === homeTeamId;
  const homeBatsFirst  =
    (homeWinsToss && tossChoice === 'bat') ||
    (!homeWinsToss && tossChoice === 'bowl');

  const battingFirstId  = homeBatsFirst ? homeTeamId : awayTeamId;
  const battingSecondId = homeBatsFirst ? awayTeamId : homeTeamId;

  const inn1   = simulateInnings(120);
  const target = inn1.runs + 1;
  const inn2   = simulateInnings(120, target);

  // Determine winner
  let winnerId, matchResult;
  if (inn2.runs >= target) {
    winnerId = battingSecondId;
    const wktsLeft = 10 - inn2.wickets;
    matchResult = `won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`;
  } else {
    winnerId = battingFirstId;
    const runsDiff = inn1.runs - inn2.runs;
    matchResult = `won by ${runsDiff} run${runsDiff !== 1 ? 's' : ''}`;
  }

  // Map back to home/away
  const homeInn  = homeBatsFirst ? inn1 : inn2;
  const awayInn  = homeBatsFirst ? inn2 : inn1;

  return {
    tossWinnerId,
    tossChoice,
    winnerId,
    matchResult,               // relative string, will be prefixed with team name in route
    homeScore:   homeInn.runs,
    awayScore:   awayInn.runs,
    homeWickets: homeInn.wickets,
    awayWickets: awayInn.wickets,
    homeOvers:   homeInn.overs,
    awayOvers:   awayInn.overs,
    status:      'completed',
  };
}

module.exports = { pick, simulateInnings, simulateFullMatch };
