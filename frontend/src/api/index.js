const BASE = '/api';

async function req(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Setup
  getGames:     ()                          => req('GET',  '/setup/games'),
  clearAllGames:()                          => req('POST', '/setup/clear-all'),
  seedTest:     ()                          => req('POST', '/setup/seed-test'),
  initFixtures: (auctionGameId, userGameTeamId) =>
    req('POST', '/setup/init', { auctionGameId, userGameTeamId }),
  getSquad:     (gameTeamId)                => req('GET',  `/setup/squad/${gameTeamId}`),
  gameByCode:   (code)                      => req('GET',  `/setup/game-by-code/${code}`),

  // Fixtures
  getFixtures:  (gameId)                   => req('GET',  `/fixtures/${gameId}`),
  simulateAI:   (gameId, userTeamId)       => req('POST', `/fixtures/${gameId}/simulate-ai`, { userTeamId }),
  createPlayoffs:(gameId)                  => req('POST', `/fixtures/${gameId}/create-playoffs`),
  simulateFixture: (fixtureId)              => req('POST', `/fixtures/simulate/${fixtureId}`),

  // Match
  getMatch:     (fixtureId)                => req('GET',  `/match/${fixtureId}`),
  toss:         (fixtureId, data)          => req('POST', `/match/${fixtureId}/toss`, data),
  setPlayingXI: (fixtureId, data)          => req('POST', `/match/${fixtureId}/playing-xi`, data),
  startInnings: (fixtureId, userTeamId)   => req('POST', `/match/${fixtureId}/start-innings`, { userTeamId }),
  deliver:      (fixtureId, fingers, userTeamId) =>
    req('POST', `/match/${fixtureId}/deliver`, { fingers, userTeamId }),
  impactSub:    (fixtureId, playerId)      => req('POST', `/match/${fixtureId}/impact-sub`, { playerId }),
};
