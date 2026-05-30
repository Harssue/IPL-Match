import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar.jsx';
import {
  Zap, Trophy, RefreshCw, Play, ChevronRight,
  TrendingUp, Calendar, Star, Clock, CheckCircle, Circle,
  FastForward, MapPin
} from 'lucide-react';

// ── Season progress header ────────────────────────────────────────────
function SeasonBanner({ total, done, userPending, userTeamColor, userTeamName, onSimulate, simulating, simResult, leagueComplete, onCreatePlayoffs }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="card mb-6 animate-up"
      style={{
        background: 'linear-gradient(135deg, rgba(10,14,28,0.8) 0%, rgba(8,12,24,0.9) 100%)',
        border: '1px solid rgba(249,192,0,0.15)',
        padding: '28px 32px',
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left: Season stats */}
        <div className="flex gap-6 flex-wrap items-center">
          <div>
            <p className="section-label mb-1">League Progress</p>
            <div className="flex items-end gap-2">
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 32, lineHeight: 1, color: '#f9c000' }}>
                {done}
              </span>
              <span className="text-sub font-semibold mb-1" style={{ fontSize: 16 }}>/ {total}</span>
            </div>
            <div className="progress-bar mt-2" style={{ width: 180 }}>
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted mt-1">{pct}% complete</p>
          </div>

          <div
            style={{
              width: 1, height: 52,
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.1), transparent)',
              flexShrink: 0,
            }}
          />

          <div>
            <p className="section-label mb-1">Your Matches Left</p>
            <div className="flex items-end gap-2">
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 32, lineHeight: 1, color: userPending > 0 ? userTeamColor : '#4ade80' }}>
                {userPending}
              </span>
            </div>
            {userPending > 0 ? (
              <p className="text-xs mt-1" style={{ color: userTeamColor }}>to play as {userTeamName}</p>
            ) : (
              <p className="text-xs text-green mt-1">All played ✓</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-3 items-end">
          {leagueComplete ? (
            <button className="btn btn-gold btn-lg" onClick={onCreatePlayoffs}>
              <Trophy size={17} /> Create Playoffs
            </button>
          ) : (
            <button
              className="btn btn-outline-gold"
              onClick={onSimulate}
              disabled={simulating}
              style={{ minWidth: 200 }}
            >
              {simulating ? (
                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Simulating…</>
              ) : (
                <><FastForward size={16} /> Simulate AI Matches</>
              )}
            </button>
          )}

          {simResult && (
            <div className="animate-down" style={{
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              fontSize: 12, color: '#86efac', textAlign: 'right',
            }}>
              ✅ {simResult.simulated} matches simulated
              {simResult.nextUserMatchNumber && (
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  Stopped before Match #{simResult.nextUserMatchNumber} (your match)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Points Table ──────────────────────────────────────────────────────
function PointsTable({ table, userTeamId }) {
  return (
    <div className="card card-sm" style={{ padding: '20px 0' }}>
      <div className="flex items-center gap-2 px-5 mb-3">
        <Trophy size={15} style={{ color: '#f9c000' }} />
        <span className="font-rajdhani font-bold text-base">Points Table</span>
      </div>

      <table className="pts-table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 20 }}>#</th>
            <th>Team</th>
            <th className="right">P</th>
            <th className="right">W</th>
            <th className="right">L</th>
            <th className="right">Pts</th>
            <th className="right" style={{ paddingRight: 20 }}>NRR</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => {
            const isUser    = row.teamId === userTeamId;
            const qualifies = i < 4;
            return (
              <tr key={row.teamId} className={qualifies ? 'qualify' : ''}>
                <td style={{ paddingLeft: 20 }}>
                  <span
                    className="font-orbitron"
                    style={{
                      fontSize: 11, fontWeight: 700,
                      color: qualifies ? '#f9c000' : 'var(--text-muted)',
                    }}
                  >
                    {i + 1}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div
                      className="team-logo"
                      style={{
                        width: 26, height: 26, fontSize: 8, borderRadius: 7,
                        background: `${row.team?.primaryColor}20`,
                        color: row.team?.primaryColor,
                        border: `1.5px solid ${row.team?.primaryColor}40`,
                      }}
                    >
                      {row.team?.logoInitials}
                    </div>
                    <div>
                      <span
                        className="font-rajdhani font-bold"
                        style={{
                          fontSize: 14,
                          color: isUser ? '#f9c000' : 'var(--text)',
                        }}
                      >
                        {row.team?.shortName}
                      </span>
                      {isUser && (
                        <span style={{ marginLeft: 5, fontSize: 10, color: '#f9c000' }}>★</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="right text-sub text-sm">{row.played}</td>
                <td className="right font-bold text-sm" style={{ color: row.won > 0 ? '#4ade80' : 'var(--text-sub)' }}>{row.won}</td>
                <td className="right text-sm text-sub">{row.lost}</td>
                <td className="right font-orbitron text-sm" style={{ color: '#f9c000', fontSize: 13 }}>{row.points}</td>
                <td
                  className="right"
                  style={{
                    paddingRight: 20,
                    fontSize: 12, fontWeight: 600,
                    color: row.nrr >= 0 ? '#4ade80' : '#f87171',
                  }}
                >
                  {row.nrr > 0 ? '+' : ''}{row.nrr.toFixed(3)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{
        margin: '12px 20px 0',
        padding: '8px 12px',
        background: 'rgba(249,192,0,0.04)',
        border: '1px solid rgba(249,192,0,0.12)',
        borderRadius: 8,
        fontSize: 11, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f9c000', flexShrink: 0 }} />
        Top 4 qualify for playoffs
      </div>
    </div>
  );
}

// ── Match number divider ──────────────────────────────────────────────
function RoundDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="divider flex-1" />
      <span className="section-label">{label}</span>
      <div className="divider flex-1" />
    </div>
  );
}

// ── Fixture card v2 ───────────────────────────────────────────────────
function FixtureCard({ fixture, userTeamId, onPlay }) {
  const isUser  = fixture.homeTeam?.id === userTeamId || fixture.awayTeam?.id === userTeamId;
  const isDone  = fixture.status === 'completed';
  const canPlay = isUser && !isDone;
  const home    = fixture.homeTeam;
  const away    = fixture.awayTeam;

  return (
    <div className={`fixture-card ${isUser ? 'user-match' : ''} ${isDone ? 'completed' : ''}`}>
      {/* Left: home team */}
      <div className="fixture-team">
        <div
          className="team-logo"
          style={{
            width: 38, height: 38, fontSize: 11, borderRadius: 10,
            background: `${home?.primaryColor}18`,
            color: home?.primaryColor,
            border: `1.5px solid ${home?.primaryColor}40`,
            flexShrink: 0,
          }}
        >
          {home?.logoInitials}
        </div>
        <div className="min-w-0">
          <p className="font-rajdhani font-bold truncate" style={{ fontSize: 14 }}>
            {home?.shortName}
            {isDone && fixture.winnerId === home?.id && (
              <span style={{ color: '#f9c000', marginLeft: 4, fontSize: 11 }}>★</span>
            )}
          </p>
          {isDone && (
            <p
              className="font-orbitron font-bold"
              style={{
                fontSize: 16,
                color: fixture.winnerId === home?.id ? '#f9c000' : 'var(--text-sub)',
              }}
            >
              {fixture.homeScore}/{fixture.homeWickets}
              <span className="text-muted" style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, fontFamily: 'Inter,sans-serif' }}>
                ({fixture.homeOvers})
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Center */}
      <div className="text-center flex-col items-center" style={{ display: 'flex', minWidth: 110, gap: 4 }}>
        <span
          className="badge badge-muted"
          style={{ fontSize: 9, letterSpacing: 1 }}
        >
          {fixture.isPlayoff ? `🏆 ${fixture.playoffRound}` : `M${fixture.matchNumber}`}
        </span>

        {isDone ? (
          <p
            className="text-muted truncate"
            style={{ fontSize: 11, maxWidth: 120, lineHeight: 1.3, marginTop: 2 }}
          >
            {fixture.matchResult}
          </p>
        ) : canPlay ? (
          <button
            className="btn btn-gold btn-sm"
            onClick={() => onPlay(fixture.id)}
            style={{ marginTop: 2 }}
          >
            <Play size={11} /> PLAY
          </button>
        ) : (
          <div className="flex items-center gap-1 text-muted" style={{ fontSize: 10, marginTop: 2 }}>
            <MapPin size={9} />
            <span className="truncate" style={{ maxWidth: 90 }}>{fixture.venue?.split(',')[0]}</span>
          </div>
        )}
      </div>

      {/* Right: away team */}
      <div className="fixture-team away">
        <div
          className="team-logo"
          style={{
            width: 38, height: 38, fontSize: 11, borderRadius: 10,
            background: `${away?.primaryColor}18`,
            color: away?.primaryColor,
            border: `1.5px solid ${away?.primaryColor}40`,
            flexShrink: 0,
          }}
        >
          {away?.logoInitials}
        </div>
        <div className="min-w-0" style={{ textAlign: 'right' }}>
          <p className="font-rajdhani font-bold truncate" style={{ fontSize: 14 }}>
            {isDone && fixture.winnerId === away?.id && (
              <span style={{ color: '#f9c000', marginRight: 4, fontSize: 11 }}>★</span>
            )}
            {away?.shortName}
          </p>
          {isDone && (
            <p
              className="font-orbitron font-bold"
              style={{
                fontSize: 16,
                color: fixture.winnerId === away?.id ? '#f9c000' : 'var(--text-sub)',
              }}
            >
              <span className="text-muted" style={{ fontSize: 10, fontWeight: 400, marginRight: 4, fontFamily: 'Inter,sans-serif' }}>
                ({fixture.awayOvers})
              </span>
              {fixture.awayScore}/{fixture.awayWickets}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Fixtures list with grouping ───────────────────────────────────────
function FixturesList({ fixtures, userTeamId, onPlay }) {
  if (fixtures.length === 0) {
    return (
      <div className="card text-center p-8">
        <Calendar size={40} style={{ margin: '0 auto 14px', opacity: 0.2, color: '#f9c000' }} />
        <p className="font-rajdhani font-bold text-lg mb-1">No Fixtures Yet</p>
        <p className="text-muted text-sm">Fixtures will appear here once the game is set up.</p>
      </div>
    );
  }

  // Group by blocks of 9 (roughly rounds)
  const groups = [];
  for (let i = 0; i < fixtures.length; i += 9) {
    groups.push(fixtures.slice(i, i + 9));
  }

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <RoundDivider label={`Matches ${gi * 9 + 1}–${Math.min((gi + 1) * 9, fixtures.length)}`} />
          )}
          <div className="flex flex-col gap-1">
            {group.map((f) => (
              <FixtureCard
                key={f.id}
                fixture={f}
                userTeamId={userTeamId}
                onPlay={onPlay}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="page flex gap-6 flex-wrap" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 320px', minWidth: 280 }}>
          <div className="skeleton" style={{ height: 420, borderRadius: 20 }} />
        </div>
        <div className="flex-1" style={{ minWidth: 320 }}>
          <div className="skeleton mb-4" style={{ height: 120, borderRadius: 20 }} />
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton mb-2" style={{ height: 64, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function FixturesPage() {
  const { gameSetup }  = useApp();
  const navigate       = useNavigate();

  const [fixtures,      setFixtures]      = useState([]);
  const [table,         setTable]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [simulating,    setSimulating]    = useState(false);
  const [simResult,     setSimResult]     = useState(null);
  const [tab,           setTab]           = useState('League');
  const [error,         setError]         = useState('');
  const [leagueComplete,setLeagueComplete]= useState(false);

  const load = useCallback(async () => {
    if (!gameSetup) return;
    try {
      const d = await api.getFixtures(gameSetup.auctionGameId);
      setFixtures(d.fixtures || []);
      setTable(d.pointsTable || []);
      setLeagueComplete(d.leagueComplete || false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [gameSetup]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!gameSetup) return;

    const socketUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5001'
      : '';

    const s = io(socketUrl);

    s.emit('join-lobby', { gameId: gameSetup.auctionGameId });

    s.on('lobby-update', () => {
      console.log('[Lobby Socket] Lobby update received, reloading fixtures & table...');
      load();
    });

    return () => {
      s.disconnect();
    };
  }, [gameSetup, load]);

  // Clear sim result after 6s
  useEffect(() => {
    if (!simResult) return;
    const t = setTimeout(() => setSimResult(null), 6000);
    return () => clearTimeout(t);
  }, [simResult]);

  async function handleSimulateAI() {
    setSimulating(true);
    setSimResult(null);
    try {
      const d = await api.simulateAI(gameSetup.auctionGameId, gameSetup.userTeamId);
      setSimResult(d);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSimulating(false);
    }
  }

  async function handleCreatePlayoffs() {
    try {
      await api.createPlayoffs(gameSetup.auctionGameId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const leagueFixtures  = fixtures.filter((f) => !f.isPlayoff);
  const playoffFixtures = fixtures.filter((f) =>  f.isPlayoff);
  const userPending     = leagueFixtures.filter(
    (f) => (f.homeTeam?.id === gameSetup?.userTeamId || f.awayTeam?.id === gameSetup?.userTeamId)
         && f.status === 'scheduled'
  ).length;
  const leagueDone = leagueFixtures.filter((f) => f.status === 'completed').length;
  const displayFixtures = tab === 'Playoffs' ? playoffFixtures : leagueFixtures;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <div className="page">
        {/* Error */}
        {error && (
          <div
            className="animate-up mb-4 flex items-center gap-3"
            style={{
              padding: '12px 18px', borderRadius: 12,
              background: 'var(--red-bg)', border: '1px solid var(--red-border)',
              color: '#fca5a5', fontSize: 13,
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Season Banner */}
        <SeasonBanner
          total={leagueFixtures.length}
          done={leagueDone}
          userPending={userPending}
          userTeamColor={gameSetup?.userTeamColor || '#f9c000'}
          userTeamName={gameSetup?.userTeamShort}
          onSimulate={handleSimulateAI}
          simulating={simulating}
          simResult={simResult}
          leagueComplete={leagueComplete}
          onCreatePlayoffs={handleCreatePlayoffs}
        />

        <div className="flex gap-5 flex-wrap" style={{ alignItems: 'flex-start' }}>
          {/* Points Table */}
          <div style={{ flex: '0 0 310px', minWidth: 280 }}>
            <PointsTable table={table} userTeamId={gameSetup?.userTeamId} />
          </div>

          {/* Fixtures list */}
          <div className="flex-1" style={{ minWidth: 320 }}>
            {/* Tabs */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="pill-tabs">
                {['League', 'Playoffs'].map((t) => (
                  <button
                    key={t}
                    className={`pill-tab ${tab === t ? 'active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'League' ? `🏏 League (${leagueFixtures.length})` : `🏆 Playoffs (${playoffFixtures.length})`}
                  </button>
                ))}
              </div>

              {/* Your next match callout */}
              {tab === 'League' && userPending > 0 && (
                <div style={{
                  padding: '6px 14px', borderRadius: 999,
                  background: `${gameSetup?.userTeamColor}15`,
                  border: `1px solid ${gameSetup?.userTeamColor}35`,
                  fontSize: 12, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700,
                  color: gameSetup?.userTeamColor,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Play size={11} /> {userPending} match{userPending !== 1 ? 'es' : ''} to play
                </div>
              )}
            </div>

            {tab === 'Playoffs' && playoffFixtures.length === 0 ? (
              <div className="card text-center p-8">
                <Trophy size={44} style={{ margin: '0 auto 14px', opacity: 0.2, color: '#f9c000' }} />
                <p className="font-rajdhani font-bold text-xl mb-2">Playoffs Not Started</p>
                <p className="text-muted text-sm">
                  Complete all 90 league matches to unlock the playoffs.
                </p>
                <button className="btn btn-ghost btn-sm mt-4" onClick={() => setTab('League')}>
                  Back to League
                </button>
              </div>
            ) : (
              <FixturesList
                fixtures={displayFixtures}
                userTeamId={gameSetup?.userTeamId}
                onPlay={(id) => navigate(`/pre-match/${id}`)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
