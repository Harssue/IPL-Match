import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { Trophy, Users, ChevronRight, Zap, AlertCircle, Check, ArrowRight, FlaskConical, Shuffle } from 'lucide-react';

// ── Team picker modal (after seeding) ────────────────────────────────
function TestTeamPicker({ gameId, lobbyCode, gameTeams, onPick, onCancel }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="modal-backdrop">
      <div className="modal animate-pop" style={{ maxWidth: 540 }}>
        <div className="text-center mb-6">
          <div style={{ fontSize: 44, marginBottom: 10 }}>🏏</div>
          <h2 className="font-rajdhani font-bold" style={{ fontSize: 26 }}>
            Pick Your Team
          </h2>
          
          <div style={{
            display: 'inline-block', padding: '6px 18px', borderRadius: 99,
            background: 'rgba(249,192,0,0.08)', border: '1px solid rgba(249,192,0,0.25)',
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color: '#f9c000',
            margin: '12px 0'
          }}>
            LOBBY CODE: {lobbyCode}
          </div>
          <p className="text-muted text-xs mt-2" style={{ maxWidth: 360, margin: '0 auto' }}>
            All 10 teams have been created with 25 real players each. Share the Lobby Code above so a second player can join the same game!
          </p>
        </div>

        <div
          className="flex flex-col gap-2 mb-5"
          style={{ maxHeight: 300, overflowY: 'auto' }}
        >
          {gameTeams.map((gt) => {
            const isSel = selected?.id === gt.id;
            return (
              <button
                key={gt.id}
                onClick={() => setSelected(gt)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  background: isSel ? `${gt.team?.primaryColor}12` : 'var(--bg-card)',
                  border: `2px solid ${isSel ? `${gt.team?.primaryColor}50` : 'transparent'}`,
                  transition: 'all var(--ease)', textAlign: 'left', width: '100%',
                }}
              >
                <div
                  className="team-logo"
                  style={{
                    width: 42, height: 42, borderRadius: 11, fontSize: 11, flexShrink: 0,
                    background: `${gt.team?.primaryColor}20`,
                    color: gt.team?.primaryColor,
                    border: `1.5px solid ${gt.team?.primaryColor}45`,
                  }}
                >
                  {gt.team?.logoInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-rajdhani font-bold truncate"
                    style={{ fontSize: 15, color: isSel ? gt.team?.primaryColor : 'var(--text)' }}
                  >
                    {gt.team?.name}
                  </p>
                  <p className="text-muted text-xs">{gt.team?.shortName} · 25 real players</p>
                </div>
                {isSel && (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(34,197,94,0.2)', border: '1.5px solid rgba(34,197,94,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} color="#4ade80" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-gold flex-1"
            disabled={!selected}
            onClick={() => onPick(selected)}
          >
            <Zap size={16} /> Enter Match Zone
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { saveSetup, gameSetup, clearSetup } = useApp();
  const navigate = useNavigate();

  const [games,        setGames]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedGT,   setSelectedGT]   = useState(null);
  const [initing,      setIniting]      = useState(false);
  
  // Seeder & Join codes
  const [seeding,      setSeeding]      = useState(false);
  const [seedResult,   setSeedResult]   = useState(null); // { gameId, lobbyCode, gameTeams }
  const [joinCode,     setJoinCode]     = useState('');
  const [joining,      setJoining]      = useState(false);
  const [clearing,     setClearing]     = useState(false);

  useEffect(() => {
    api.getGames()
      .then((d) => setGames(d.games || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleClearAll() {
    if (!window.confirm("Are you sure you want to delete all game rooms? This will permanently wipe all league squads, fixtures, match history, and active seasons!")) {
      return;
    }
    setClearing(true);
    setError('');
    try {
      await api.clearAllGames();
      setGames([]);
      setSelectedGame(null);
      setSelectedGT(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setClearing(false);
    }
  }

  async function handleEnter() {
    if (!selectedGame || !selectedGT) return;
    setIniting(true);
    try {
      await api.initFixtures(selectedGame.id, selectedGT.id);
      saveSetup({
        auctionGameId:  selectedGame.id,
        userGameTeamId: selectedGT.id,
        userTeamId:     selectedGT.teamId,
        userTeamName:   selectedGT.team?.name,
        userTeamShort:  selectedGT.team?.shortName,
        userTeamColor:  selectedGT.team?.primaryColor || '#f9c000',
        userTeamLogo:   selectedGT.team?.logoInitials,
      });
      navigate('/fixtures');
    } catch (e) {
      setError(e.message);
    } finally {
      setIniting(false);
    }
  }

  async function handleSeedTest() {
    setSeeding(true);
    setError('');
    try {
      const result = await api.seedTest();
      // Build gameTeams with team info from the seeder result
      const enriched = result.gameTeams.map((gt) => {
        const team = result.teams.find((t) => t.id === gt.teamId);
        return { ...gt, team };
      });
      setSeedResult({
        gameId: result.gameId,
        lobbyCode: result.lobbyCode,
        gameTeams: enriched
      });
      // Reload games list so the new game appears
      const d = await api.getGames();
      setGames(d.games || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }

  async function handlePickTestTeam(gt) {
    setIniting(true);
    try {
      const fullGame = games.find((g) => g.id === seedResult.gameId);
      const fullGT   = fullGame?.gameTeams.find((t) => t.teamId === gt.teamId);

      await api.initFixtures(seedResult.gameId, gt.id);
      saveSetup({
        auctionGameId:  seedResult.gameId,
        userGameTeamId: gt.id,
        userTeamId:     gt.teamId,
        userTeamName:   gt.team?.name || fullGT?.team?.name,
        userTeamShort:  gt.team?.shortName || fullGT?.team?.shortName,
        userTeamColor:  gt.team?.primaryColor || fullGT?.team?.primaryColor || '#f9c000',
        userTeamLogo:   gt.team?.logoInitials || fullGT?.team?.logoInitials,
      });
      navigate('/fixtures');
    } catch (e) {
      setError(e.message);
    } finally {
      setIniting(false);
      setSeedResult(null);
    }
  }

  async function handleJoinByCode(e) {
    e.preventDefault();
    if (!joinCode || joinCode.length < 4) return;
    setJoining(true);
    setError('');
    try {
      const d = await api.gameByCode(joinCode.toUpperCase());
      setSelectedGame(d);
      setSelectedGT(null);
      setJoinCode('');
    } catch (err) {
      setError(err.message || 'Game lobby code not found.');
    } finally {
      setJoining(false);
    }
  }

  // ── Resume screen ─────────────────────────────────────────────────
  if (gameSetup) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 p-6" style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', width: 600, height: 600, borderRadius: '50%',
            background: `radial-gradient(circle, ${gameSetup.userTeamColor}10, transparent 70%)`,
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }} />
          <div className="animate-up" style={{ maxWidth: 440, width: '100%', position: 'relative' }}>
            <div className="card mb-4 text-center" style={{
              padding: '40px 32px',
              background: `linear-gradient(160deg, ${gameSetup.userTeamColor}0e, rgba(8,12,24,0.95))`,
              border: `1px solid ${gameSetup.userTeamColor}30`,
            }}>
              <div className="team-logo" style={{
                width: 88, height: 88, borderRadius: 22, fontSize: 26,
                margin: '0 auto 20px',
                background: `${gameSetup.userTeamColor}20`,
                color: gameSetup.userTeamColor,
                border: `2px solid ${gameSetup.userTeamColor}45`,
                boxShadow: `0 0 32px ${gameSetup.userTeamColor}20`,
              }}>
                {gameSetup.userTeamLogo}
              </div>
              <p className="section-label mb-2">Currently playing as</p>
              <h2 className="font-rajdhani font-bold" style={{ fontSize: 30, color: gameSetup.userTeamColor, marginBottom: 8 }}>
                {gameSetup.userTeamName}
              </h2>
              <p className="text-sub text-sm">{gameSetup.userTeamShort} · Season underway</p>
            </div>
            <div className="flex gap-3">
              <button className="btn btn-gold btn-lg flex-1" onClick={() => navigate('/fixtures')}>
                <Zap size={19} /> Continue Season
              </button>
              <button className="btn btn-ghost" onClick={clearSetup} style={{ padding: '14px 18px' }}>
                <Users size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Team picker modal after seeding */}
      {seedResult && (
        <TestTeamPicker
          gameId={seedResult.gameId}
          lobbyCode={seedResult.lobbyCode}
          gameTeams={seedResult.gameTeams}
          onPick={handlePickTestTeam}
          onCancel={() => setSeedResult(null)}
        />
      )}

      {/* Hero */}
      <div className="text-center" style={{ padding: '56px 24px 36px' }}>
        <div className="section-label mb-3" style={{ color: 'var(--gold)', letterSpacing: '4px' }}>
          ✦ HAND CRICKET SIMULATION ✦
        </div>
        <h1 className="font-rajdhani font-bold gold-text"
          style={{ fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: 1, marginBottom: 16 }}
        >
          IPL MATCH ZONE
        </h1>
        <p className="text-sub" style={{ fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
          Import your auction squad, generate 90 fixtures, and play matches against AI or human players.
        </p>
      </div>

      <div className="page page-sm" style={{ paddingTop: 0 }}>
        {/* Error */}
        {error && (
          <div className="animate-up mb-6 flex items-center gap-3" style={{
            padding: '16px 20px', borderRadius: 14,
            background: 'var(--red-bg)', border: '1px solid var(--red-border)', color: '#fca5a5',
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div>
              <p className="font-bold mb-1">Error</p>
              <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Quick Test & Join Code Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 24
        }}>
          
          {/* Quick Test Card */}
          <div
            className="card animate-up"
            style={{
              background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(8,12,24,0.95))',
              border: '1px solid rgba(167,139,250,0.2)',
              padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={18} style={{ color: '#a78bfa' }} />
                <span className="font-rajdhani font-bold" style={{ fontSize: 18, color: '#a78bfa' }}>
                  Quick Test Mode
                </span>
              </div>
              <p className="text-sub text-sm" style={{ marginBottom: 12 }}>
                Generate 10 random teams populated with real players and balanced roles instantly.
              </p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['10 Real Teams', '25 Players/Team', 'Real Roles'].map((tag) => (
                  <span key={tag} className="badge badge-purple" style={{ fontSize: 10 }}>{tag}</span>
                ))}
              </div>
            </div>
            <button
              className="btn btn-lg w-full"
              onClick={handleSeedTest}
              disabled={seeding}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', boxShadow: '0 4px 16px rgba(167,139,250,0.2)',
              }}
            >
              {seeding ? (
                <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} /> Seeding…</>
              ) : (
                <><Shuffle size={16} /> Generate Test Game</>
              )}
            </button>
          </div>

          {/* Join by Lobby Code Card */}
          <div
            className="card animate-up"
            style={{
              background: 'linear-gradient(135deg, rgba(249,192,0,0.04), rgba(8,12,24,0.95))',
              border: '1px solid rgba(249,192,0,0.15)',
              padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} style={{ color: '#f9c000' }} />
                <span className="font-rajdhani font-bold" style={{ fontSize: 18, color: '#f9c000' }}>
                  Join Multiplayer Game
                </span>
              </div>
              <p className="text-sub text-sm mb-4">
                Enter a 6-character lobby code to join an active test game or a completed auction room!
              </p>
            </div>

            <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                type="text"
                placeholder="ENTER LOBBY CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(249,192,0,0.2)',
                  color: '#fff', fontFamily: 'Orbitron, sans-serif', fontWeight: 900,
                  fontSize: 15, textTransform: 'uppercase', letterSpacing: 2,
                  textAlign: 'center'
                }}
                disabled={joining}
              />
              <button
                type="submit"
                className="btn btn-gold"
                disabled={joining || joinCode.length < 4}
                style={{ minWidth: 100 }}
              >
                {joining ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  'JOIN'
                )}
              </button>
            </form>
          </div>

        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6 font-rajdhani font-bold" style={{ opacity: 0.6 }}>
          <div className="divider flex-1" />
          <span className="section-label">or use auction history</span>
          <div className="divider flex-1" />
        </div>

        {/* Step 1 & 2 Game Selection Panels */}
        {!loading && (
          <div className="flex gap-5 flex-wrap animate-up" style={{ alignItems: 'flex-start' }}>
            
            {/* Step 1: Select Game Room (only shown if games list is loaded and has entries) */}
            {games.length > 0 && (
              <div className="flex-1" style={{ minWidth: 260 }}>
                <div className="flex items-center justify-between mb-3" style={{ width: '100%' }}>
                  <div className="flex items-center gap-2">
                    <div className="badge badge-gold">STEP 1</div>
                    <span className="font-rajdhani font-bold text-base">Select Game Room</span>
                  </div>
                  <button 
                    onClick={handleClearAll} 
                    disabled={clearing}
                    className="btn btn-ghost btn-xs"
                    style={{ 
                      fontSize: 11, 
                      padding: '3px 8px', 
                      borderColor: 'rgba(239,68,68,0.2)',
                      color: '#f87171',
                      background: 'rgba(239,68,68,0.05)',
                    }}
                  >
                    🗑️ {clearing ? 'Clearing...' : 'Clear All'}
                  </button>
                </div>
                <div className="flex flex-col gap-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {games.map((g) => {
                    const isSel = selectedGame?.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => { setSelectedGame(g); setSelectedGT(null); }}
                        style={{
                          background: isSel ? 'rgba(249,192,0,0.06)' : 'var(--bg-card)',
                          border: `1px solid ${isSel ? 'rgba(249,192,0,0.35)' : 'var(--border)'}`,
                          borderRadius: 16, padding: '14px 18px',
                          cursor: 'pointer', transition: 'all var(--ease)',
                          textAlign: 'left', width: '100%',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-rajdhani font-bold" style={{ fontSize: 16, color: isSel ? '#f9c000' : 'var(--text)' }}>
                              {g.lobbyCode}
                              {g.status === 'test' && (
                                <span className="badge badge-purple ml-2" style={{ fontSize: 9, verticalAlign: 'middle' }}>TEST</span>
                              )}
                            </p>
                            <p className="text-muted text-xs mt-1">
                              {g.gameTeams.length} teams · {g.squadCount} players
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${g.status === 'test' ? 'badge-purple' : 'badge-green'}`}>
                              {g.status === 'test' ? '🧪 Test' : 'Auction'}
                            </span>
                            {isSel && <ChevronRight size={16} style={{ color: '#f9c000' }} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Pick Your Team (shown as long as a game is selected, even if joined by code!) */}
            {selectedGame && (
              <div className="flex-1 animate-up" style={{ minWidth: 260 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="badge badge-gold">STEP 2</div>
                  <span className="font-rajdhani font-bold text-base">Pick Your Team ({selectedGame.lobbyCode})</span>
                </div>
                <div className="flex flex-col gap-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {selectedGame.gameTeams.map((gt) => {
                    const t = gt.team;
                    const isSel = selectedGT?.id === gt.id;
                    return (
                      <button
                        key={gt.id}
                        onClick={() => setSelectedGT(gt)}
                        style={{
                          background: isSel ? `${t?.primaryColor}10` : 'var(--bg-card)',
                          border: `2px solid ${isSel ? `${t?.primaryColor}50` : 'transparent'}`,
                          borderRadius: 14, padding: '12px 16px',
                          cursor: 'pointer', transition: 'all var(--ease)',
                          textAlign: 'left', width: '100%',
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}
                      >
                        <div className="team-logo" style={{
                          width: 42, height: 42, borderRadius: 11, fontSize: 11, flexShrink: 0,
                          background: `${t?.primaryColor}20`, color: t?.primaryColor,
                          border: `1.5px solid ${t?.primaryColor}45`,
                        }}>
                          {t?.logoInitials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-rajdhani font-bold truncate"
                            style={{ fontSize: 15, color: isSel ? t?.primaryColor : 'var(--text)' }}>
                            {t?.name}
                          </p>
                          <p className="text-muted text-xs mt-0.5">
                            {gt.squadSize > 0 ? `${gt.squadSize} players` : 'Squad ready'}
                          </p>
                        </div>
                        {isSel && (
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(34,197,94,0.2)', border: '1.5px solid rgba(34,197,94,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Check size={12} color="#4ade80" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* CTA */}
        {selectedGame && selectedGT && (
          <div className="animate-up text-center mt-8">
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 999,
              background: `${selectedGT.team?.primaryColor}12`,
              border: `1px solid ${selectedGT.team?.primaryColor}30`,
              marginBottom: 16,
            }}>
              <div className="team-logo" style={{
                width: 22, height: 22, borderRadius: 6, fontSize: 8,
                background: `${selectedGT.team?.primaryColor}25`,
                color: selectedGT.team?.primaryColor,
              }}>
                {selectedGT.team?.logoInitials}
              </div>
              <span className="font-rajdhani font-bold text-sm" style={{ color: selectedGT.team?.primaryColor }}>
                {selectedGT.team?.name}
              </span>
            </div>
            <div>
              <button
                className="btn btn-gold btn-lg"
                onClick={handleEnter}
                disabled={initing}
                style={{ minWidth: 260, fontSize: 17 }}
              >
                {initing ? (
                  <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Setting up…</>
                ) : (
                  <><Zap size={20} /> Enter Match Zone <ArrowRight size={17} /></>
                )}
              </button>
              <p className="text-muted mt-3" style={{ fontSize: 11 }}>
                90 league fixtures · Double round-robin · Full hand cricket rules
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
