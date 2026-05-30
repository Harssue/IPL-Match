import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar.jsx';
import { Trophy, Play, RefreshCw, Zap } from 'lucide-react';

const PLAYOFF_ROUNDS = ['Q1', 'Eliminator', 'Q2', 'Final'];

const ROUND_INFO = {
  Q1:         { label: 'Qualifier 1',  desc: 'Winner goes direct to Final',    emoji: '⚡' },
  Eliminator: { label: 'Eliminator',   desc: 'Loser is eliminated',             emoji: '🔥' },
  Q2:         { label: 'Qualifier 2',  desc: 'Winner goes to Final',            emoji: '🏹' },
  Final:      { label: 'THE FINAL',    desc: 'IPL Champion crowned here',        emoji: '🏆' },
};

function PlayoffCard({ fixture, userTeamId, onPlay, onSimulate }) {
  if (!fixture) return (
    <div className="card card-sm text-center p-6 opacity-50">
      <p className="text-muted text-sm">TBD</p>
    </div>
  );

  const isDone  = fixture.status === 'completed';
  const isUser  = fixture.homeTeam?.id === userTeamId || fixture.awayTeam?.id === userTeamId;
  const canPlay = isUser && !isDone && fixture.homeTeamId !== 0 && fixture.awayTeamId !== 0;
  const canSim  = !isUser && !isDone && fixture.homeTeamId !== 0 && fixture.awayTeamId !== 0;

  const home = fixture.homeTeam;
  const away = fixture.awayTeam;

  return (
    <div className={`card ${isUser ? 'glass-gold' : ''}`} style={{
      borderColor: isDone ? 'rgba(255,255,255,0.05)' : isUser ? 'rgba(249,192,0,0.3)' : undefined,
    }}>
      <div className="flex items-center gap-3 mb-4">
        {home && (
          <div className="team-logo" style={{
            width: 40, height: 40, fontSize: 12, borderRadius: 10,
            background: `${home?.primaryColor}22`, color: home?.primaryColor,
            border: `1.5px solid ${home?.primaryColor}44`,
          }}>{home?.logoInitials}</div>
        )}
        <div className="flex-1 text-center">
          {isDone ? (
            <div>
              <p className="font-orbitron text-xs text-muted mb-1">RESULT</p>
              <p className="font-orbitron font-bold text-gold text-sm">
                {fixture.homeScore}/{fixture.homeWickets} vs {fixture.awayScore}/{fixture.awayWickets}
              </p>
              <p className="text-xs text-muted mt-1">{fixture.matchResult}</p>
            </div>
          ) : (
            <span className="font-orbitron text-xs text-muted">VS</span>
          )}
        </div>
        {away && (
          <div className="team-logo" style={{
            width: 40, height: 40, fontSize: 12, borderRadius: 10,
            background: `${away?.primaryColor}22`, color: away?.primaryColor,
            border: `1.5px solid ${away?.primaryColor}44`,
          }}>{away?.logoInitials}</div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted truncate" style={{ maxWidth: 120 }}>
            📍 {fixture.venue?.split(',')[0]}
          </p>
        </div>
        {isDone ? (
          <span className="badge badge-green">Completed</span>
        ) : canPlay ? (
          <button className="btn btn-gold btn-sm" onClick={() => onPlay(fixture.id)}>
            <Play size={12} /> PLAY
          </button>
        ) : canSim ? (
          <button className="btn btn-ghost btn-sm" onClick={() => onSimulate(fixture.id)}>
            <RefreshCw size={12} /> Simulate
          </button>
        ) : (
          <span className="badge badge-muted">Pending</span>
        )}
      </div>

      {isDone && fixture.winnerId && (
        <div className="mt-3 glass rounded py-2 px-3 text-center">
          <p className="text-xs text-muted">Winner</p>
          <p className="font-rajdhani font-bold" style={{
            color: fixture.winnerId === fixture.homeTeam?.id
              ? fixture.homeTeam?.primaryColor : fixture.awayTeam?.primaryColor,
          }}>
            {fixture.winnerId === fixture.homeTeam?.id ? fixture.homeTeam?.name : fixture.awayTeam?.name}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PlayoffsPage() {
  const { gameSetup } = useApp();
  const navigate      = useNavigate();

  const [fixtures,   setFixtures]   = useState([]);
  const [table,      setTable]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [simulating, setSimulating] = useState(null);

  const load = useCallback(async () => {
    if (!gameSetup) return;
    try {
      const d = await api.getFixtures(gameSetup.auctionGameId);
      setFixtures(d.fixtures || []);
      setTable(d.pointsTable || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }, [gameSetup]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!gameSetup) return;

    const socketUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5001'
      : `${window.location.protocol}//${window.location.hostname}:5001`;

    const s = io(socketUrl);

    s.emit('join-lobby', { gameId: gameSetup.auctionGameId });

    s.on('lobby-update', () => {
      console.log('[Lobby Socket] Lobby update received, reloading playoffs...');
      load();
    });

    return () => {
      s.disconnect();
    };
  }, [gameSetup, load]);

  const playoffFixtures = fixtures.filter((f) => f.isPlayoff);
  const getByRound = (r) => playoffFixtures.find((f) => f.playoffRound === r);

  const q1      = getByRound('Q1');
  const elim    = getByRound('Eliminator');
  const q2      = getByRound('Q2');
  const final   = getByRound('Final');
  const champion = final?.status === 'completed'
    ? (final.winnerId === final.homeTeam?.id ? final.homeTeam : final.awayTeam)
    : null;

  async function handleSimulate(fixtureId) {
    setSimulating(fixtureId);
    try {
      await api.simulateFixture(fixtureId);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSimulating(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (playoffFixtures.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="page">
          <div className="card text-center p-12">
            <Trophy size={48} style={{ margin: '0 auto 16px', opacity: 0.3, color: '#f9c000' }} />
            <h2 className="font-rajdhani text-2xl font-bold mb-3">Playoffs Not Started Yet</h2>
            <p className="text-muted mb-6">
              Complete all 90 league matches to qualify the top 4 teams.
            </p>
            <button className="btn btn-gold" onClick={() => navigate('/fixtures')}>
              Go to Fixtures
            </button>
          </div>

          {/* Show current top 4 */}
          {table.length > 0 && (
            <div className="mt-6">
              <h3 className="font-rajdhani text-lg font-bold mb-3">Current Top 4</h3>
              <div className="grid-2" style={{ maxWidth: 600 }}>
                {table.slice(0, 4).map((row, i) => (
                  <div key={row.teamId} className="card card-sm flex items-center gap-3">
                    <span className="font-orbitron text-gold font-bold text-lg">#{i + 1}</span>
                    <div className="team-logo" style={{
                      width: 36, height: 36, fontSize: 10, borderRadius: 8,
                      background: `${row.team?.primaryColor}22`, color: row.team?.primaryColor,
                      border: `1.5px solid ${row.team?.primaryColor}44`,
                    }}>{row.team?.logoInitials}</div>
                    <div>
                      <p className="font-rajdhani font-bold">{row.team?.name}</p>
                      <p className="text-xs text-muted">{row.points} pts · NRR {row.nrr > 0 ? '+' : ''}{row.nrr.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="page">
        <div className="page-header">
          <h1 className="font-rajdhani page-title">
            <span className="gold-text">PLAYOFFS</span>
          </h1>
          <p className="text-muted text-sm mt-1">Top 4 battle for the IPL trophy</p>
        </div>

        {/* Champion banner */}
        {champion && (
          <div className="card mb-8 text-center p-8 pulse-gold animate-pop" style={{
            background: `${champion.primaryColor}12`,
            borderColor: `${champion.primaryColor}44`,
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
            <p className="text-muted text-sm mb-2">IPL CHAMPION</p>
            <div className="team-logo" style={{
              width: 72, height: 72, fontSize: 20, borderRadius: 16, margin: '0 auto 12px',
              background: `${champion.primaryColor}22`, color: champion.primaryColor,
              border: `3px solid ${champion.primaryColor}66`,
            }}>{champion.logoInitials}</div>
            <h2 className="font-orbitron text-3xl font-bold" style={{ color: champion.primaryColor }}>
              {champion.name}
            </h2>
          </div>
        )}

        {/* Bracket */}
        <div className="grid-2 gap-6">
          {PLAYOFF_ROUNDS.map((round) => {
            const info = ROUND_INFO[round];
            const fix  = getByRound(round);
            return (
              <div key={round}>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 20 }}>{info.emoji}</span>
                  <div>
                    <h3 className="font-rajdhani font-bold text-base">{info.label}</h3>
                    <p className="text-xs text-muted">{info.desc}</p>
                  </div>
                </div>
                <PlayoffCard
                  fixture={fix}
                  userTeamId={gameSetup?.userTeamId}
                  onPlay={(id) => navigate(`/pre-match/${id}`)}
                  onSimulate={handleSimulate}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
