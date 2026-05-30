import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { Globe, Check, ChevronRight, Zap } from 'lucide-react';

const ROLE_COLORS = {
  'Batsman':      '#3b82f6',
  'Bowler':       '#ef4444',
  'All-Rounder':  '#a855f7',
  'Wicketkeeper': '#f59e0b',
};

// ── Step 1: Toss ──────────────────────────────────────────────────────
function TossStep({ socket, fixture, homeTeam, awayTeam, userTeamId, isOpponentAI, opponentConnected, onDone }) {
  const [call,     setCall]     = useState(null);
  const [choice,   setChoice]   = useState('bat');
  const [spinning, setSpinning] = useState(false);
  const [result,   setResult]   = useState(null);
  const [step,     setStep]     = useState('pick-call');

  const isHome = userTeamId === homeTeam?.id;

  useEffect(() => {
    if (!socket) return;
    socket.on('toss-resolved', (data) => {
      setResult(data);
      setStep('reveal');
    });
    return () => {
      socket.off('toss-resolved');
    };
  }, [socket]);

  function handleToss() {
    if (!call || !socket) return;
    setSpinning(true);
    setTimeout(() => {
      socket.emit('conduct-toss', { call, choice });
      setSpinning(false);
    }, 1200);
  }

  const canCallToss = isHome || isOpponentAI;

  const didIWinToss = result?.tossWinnerId === userTeamId;
  const tossWinnerName = didIWinToss
    ? 'You won'
    : (homeTeam?.id === result?.tossWinnerId ? homeTeam : awayTeam)?.name + ' won';

  return (
    <div className="flex flex-col items-center gap-6" style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
      <h2 className="font-rajdhani text-2xl font-bold text-center">🪙 The Toss</h2>

      {/* Connection indicator */}
      {!isOpponentAI && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 99, fontSize: 12,
          background: opponentConnected ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: opponentConnected ? '#4ade80' : '#f87171',
          border: `1px solid ${opponentConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: opponentConnected ? '#4ade80' : '#f87171',
            display: 'inline-block'
          }} />
          {opponentConnected ? 'Opponent Connected' : 'Waiting for Opponent to Connect...'}
        </div>
      )}

      {/* Teams */}
      <div className="flex items-center gap-4 w-full">
        <div className="card flex-1 text-center p-4">
          <div className="team-logo" style={{
            width: 48, height: 48, fontSize: 14, borderRadius: 12, margin: '0 auto 8px',
            background: `${homeTeam?.primaryColor}22`, color: homeTeam?.primaryColor,
            border: `1.5px solid ${homeTeam?.primaryColor}44`,
          }}>{homeTeam?.logoInitials}</div>
          <p className="font-rajdhani font-bold">{homeTeam?.name}</p>
          {isHome && <span className="badge badge-gold mt-2">YOU</span>}
        </div>
        <div className="font-orbitron text-gold font-bold">VS</div>
        <div className="card flex-1 text-center p-4">
          <div className="team-logo" style={{
            width: 48, height: 48, fontSize: 14, borderRadius: 12, margin: '0 auto 8px',
            background: `${awayTeam?.primaryColor}22`, color: awayTeam?.primaryColor,
            border: `1.5px solid ${awayTeam?.primaryColor}44`,
          }}>{awayTeam?.logoInitials}</div>
          <p className="font-rajdhani font-bold">{awayTeam?.name}</p>
          {!isHome && <span className="badge badge-gold mt-2">YOU</span>}
        </div>
      </div>

      {step === 'pick-call' && (
        <div className="card w-full p-6 text-center animate-up">
          {canCallToss ? (
            <>
              <p className="text-muted mb-4">You are playing at home. Pick a side for the coin flip</p>
              <div className="flex gap-4 justify-center mb-6">
                <button
                  className={`coin ${spinning ? 'spinning' : ''}`}
                  style={{ fontSize: 40, cursor: 'default' }}
                >
                  {spinning ? '🪙' : (call === 'heads' ? '👑' : call === 'tails' ? '🦅' : '🪙')}
                </button>
              </div>
              <div className="flex gap-3 justify-center mb-6">
                {['heads', 'tails'].map((c) => (
                  <button
                    key={c}
                    className={`btn ${call === c ? 'btn-gold' : 'btn-ghost'} btn-lg`}
                    onClick={() => setCall(c)}
                    disabled={spinning}
                  >
                    {c === 'heads' ? '👑 HEADS' : '🦅 TAILS'}
                  </button>
                ))}
              </div>
              {call && (
                <div className="animate-up">
                  <p className="text-muted text-sm mb-3">If you win, you choose to:</p>
                  <div className="flex gap-3 justify-center mb-6">
                    {['bat', 'bowl'].map((c) => (
                      <button
                        key={c}
                        className={`btn ${choice === c ? 'btn-gold' : 'btn-ghost'}`}
                        onClick={() => setChoice(c)}
                      >
                        {c === 'bat' ? '🏏 BAT FIRST' : '⚡ BOWL FIRST'}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-gold btn-lg w-full" onClick={handleToss} disabled={spinning}>
                    {spinning ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Flipping…</> : 'FLIP THE COIN!'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-8">
              <div className="spinner mb-4" style={{ margin: '0 auto', width: 32, height: 32 }} />
              <p className="font-rajdhani text-lg font-bold text-gold">Waiting for Home Team to Toss...</p>
              <p className="text-muted text-sm mt-1">The toss is decided by the home team.</p>
            </div>
          )}
        </div>
      )}

      {step === 'reveal' && result && (
        <div className="card w-full p-6 text-center animate-pop">
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {result.result === 'heads' ? '👑' : '🦅'}
          </div>
          <p className="font-orbitron text-lg font-bold text-gold mb-2">
            {result.result.toUpperCase()}!
          </p>
          <p className="font-rajdhani text-2xl font-bold mb-1">
            {didIWinToss ? '🎉 You won the toss!' : `${tossWinnerName} the toss`}
          </p>
          <p className="text-muted mb-6">
            {didIWinToss
              ? `You chose to ${result.tossChoice} first`
              : `Opposition chose to ${result.tossChoice} first`}
          </p>
          <button className="btn btn-gold btn-lg w-full" onClick={onDone}>
            Continue to Playing XI <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helper: pick random XI ────────────────────────────────────────────
function pickRandomXI(squad) {
  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  const wk          = shuffle(squad.filter((s) => s.player?.role === 'Wicketkeeper'));
  const bat         = shuffle(squad.filter((s) => s.player?.role === 'Batsman'));
  const ar          = shuffle(squad.filter((s) => s.player?.role === 'All-Rounder'));
  const bow         = shuffle(squad.filter((s) => s.player?.role === 'Bowler'));
  const bowlingPool = [...bow, ...ar];
  const battingPool = [...bat, ...ar];

  const selected = [];
  const usedIds  = new Set();

  function pickN(pool, n) {
    for (const s of pool) {
      if (n <= 0 || selected.length >= 11) break;
      if (!s.player || usedIds.has(s.player.id)) continue;
      const overseas = selected.filter((x) => x.player?.nationality === 'Overseas').length;
      if (s.player.nationality === 'Overseas' && overseas >= 4) continue;
      selected.push(s);
      usedIds.add(s.player.id);
      n--;
    }
  }

  pickN(wk,          1);
  pickN(bowlingPool, 4);
  pickN(battingPool, 6);
  pickN(shuffle(squad.filter((s) => s.player)), 11);

  return selected.map((s) => s.player.id);
}

// ── Step 2: Playing XI ────────────────────────────────────────────────
function PlayingXIStep({ squad, onDone }) {
  const [selected, setSelected] = useState([]);
  const [filter,   setFilter]   = useState('All');

  const ROLES = ['All', 'Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];

  const toggle = (playerId) => {
    setSelected((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : prev.length < 11 ? [...prev, playerId] : prev
    );
  };

  const handleRandomXI = () => setSelected(pickRandomXI(squad));

  const comp = selected.reduce((acc, id) => {
    const role = squad.find((s) => s.player?.id === id)?.player?.role;
    if (role) acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  const overseas = selected.filter((id) =>
    squad.find((s) => s.player?.id === id)?.player?.nationality === 'Overseas'
  ).length;

  const displaySquad = squad.filter((s) => filter === 'All' || s.player?.role === filter);

  const goals = [
    { key: 'wk',  label: '1 WK',     color: ROLE_COLORS['Wicketkeeper'],
      current: comp['Wicketkeeper'] || 0, target: 1 },
    { key: 'bat', label: '6 BAT/AR', color: ROLE_COLORS['Batsman'],
      current: (comp['Batsman'] || 0) + (comp['All-Rounder'] || 0), target: 6 },
    { key: 'bow', label: '4 BOW/AR', color: ROLE_COLORS['Bowler'],
      current: (comp['Bowler'] || 0) + (comp['All-Rounder'] || 0), target: 4 },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', width: '100%' }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-rajdhani text-2xl font-bold">🏏 Select Playing XI</h2>
          <p className="text-muted text-sm mt-1">Choose exactly 11 · Max 4 overseas</p>
        </div>
        <button className="btn btn-gold" onClick={handleRandomXI}>
          🎲 Random XI
        </button>
      </div>

      <div
        className="flex items-center gap-4 flex-wrap mb-3"
        style={{
          padding: '11px 16px', borderRadius: 12,
          background: 'rgba(249,192,0,0.04)', border: '1px solid rgba(249,192,0,0.12)',
        }}
      >
        <span className="section-label">Composition</span>
        {goals.map(({ key, label, color, current, target }) => (
          <span
            key={key}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 13,
              color: current >= target ? '#4ade80' : color,
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
              background: current >= target ? 'rgba(34,197,94,0.15)' : `${color}15`,
              border: `1.5px solid ${current >= target ? '#4ade80' : color}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            }}>
              {current >= target ? '✓' : current}
            </span>
            {label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className={`badge ${selected.length === 11 ? 'badge-green' : 'badge-muted'}`}>
          {selected.length}/11 selected
        </div>
        <div className={`badge ${overseas > 4 ? 'badge-red' : overseas > 0 ? 'badge-blue' : 'badge-muted'}`}>
          <Globe size={10} /> {overseas}/4 overseas
        </div>
        {Object.entries(comp).map(([role, count]) => (
          <div
            key={role}
            style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              fontFamily: 'Rajdhani, sans-serif',
              background: `${ROLE_COLORS[role]}12`,
              color: ROLE_COLORS[role],
              border: `1px solid ${ROLE_COLORS[role]}28`,
            }}
          >
            {role === 'Wicketkeeper' ? 'WK' : role === 'All-Rounder' ? 'AR' : role === 'Batsman' ? 'BAT' : 'BOW'} {count}
          </div>
        ))}
        {selected.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={() => setSelected([])} style={{ marginLeft: 'auto' }}>
            Clear All
          </button>
        )}
      </div>

      <div className="pill-tabs mb-4" style={{ flexWrap: 'wrap' }}>
        {ROLES.map((r) => {
          const cnt = r === 'All' ? squad.length : squad.filter((s) => s.player?.role === r).length;
          return (
            <button key={r} className={`pill-tab ${filter === r ? 'active' : ''}`} onClick={() => setFilter(r)}>
              {r === 'Wicketkeeper' ? 'WK' : r}
              {cnt > 0 && <span style={{ opacity: 0.6, marginLeft: 3, fontSize: 10 }}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {displaySquad.length === 0 && (
          <p className="text-muted text-sm text-center py-8">No players with this role in the squad.</p>
        )}
        {displaySquad.map(({ player, soldPrice }) => {
          if (!player) return null;
          const isSelected  = selected.includes(player.id);
          const isOverseas  = player.nationality === 'Overseas';
          const wouldExceed = !isSelected && overseas >= 4 && isOverseas;

          return (
            <div
              key={player.id}
              className={`player-card ${isSelected ? 'selected' : ''} ${wouldExceed ? 'disabled' : ''}`}
              onClick={() => !wouldExceed && toggle(player.id)}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: isSelected ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isSelected ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && <Check size={12} color="#22c55e" />}
              </div>

              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: ROLE_COLORS[player.role] || '#555',
              }} />

              <div className="flex-1 min-w-0">
                <p className="font-rajdhani font-bold truncate" style={{ fontSize: 14 }}>
                  {player.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span style={{ fontSize: 11, color: ROLE_COLORS[player.role] || '#888', fontWeight: 600 }}>
                    {player.role}
                  </span>
                  {isOverseas && (
                    <span className="badge badge-blue" style={{ fontSize: 9, padding: '1px 5px' }}>
                      Overseas
                    </span>
                  )}
                  {player.battingStyle && (
                    <span className="text-xs text-muted truncate">{player.battingStyle}</span>
                  )}
                </div>
              </div>

              <span style={{ fontSize: 12, color: '#f9c000', fontWeight: 700, flexShrink: 0 }}>
                ₹{(soldPrice / 100).toFixed(1)}Cr
              </span>
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-gold btn-lg w-full"
        disabled={selected.length !== 11 || overseas > 4}
        onClick={() => onDone(selected)}
      >
        {selected.length === 11
          ? <>✅ Confirm Playing XI <ChevronRight size={18} /></>
          : `Select ${11 - selected.length} more player${11 - selected.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

// ── Step 3: Batting Order ─────────────────────────────────────────────
function BattingOrderStep({ squad, xiIds, onDone }) {
  const [order, setOrder] = useState([...xiIds]);

  const move = (index, direction) => {
    const newOrder = [...order];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= order.length) return;
    // Swap
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setOrder(newOrder);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }} className="animate-up">
      <h2 className="font-rajdhani text-2xl font-bold mb-2">🏏 Select Batting Order</h2>
      <p className="text-muted text-sm mb-6">
        Arrange your Playing XI into their batting positions (1 to 11). Use the Up/Down arrows to adjust their order.
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {order.map((playerId, idx) => {
          const s = squad.find((x) => x.player?.id === playerId);
          if (!s || !s.player) return null;
          const { player } = s;

          return (
            <div
              key={player.id}
              className="player-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}
            >
              {/* Position Badge */}
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: idx < 2 ? 'rgba(249,192,0,0.15)' : 'rgba(255,255,255,0.05)',
                color: idx < 2 ? '#f9c000' : 'var(--text-sub)',
                border: `1px solid ${idx < 2 ? '#f9c000' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 900,
              }}>
                {idx + 1}
              </div>

              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: ROLE_COLORS[player.role] || '#555',
              }} />

              <div className="flex-1 min-w-0">
                <p className="font-rajdhani font-bold truncate" style={{ fontSize: 14 }}>{player.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: ROLE_COLORS[player.role] || '#888', fontWeight: 600 }}>
                    {player.role}
                  </span>
                  {idx < 2 && (
                    <span className="badge badge-gold" style={{ fontSize: 9, padding: '1px 5px' }}>
                      Opener
                    </span>
                  )}
                </div>
              </div>

              {/* Up / Down Controls */}
              <div className="flex gap-1" style={{ flexShrink: 0 }}>
                <button
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  className="btn btn-ghost btn-xs"
                  style={{ width: 28, height: 28, padding: 0 }}
                >
                  ▲
                </button>
                <button
                  disabled={idx === order.length - 1}
                  onClick={() => move(idx, 1)}
                  className="btn btn-ghost btn-xs"
                  style={{ width: 28, height: 28, padding: 0 }}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-gold btn-lg w-full" onClick={() => onDone(order)}>
        Confirm Batting Order <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Step 4: Impact Subs ───────────────────────────────────────────────
function ImpactSubStep({ squad, xiIds, onDone }) {
  const [selected, setSelected] = useState([]);
  const bench = squad.filter((s) => s.player && !xiIds.includes(s.player.id));

  const toggleSelect = (playerId) => {
    if (selected.includes(playerId)) {
      setSelected(selected.filter((id) => id !== playerId));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, playerId]);
      }
    }
  };

  const isConfirmedDisabled = bench.length >= 5 ? selected.length !== 5 : selected.length !== bench.length;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }} className="animate-up">
      <h2 className="font-rajdhani text-2xl font-bold mb-2">
        <Zap size={22} style={{ color: '#f9c000', display: 'inline', marginRight: 8 }} />
        Designate 5 Impact Substitutes
      </h2>
      <p className="text-muted text-sm mb-4">
        Choose exactly 5 bench players. During the match, you can substitute any 1 of these players into the game!
      </p>

      <div className={`badge mb-4 ${selected.length === 5 || selected.length === bench.length ? 'badge-green' : 'badge-gold'}`}>
        {selected.length} of {Math.min(5, bench.length)} subs selected
      </div>

      <div className="flex flex-col gap-2 mb-6" style={{ maxHeight: 350, overflowY: 'auto' }}>
        {bench.map(({ player }) => {
          if (!player) return null;
          const isSel = selected.includes(player.id);
          const isDisabled = !isSel && selected.length >= 5;

          return (
            <div
              key={player.id}
              className={`player-card ${isSel ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && toggleSelect(player.id)}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: isSel ? 'rgba(249,192,0,0.2)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isSel ? '#f9c000' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSel && <Zap size={11} color="#f9c000" />}
              </div>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: ROLE_COLORS[player.role] || '#555',
              }} />
              <div className="flex-1 min-w-0">
                <p className="font-rajdhani font-bold truncate" style={{ fontSize: 14 }}>{player.name}</p>
                <p className="text-xs" style={{ color: ROLE_COLORS[player.role] || '#888', fontWeight: 600 }}>
                  {player.role}
                </p>
              </div>
              {isSel && <span className="badge badge-gold">SUB CHOICE</span>}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={() => onDone([])}>
          Skip (No Subs)
        </button>
        <button
          className="btn btn-gold flex-1"
          disabled={isConfirmedDisabled}
          onClick={() => onDone(selected)}
        >
          <Zap size={16} /> Confirm 5 Substitutes
        </button>
      </div>
    </div>
  );
}

// ── Main PreMatchPage ─────────────────────────────────────────────────
export default function PreMatchPage() {
  const { fixtureId } = useParams();
  const { gameSetup } = useApp();
  const navigate      = useNavigate();

  const [matchData,  setMatchData]  = useState(null);
  const [squad,      setSquad]      = useState([]);
  const [step,       setStep]       = useState(1);
  const [xiIds,      setXiIds]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Sockets
  const [socket, setSocket] = useState(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [isOpponentAI, setIsOpponentAI] = useState(true);
  const [opponentXISubmitted, setOpponentXISubmitted] = useState(false);

  useEffect(() => {
    // 1. Initial REST Load
    Promise.all([
      api.getMatch(fixtureId),
      api.getSquad(gameSetup.userGameTeamId),
    ])
      .then(([match, squadData]) => {
        setMatchData(match);
        setSquad(squadData.squad || []);
        
        const s = match.fixture.status;
        if (s === 'toss_done') setStep(2);
        else if (s === 'xi_set') setStep(4);
        else if (s === 'live' || s === 'completed') {
          navigate(`/match/${fixtureId}`, { replace: true });
        }
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));

    // 2. Establish Socket Connection dynamically based on location hostname for LAN tests
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:5001' 
      : `${window.location.protocol}//${window.location.hostname}:5001`;

    const s = io(socketUrl);
    setSocket(s);

    s.on('connect', () => {
      s.emit('join-match', {
        fixtureId,
        userGameTeamId: gameSetup.userGameTeamId,
      });
    });

    s.on('match-status', (data) => {
      setMatchData(prev => {
        if (!prev) return null;
        return { ...prev, fixture: data.fixture };
      });
      
      const isHome = gameSetup.userTeamId === data.fixture.homeTeamId;
      const opConnected = isHome ? data.awayConnected : data.homeConnected;

      setOpponentConnected(data.isOpponentAI ? true : opConnected);
      setIsOpponentAI(data.isOpponentAI);

      const status = data.fixture.status;
      if (status === 'toss_done') setStep(2);
      else if (status === 'xi_set') setStep(4);
      else if (status === 'live' || status === 'completed') {
        navigate(`/match/${fixtureId}`, { replace: true });
      }
    });

    s.on('opponent-disconnected', () => {
      setOpponentConnected(false);
    });

    s.on('toss-resolved', (data) => {
      setMatchData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          fixture: {
            ...prev.fixture,
            status: data.fixtureStatus,
            tossWinnerId: data.tossWinnerId,
            tossChoice: data.tossChoice,
          }
        };
      });
      // Do not set step(2) instantly so players get to view the reveal flip screen!
    });

    s.on('opponent-xi-submitted', () => {
      setOpponentXISubmitted(true);
    });

    s.on('match-started', (data) => {
      navigate(`/match/${fixtureId}`);
    });

    return () => {
      s.disconnect();
    };
  }, [fixtureId, gameSetup, navigate]);

  function handleXIDone(playerIds) {
    setXiIds(playerIds);
    setStep(3);
  }

  function handleBattingOrderDone(orderedPlayerIds) {
    setXiIds(orderedPlayerIds);
    setStep(4);
  }

  async function handleImpactSubDone(impactSubId) {
    if (!socket) return;
    setSubmitting(true);
    
    // Emit through socket instead of REST to coordinate multiplayer
    socket.emit('submit-playing-xi', {
      playerIds: xiIds,
      impactSubId,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="spinner" />
          <p className="text-muted text-sm">Loading lobby…</p>
        </div>
      </div>
    );
  }

  const { fixture, homeTeam, awayTeam } = matchData || {};

  // Show multiplayer waiting screen if one player submits Playing XI first
  const showWaiting = submitting;

  if (showWaiting) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-6">
          <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
          <h3 className="font-rajdhani text-2xl font-bold text-gold mt-2">Waiting for Opponent</h3>
          <p className="text-sub text-sm max-w-xs">
            Your Playing XI has been submitted. Waiting for the opposition to select their team. The match will start automatically once both are ready!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="page">
        {/* Step indicator */}
        <div className="step-indicator" style={{ maxWidth: 500, margin: '0 auto 40px' }}>
          {[1, 2, 3, 4].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
              <div className={`step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {i < 3 && <div className={`step-line ${step > s ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
        <div className="text-center text-muted text-xs mb-8" style={{ marginTop: -24 }}>
          {['Toss', 'Playing XI', 'Batting Order', 'Impact Subs'][step - 1]}
        </div>

        {/* Match info bar */}
        <div
          className="card card-sm flex items-center justify-between gap-4 mb-8"
          style={{ maxWidth: 500, margin: '0 auto 32px' }}
        >
          <span className="text-muted text-xs">Match #{fixture?.matchNumber}</span>
          <span className="font-rajdhani font-bold text-sm">
            {homeTeam?.shortName} vs {awayTeam?.shortName}
          </span>
          <span className="text-muted text-xs truncate" style={{ maxWidth: 160 }}>
            📍 {fixture?.venue?.split(',')[0]}
          </span>
        </div>

        {step === 1 && (
          <TossStep
            socket={socket}
            fixture={fixture}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            userTeamId={gameSetup.userTeamId}
            isOpponentAI={isOpponentAI}
            opponentConnected={opponentConnected}
            onDone={() => setStep(2)}
          />
        )}
        {step === 2 && <PlayingXIStep squad={squad} onDone={handleXIDone} />}
        {step === 3 && <BattingOrderStep squad={squad} xiIds={xiIds} onDone={handleBattingOrderDone} />}
        {step === 4 && (
          <ImpactSubStep squad={squad} xiIds={xiIds} onDone={handleImpactSubDone} />
        )}
      </div>
    </div>
  );
}
