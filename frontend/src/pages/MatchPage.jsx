import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import Navbar from '../components/Navbar.jsx';
import { Zap, ChevronRight, MapPin, Users, Award, ShieldAlert } from 'lucide-react';

const FINGERS = [1, 2, 3, 4, 6];

const ROLE_COLORS = {
  'Batsman':      '#60a5fa',
  'Bowler':       '#f87171',
  'All-Rounder':  '#a78bfa',
  'Wicketkeeper': '#fbbf24',
};

function formatOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

// ── Redesigned Symmetrical Scoreboard ─────────────────────────────────
function StadiumScoreboard({ innings, homeTeam, awayTeam, userTeamId, fixture, opponentConnected, isOpponentAI }) {
  if (!innings) return null;

  const battingTeam  = innings.battingTeamId === homeTeam?.id ? homeTeam : awayTeam;
  const bowlingTeam  = innings.battingTeamId === homeTeam?.id ? awayTeam : homeTeam;
  
  const overs        = formatOvers(innings.totalBalls);
  const ballsLeft    = 120 - innings.totalBalls;
  const runsNeeded   = innings.target ? innings.target - innings.totalRuns : null;
  const isUserBatting = innings.battingTeamId === userTeamId;

  return (
    <div style={{
      background: 'rgba(6, 10, 24, 0.9)',
      borderBottom: '1px solid rgba(249, 192, 0, 0.15)',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
      padding: '12px 20px',
      width: '100%',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        
        {/* Left: Batting Team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div className="team-logo" style={{
            width: 40, height: 40, borderRadius: 10, fontSize: 11, flexShrink: 0,
            background: `${battingTeam?.primaryColor}20`,
            color: battingTeam?.primaryColor,
            border: `2px solid ${battingTeam?.primaryColor}45`,
          }}>
            {battingTeam?.logoInitials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="font-rajdhani font-bold truncate" style={{ fontSize: 15, color: battingTeam?.primaryColor, lineHeight: 1.1 }}>
              {battingTeam?.name}
            </p>
            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }}>
              🏏 BATTING
            </span>
          </div>
        </div>

        {/* Center: Live Scoreboard */}
        <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 16px' }}>
          <div style={{
            fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 'clamp(24px, 4vw, 36px)', lineHeight: 1,
            color: '#f9c000', textShadow: '0 0 10px rgba(249,192,0,0.3)',
          }}>
            {innings.totalRuns}
            <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '70%' }}>/{innings.totalWickets}</span>
          </div>
          <p className="text-muted" style={{ fontSize: 12, fontFamily: 'Rajdhani, sans-serif', fontWeight: 600, marginTop: 4 }}>
            {overs} ov · {ballsLeft} balls left
          </p>
          {runsNeeded !== null && (
            <div style={{
              fontSize: 12, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif',
              color: runsNeeded <= 0 ? '#4ade80' : '#fbbf24', marginTop: 2
            }}>
              Need {Math.max(0, runsNeeded)} runs off {ballsLeft} balls
            </div>
          )}
        </div>

        {/* Right: Bowling Team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, justifyContent: 'flex-end', textAlign: 'right' }}>
          <div style={{ minWidth: 0 }}>
            <p className="font-rajdhani font-bold truncate" style={{ fontSize: 15, color: bowlingTeam?.primaryColor, lineHeight: 1.1 }}>
              {bowlingTeam?.name}
            </p>
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700, fontFamily: 'Rajdhani, sans-serif' }}>
              🛡️ BOWLING
            </span>
          </div>
          <div className="team-logo" style={{
            width: 40, height: 40, borderRadius: 10, fontSize: 11, flexShrink: 0,
            background: `${bowlingTeam?.primaryColor}20`,
            color: bowlingTeam?.primaryColor,
            border: `2px solid ${bowlingTeam?.primaryColor}45`,
          }}>
            {bowlingTeam?.logoInitials}
          </div>
        </div>

      </div>
      
      {/* Lobby Pill indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>📍 {fixture?.venue?.split(',')[0]}</span>
        <span>•</span>
        <span>Innings {innings.inningsNumber}</span>
        {!isOpponentAI && (
          <>
            <span>•</span>
            <span style={{ color: opponentConnected ? '#4ade80' : '#f87171', fontWeight: 700 }}>
              {opponentConnected ? '🟢 Opponent Online' : '🔴 Opponent Offline'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Over bar circles (visual tracker of 6 deliveries) ───────────────────
function OverBarInline({ events }) {
  const lastOver = events.length > 0 ? events[events.length - 1].overNumber : 0;
  const thisOver = events.filter((e) => e.overNumber === lastOver);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="section-label" style={{ fontSize: 10 }}>OVER {lastOver + 1}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{thisOver.length}/6 balls completed</span>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const ball = thisOver[i];
          const isWicket = ball?.isWicket;
          const runs = ball?.runsScored;
          const isFilled = ball !== undefined;

          return (
            <div key={i} style={{
              flex: 1, height: 26, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Orbitron, sans-serif', fontSize: 11, fontWeight: 900,
              background: !isFilled ? 'transparent' : isWicket ? 'rgba(239,68,68,0.2)' : runs >= 4 ? 'rgba(249,192,0,0.2)' : runs > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
              color: !isFilled ? 'transparent' : isWicket ? '#f87171' : runs >= 4 ? '#f9c000' : runs > 0 ? '#4ade80' : 'var(--text-muted)',
              border: `1.5px ${!isFilled ? 'dashed' : 'solid'} ${!isFilled ? 'rgba(255,255,255,0.1)' : isWicket ? 'rgba(239,68,68,0.4)' : runs >= 4 ? 'rgba(249,192,0,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {isFilled ? (isWicket ? 'W' : runs) : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Commentary Feed ───────────────────────────────────────────────────
function Commentary({ events }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [events]);

  return (
    <div style={{
      background: 'rgba(5, 8, 16, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: 14, padding: '12px 14px',
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      <p className="section-label mb-2" style={{ fontSize: 10 }}>📢 Ball-by-Ball Feed</p>
      <div
        ref={ref}
        style={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
          paddingRight: 4
        }}
      >
        {events.length === 0 ? (
          <p className="text-muted text-xs text-center py-6">Play a ball to start the commentary.</p>
        ) : (
          events.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 8, fontSize: 12,
              background: e.isWicket ? 'rgba(239,68,68,0.08)' : 'rgba(255, 255, 255, 0.01)',
              borderLeft: `3px solid ${e.isWicket ? '#f87171' : e.runsScored >= 4 ? '#f9c000' : e.runsScored > 0 ? '#4ade80' : 'rgba(255,255,255,0.1)'}`
            }}>
              <span style={{
                fontFamily: 'Orbitron, sans-serif', fontSize: 10, fontWeight: 700,
                color: 'var(--text-muted)', minWidth: 32, flexShrink: 0
              }}>
                {e.overNumber}.{e.ballInOver + 1}
              </span>
              <span className="flex-1" style={{ color: e.isWicket ? '#fca5a5' : 'var(--text-sub)' }}>
                {e.isWicket
                  ? `OUT! Wicket falls. Batsman played ${e.batterFingers}, Bowler matched with ${e.bowlerFingers}!`
                  : e.runsScored === 0
                    ? `Dot ball. Bowled ${e.bowlerFingers}, defended ${e.batterFingers}.`
                    : `Runs scored! Batsman plays ${e.batterFingers}, Bowler gives ${e.bowlerFingers}. +${e.runsScored} runs.`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Innings Break (Overlay Screen) ────────────────────────────────────
function InningsBreakScreen({ innings, homeTeam, awayTeam, onContinue }) {
  if (!innings) return null;
  const team = innings.battingTeamId === homeTeam?.id ? homeTeam : awayTeam;
  return (
    <div className="card text-center animate-pop" style={{ padding: '36px', maxWidth: 440, margin: '20px auto' }}>
      <p className="section-label mb-2">Innings {innings.inningsNumber} Complete</p>
      <div className="team-logo" style={{
        width: 60, height: 60, borderRadius: 15, fontSize: 16,
        margin: '0 auto 12px',
        background: `${team?.primaryColor}20`, color: team?.primaryColor,
        border: `2px solid ${team?.primaryColor}45`,
      }}>
        {team?.logoInitials}
      </div>
      <h3 className="font-rajdhani font-bold text-xl" style={{ color: team?.primaryColor }}>
        {team?.name}
      </h3>
      <p className="font-orbitron font-bold gold-text mt-1" style={{ fontSize: 40, lineHeight: 1.1 }}>
        {innings.totalRuns}/{innings.totalWickets}
      </p>
      <p className="text-muted text-xs mb-4">({formatOvers(innings.totalBalls)} overs)</p>
      
      {innings.inningsNumber === 1 && (
        <div style={{
          display: 'inline-block', padding: '8px 20px', borderRadius: 10,
          background: 'rgba(249,192,0,0.08)', border: '1px solid rgba(249,192,0,0.2)',
          marginBottom: 20,
        }}>
          <span className="text-muted text-xs">Target: </span>
          <span className="font-orbitron font-bold text-gold" style={{ fontSize: 20 }}>
            {innings.totalRuns + 1}
          </span>
        </div>
      )}
      
      <button className="btn btn-gold btn-lg w-full" onClick={onContinue}>
        {innings.inningsNumber === 1 ? 'Start 2nd Innings' : 'See Result'}
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ── Result Modal Overlay ──────────────────────────────────────────────
function ResultModalOverlay({ fixture, homeTeam, awayTeam, userTeamId, onClose }) {
  const userWon = fixture?.winnerId === userTeamId;
  const winTeam = fixture?.winnerId === homeTeam?.id ? homeTeam : awayTeam;

  return (
    <div className="modal-backdrop" style={{ background: 'rgba(3,5,10,0.95)' }}>
      <div className="modal text-center animate-pop" style={{ maxWidth: 440, padding: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 10 }}>{userWon ? '🏆' : '😔'}</div>
        <h2 className="font-rajdhani font-bold" style={{ fontSize: 28, marginBottom: 4 }}>
          {userWon ? <span className="gold-text">VICTORY!</span> : 'Match Lost'}
        </h2>
        <p className="text-muted text-sm">{fixture?.matchResult}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '20px 0' }}>
          {[
            { team: homeTeam, score: fixture?.homeScore, wkts: fixture?.homeWickets, ov: fixture?.homeOvers },
            { team: awayTeam, score: fixture?.awayScore, wkts: fixture?.awayWickets, ov: fixture?.awayOvers },
          ].map(({ team, score, wkts, ov }) => (
            <div key={team?.id} style={{
              padding: '12px', borderRadius: 12,
              background: team?.id === winTeam?.id ? `${team?.primaryColor}12` : 'var(--bg-card)',
              border: `1px solid ${team?.id === winTeam?.id ? `${team?.primaryColor}30` : 'var(--border)'}`,
            }}>
              <p className="text-muted text-xs mb-1">{team?.shortName}</p>
              <p className="font-orbitron font-bold" style={{
                fontSize: 16, color: team?.id === winTeam?.id ? team?.primaryColor : 'var(--text-sub)',
              }}>
                {score}/{wkts}
              </p>
              <p className="text-muted" style={{ fontSize: 10 }}>({ov} ov)</p>
            </div>
          ))}
        </div>
        
        <button className="btn btn-gold btn-lg w-full mt-2" onClick={onClose}>
          Back to Fixtures <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ── Main MatchPage ────────────────────────────────────────────────────
export default function MatchPage() {
  const { fixtureId } = useParams();
  const { gameSetup } = useApp();
  const navigate      = useNavigate();

  const [matchData,  setMatchData]  = useState(null);
  const [innings,    setInnings]    = useState(null);
  const [events,     setEvents]     = useState([]);
  
  // Real-time resolution details
  const [loading,    setLoading]    = useState(true);
  const [delivering, setDelivering] = useState(false);
  const [phase,      setPhase]      = useState('playing'); // playing | innings-break | result
  
  // Sockets state
  const [socket, setSocket] = useState(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [isOpponentAI, setIsOpponentAI] = useState(true);
  const [opponentPlayed, setOpponentPlayed] = useState(false);

  // Resolution reveal states (explosive reveal)
  const [batterPick, setBatterPick] = useState(null);
  const [bowlerPick, setBowlerPick] = useState(null);
  const [ballOutcome, setBallOutcome] = useState(null); // wicket | dot | runs
  const [runsAdded, setRunsAdded] = useState(0);
  const [localChoice, setLocalChoice] = useState(null);

  const [rightTab, setRightTab] = useState('feed'); // feed | scorecard
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedSubIn, setSelectedSubIn] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const userTeamId = gameSetup?.userTeamId;

  // Initialize socket and load base match data
  useEffect(() => {
    // 1. Fetch match metadata
    api.getMatch(fixtureId)
      .then((d) => {
        setMatchData(d);
        const { fixture } = d;
        const inningsArr = fixture.Innings || [];
        const active = inningsArr.find((i) => i.status === 'in-progress');
        
        if (active) {
          setInnings(active);
          setEvents(active.Events || []);
          setPhase('playing');
        } else {
          const completed = inningsArr.filter((i) => i.status === 'completed');
          if (fixture.status === 'completed') {
            setPhase('result');
            setInnings(completed[completed.length - 1] || null);
          } else if (completed.length > 0) {
            setInnings(completed[completed.length - 1]);
            setPhase('innings-break');
          }
        }
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));

    // 2. Open socket connection dynamically based on location hostname for LAN tests
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
      setOpponentConnected(data.isOpponentAI ? true : (isHome ? data.awayConnected : data.homeConnected));
      setIsOpponentAI(data.isOpponentAI);
    });

    s.on('opponent-disconnected', () => {
      setOpponentConnected(false);
    });

    s.on('opponent-played', () => {
      setOpponentPlayed(true);
    });

    // Real-time delivery coordinator resolver!
    s.on('delivery-resolved', (data) => {
      setOpponentPlayed(false);
      setDelivering(true);

      // Perform the card reveal animation states
      setBatterPick(data.batterFingers);
      setBowlerPick(data.bowlerFingers);
      setBallOutcome(data.isWicket ? 'wicket' : data.runsScored === 0 ? 'dot' : 'runs');
      setRunsAdded(data.runsScored);

      // Short delay for visual reveal dramatic timing!
      setTimeout(() => {
        setEvents(data.innings.Events || []);
        setInnings(data.innings);
        setMatchData(prev => {
          if (!prev) return null;
          return { ...prev, fixture: data.fixture };
        });

        if (data.matchComplete) {
          setPhase('result');
        } else if (data.inningsComplete) {
          setPhase('innings-break');
        }

        // Reset picks and local choice to ready the screen for the next ball
        setBatterPick(null);
        setBowlerPick(null);
        setBallOutcome(null);
        setLocalChoice(null);

        setDelivering(false);
      }, 1500); // 1.5 seconds explosive card timing
    });

    s.on('second-innings-started', (data) => {
      setInnings(data.innings);
      setEvents([]);
      setPhase('playing');
      setBatterPick(null);
      setBowlerPick(null);
      setBallOutcome(null);
      setLocalChoice(null);
      setMatchData(prev => {
        if (!prev) return null;
        return { ...prev, fixture: data.fixture };
      });
    });

    s.on('impact-sub-resolved', (data) => {
      setInnings(data.innings);
      setMatchData((prev) => {
        if (!prev) return null;
        const pMap = {};
        [...prev.homeSquad, ...prev.awaySquad].forEach((p) => { pMap[p.id] = p; });
        const subInName = pMap[data.subInPlayerId]?.name || 'Substitute';
        const subOutName = pMap[data.subOutPlayerId]?.name || 'Player';
        setToastMessage(`✨ Impact Sub: ${subInName} swapped in for ${subOutName}!`);
        return { ...prev, fixture: data.fixture };
      });
    });

    return () => {
      s.disconnect();
    };
  }, [fixtureId, gameSetup]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Submit finger selection over socket
  const handleDeliver = (fingers) => {
    if (delivering || localChoice !== null || !socket) return;
    setLocalChoice(fingers);
    socket.emit('play-ball', { fingers });
  };

  const handleContinue = () => {
    if (!socket) return;
    socket.emit('start-second-innings');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="text-muted text-sm">Loading stadium context…</p>
        </div>
      </div>
    );
  }

  const { fixture, homeTeam, awayTeam } = matchData || {};
  const isUserBatting = innings?.battingTeamId === userTeamId;

  // Resolve players names
  const homeSquad = matchData?.homeSquad || [];
  const awaySquad = matchData?.awaySquad || [];
  const playerMap = {};
  [...homeSquad, ...awaySquad].forEach((p) => { playerMap[p.id] = p; });

  const currentBatter = playerMap[innings?.playingXI?.[innings?.currentBatterIdx]];
  const isWaitingForMyChoice = innings && (isUserBatting ? !batterPick : !bowlerPick);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'rgba(3, 5, 10, 1)'
    }}>
      <Navbar />

      {/* Modals & Overlays */}
      {phase === 'result' && (
        <ResultModalOverlay
          fixture={{ ...fixture, homeTeam, awayTeam }}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          userTeamId={userTeamId}
          onClose={() => navigate('/fixtures')}
        />
      )}

      {/* Stadium Scoreboard */}
      {innings && (
        <StadiumScoreboard
          innings={innings}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          userTeamId={userTeamId}
          fixture={fixture}
          opponentConnected={opponentConnected}
          isOpponentAI={isOpponentAI}
        />
      )}

      {/* Main Viewport Content Area (Zero-scrolling Dashboard Grid) */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
        padding: '16px', gap: '16px', maxWidth: 1100, margin: '0 auto', width: '100%'
      }}>
        
        {/* Innings Break Screen takes full center if active */}
        {phase === 'innings-break' ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InningsBreakScreen
              innings={innings}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              onContinue={handleContinue}
            />
          </div>
        ) : (
          <>
            {/* Left Side: Massive Live Action Card (Reveal Area) */}
            <div className="card" style={{
              flex: 1.3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              padding: '20px', position: 'relative', overflow: 'hidden',
              background: 'radial-gradient(circle at center, rgba(16,24,48,0.3) 0%, rgba(8,12,24,0.95) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="badge badge-muted" style={{ fontSize: 10 }}>LIVE ARENA</span>
                {!isOpponentAI && opponentPlayed && (
                  <span className="badge badge-green animate-pulse" style={{ fontSize: 10 }}>⚡ Opponent Played!</span>
                )}
              </div>

              {/* Central Reveal/Reveal State */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, margin: '12px 0' }}>
                {batterPick !== null && bowlerPick !== null ? (
                  /* Animated Card Reveal */
                  <div className="animate-pop text-center" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                      
                      {/* Batter side */}
                      <div>
                        <div style={{
                          width: 80, height: 80, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36,
                          background: isUserBatting ? 'rgba(249,192,0,0.12)' : 'rgba(239,68,68,0.1)',
                          color: isUserBatting ? '#f9c000' : '#f87171',
                          border: `3.5px solid ${isUserBatting ? 'rgba(249,192,0,0.4)' : 'rgba(239,68,68,0.25)'}`,
                          boxShadow: isUserBatting ? '0 0 20px rgba(249,192,0,0.15)' : 'none',
                        }}>
                          {batterPick}
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                          {isUserBatting ? '🏏 YOU (BAT)' : (isOpponentAI ? '🤖 AI (BAT)' : '👤 OPPONENT (BAT)')}
                        </p>
                      </div>

                      <div className="font-orbitron font-bold text-muted text-xl">VS</div>

                      {/* Bowler side */}
                      <div>
                        <div style={{
                          width: 80, height: 80, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36,
                          background: !isUserBatting ? 'rgba(249,192,0,0.12)' : 'rgba(239,68,68,0.1)',
                          color: !isUserBatting ? '#f9c000' : '#f87171',
                          border: `3.5px solid ${!isUserBatting ? 'rgba(249,192,0,0.4)' : 'rgba(239,68,68,0.25)'}`,
                          boxShadow: !isUserBatting ? '0 0 20px rgba(249,192,0,0.15)' : 'none',
                        }}>
                          {bowlerPick}
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                          {!isUserBatting ? '🛡️ YOU (BOWL)' : (isOpponentAI ? '🤖 AI (BOWL)' : '👤 OPPONENT (BOWL)')}
                        </p>
                      </div>

                    </div>

                    {/* Outcome Badge */}
                    <div className="animate-pop" style={{ display: 'inline-block' }}>
                      <div style={{
                        padding: '12px 36px', borderRadius: 999,
                        fontFamily: 'Rajdhani, sans-serif', fontWeight: 900, fontSize: 24, letterSpacing: 1.5,
                        background: ballOutcome === 'wicket' ? 'rgba(239,68,68,0.15)' : ballOutcome === 'runs' && runsAdded >= 4 ? 'rgba(249,192,0,0.15)' : 'rgba(34,197,94,0.1)',
                        color: ballOutcome === 'wicket' ? '#f87171' : ballOutcome === 'runs' && runsAdded >= 4 ? '#f9c000' : '#4ade80',
                        border: `2px solid ${ballOutcome === 'wicket' ? '#f87171' : ballOutcome === 'runs' && runsAdded >= 4 ? '#f9c000' : '#22c55e'}`,
                        boxShadow: `0 0 30px ${ballOutcome === 'wicket' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.1)'}`,
                      }}>
                        {ballOutcome === 'wicket' ? '⚡ OUT! WICKET' : runsAdded === 0 ? '⚫ DOT BALL' : `🟢 +${runsAdded} RUNS`}
                      </div>
                    </div>
                  </div>
                ) : batterPick === null && localChoice !== null ? (
                  /* Symmetrical Pending Submission Waiting State */
                  <div className="animate-pop text-center" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                      
                      {/* Your side */}
                      <div>
                        <div style={{
                          width: 80, height: 80, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36,
                          background: 'rgba(34,197,94,0.12)',
                          color: '#4ade80',
                          border: '3.5px solid rgba(34,197,94,0.4)',
                          boxShadow: '0 0 20px rgba(34,197,94,0.15)',
                        }}>
                          {localChoice}
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                          {isUserBatting ? '🏏 YOU (BAT)' : '🛡️ YOU (BOWL)'}
                        </p>
                        <span className="badge badge-green mt-2" style={{ fontSize: 9 }}>SUBMITTED</span>
                      </div>

                      <div className="font-orbitron font-bold text-muted text-xl">VS</div>

                      {/* Opponent side */}
                      <div>
                        <div className="animate-pulse" style={{
                          width: 80, height: 80, borderRadius: 20,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 36,
                          background: 'rgba(255, 255, 255, 0.02)',
                          color: 'var(--text-muted)',
                          border: '3.5px dashed rgba(255,255,255,0.15)',
                        }}>
                          ?
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                          {!isUserBatting ? (isOpponentAI ? '🤖 AI (BAT)' : '👤 OPPONENT (BAT)') : (isOpponentAI ? '🤖 AI (BOWL)' : '👤 OPPONENT (BOWL)')}
                        </p>
                        <span className="badge badge-muted mt-2" style={{ fontSize: 9 }}>PENDING...</span>
                      </div>

                    </div>

                    <p className="font-rajdhani text-lg font-bold text-gold animate-pulse" style={{ textShadow: '0 0 8px rgba(249,192,0,0.15)' }}>
                      Waiting for opponent to choose...
                    </p>
                  </div>
                ) : (
                  /* Waiting for Input State */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 56, marginBottom: 12 }} className="animate-pulse">
                      {isUserBatting ? '🏏' : '⚡'}
                    </div>
                    <h3 className="font-rajdhani text-2xl font-bold text-gold" style={{ textShadow: '0 0 8px rgba(249,192,0,0.2)' }}>
                      {isUserBatting ? 'Your Turn to Bat' : 'Your Turn to Bowl'}
                    </h3>
                    <p className="text-muted text-sm mt-1 max-w-xs">
                      {isUserBatting
                        ? 'Select a finger shot below. If the bowler plays the same number, you are OUT!'
                        : 'Bowl your delivery. Try to guess and match the batsman\'s finger choice to get a WICKET!'}
                    </p>
                  </div>
                )}
              </div>

              {/* Status footer inside action card */}
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                {delivering ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fbbf24' }}>
                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                    Syncing scoreboard resolved outcomes...
                  </span>
                ) : (
                  'Play your hand. Real-time resolved score matches.'
                )}
              </div>

            </div>

            {/* Right Side: Info Panel (Batting details, commentary, tabs) */}
            <div style={{
              flex: 0.8, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden'
            }}>
              
              {/* Tab Selector */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 4, gap: 10 }}>
                <button
                  onClick={() => setRightTab('feed')}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif',
                    color: rightTab === 'feed' ? 'var(--gold)' : 'var(--text-muted)',
                    borderBottom: rightTab === 'feed' ? '2.5px solid var(--gold)' : '2.5px solid transparent',
                    background: 'transparent', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    letterSpacing: '1px'
                  }}
                >
                  📢 MATCH FEED
                </button>
                <button
                  onClick={() => setRightTab('scorecard')}
                  style={{
                    flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700, fontFamily: 'Rajdhani, sans-serif',
                    color: rightTab === 'scorecard' ? 'var(--gold)' : 'var(--text-muted)',
                    borderBottom: rightTab === 'scorecard' ? '2.5px solid var(--gold)' : '2.5px solid transparent',
                    background: 'transparent', cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    letterSpacing: '1px'
                  }}
                >
                  📊 LIVE SCORECARD
                </button>
              </div>

              {rightTab === 'feed' ? (
                <>
                  {/* Current batter strip */}
                  {currentBatter && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: `${ROLE_COLORS[currentBatter.role] || '#888'}18`,
                        color: ROLE_COLORS[currentBatter.role] || '#888',
                        border: `1.5px solid ${ROLE_COLORS[currentBatter.role] || '#888'}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Rajdhani, sans-serif', fontSize: 12, fontWeight: 800,
                      }}>
                        {currentBatter.role?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-rajdhani font-bold text-sm truncate">{currentBatter.name}</p>
                        <p className="text-muted" style={{ fontSize: 10 }}>{currentBatter.role} · Strike</p>
                      </div>
                      <span className="badge badge-gold" style={{ fontSize: 9 }}>STRYKE</span>
                    </div>
                  )}

                  {/* Over visual bar */}
                  <OverBarInline events={events} />

                  {/* Auto-scrolled commentary */}
                  <Commentary events={events} />
                </>
              ) : (
                /* Premium Live Scorecard Tab */
                <div style={{
                  background: 'rgba(5, 8, 16, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 14, padding: '12px 14px',
                  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }} className="animate-up">
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 10,
                    color: 'var(--text-muted)', fontWeight: 700,
                    borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 8
                  }}>
                    <span style={{ flex: 1.5 }}>BATSMAN</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>STATUS</span>
                    <span style={{ width: 40, textAlign: 'right' }}>R (B)</span>
                    <span style={{ width: 40, textAlign: 'right' }}>SR</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(() => {
                      if (!innings) return null;
                      
                      const stats = {};
                      innings.playingXI.forEach((id) => {
                        stats[id] = { runs: 0, balls: 0, out: false };
                      });

                      events.forEach((e) => {
                        const bid = e.batterPlayerId;
                        if (bid && stats[bid] !== undefined) {
                          stats[bid].runs += e.runsScored || 0;
                          stats[bid].balls += 1;
                          if (e.isWicket) {
                            stats[bid].out = true;
                          }
                        }
                      });

                      return innings.playingXI.map((id, idx) => {
                        const p = playerMap[id];
                        const s = stats[id] || { runs: 0, balls: 0, out: false };
                        
                        let statusText = 'DNB';
                        if (s.balls > 0) {
                          if (s.out) statusText = 'out';
                          else {
                            if (innings.status === 'in-progress' && (idx === innings.currentBatterIdx || idx === innings.nonStrikerIdx)) {
                              statusText = 'batting';
                            } else {
                              statusText = 'not out';
                            }
                          }
                        }

                        const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '-';

                        return (
                          <div key={id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.02)',
                          }}>
                            <div style={{ flex: 1.5, minWidth: 0 }}>
                              <p className="font-rajdhani font-bold truncate" style={{
                                color: statusText === 'batting' ? 'var(--gold)' : 'var(--text-sub)'
                              }}>
                                {p?.name || 'Unknown Player'}
                                {statusText === 'batting' && <span style={{ color: 'var(--gold)', marginLeft: 4 }}>*</span>}
                              </p>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                              <span className={`badge ${
                                statusText === 'batting' ? 'badge-green' : statusText === 'not out' ? 'badge-blue' : statusText === 'out' ? 'badge-red' : 'badge-muted'
                              }`} style={{ fontSize: 9, padding: '1px 5px' }}>
                                {statusText.toUpperCase()}
                              </span>
                            </div>
                            <span style={{ width: 40, textAlign: 'right', fontFamily: 'Orbitron, sans-serif', fontWeight: 700, color: 'var(--text)' }}>
                              {s.runs}
                              <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>({s.balls})</span>
                            </span>
                            <span style={{ width: 40, textAlign: 'right', fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: 'var(--text-muted)' }}>
                              {sr}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </div>

      {/* Anchored bottom button bar (Zero-scrolling) */}
      {phase === 'playing' && innings && (
        <div style={{
          background: 'rgba(6, 10, 24, 0.95)',
          borderTop: '1px solid rgba(249, 192, 0, 0.15)',
          padding: '14px 20px 20px',
          zIndex: 100
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            
            {/* Bring in Impact Sub Button */}
            {(() => {
              const userSide = homeTeam?.id === userTeamId ? 'home' : 'away';
              const mySubs = userSide === 'home' ? (fixture?.homeImpactSub || []) : (fixture?.awayImpactSub || []);
              
              if (!innings.impactSubUsed && mySubs.length > 0) {
                return (
                  <button
                    onClick={() => {
                      setSelectedSubIn(null);
                      setShowSubModal(true);
                    }}
                    className="btn btn-gold btn-sm animate-pulse"
                    style={{
                      margin: '0 auto 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 18px',
                      fontSize: 12,
                      boxShadow: '0 0 12px rgba(249,192,0,0.2)',
                      borderRadius: 99,
                      background: 'linear-gradient(135deg, #f9c000, #d97706)',
                      color: '#000',
                      fontWeight: 700,
                      border: 'none',
                    }}
                  >
                    <Zap size={13} fill="#000" /> Bring in Impact Player
                  </button>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {FINGERS.map((f) => {
                const activeChoice = localChoice === f;
                
                return (
                  <button
                    key={f}
                    disabled={delivering || localChoice !== null}
                    onClick={() => handleDeliver(f)}
                    className="finger-btn"
                    style={{
                      width: 'clamp(54px, 12vw, 68px)',
                      height: 'clamp(54px, 12vw, 68px)',
                      fontSize: 'clamp(20px, 4vw, 26px)',
                      background: activeChoice ? 'rgba(249,192,0,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `2.5px solid ${activeChoice ? '#f9c000' : 'rgba(255,255,255,0.08)'}`,
                      color: activeChoice ? '#f9c000' : 'var(--text)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: activeChoice ? '0 0 15px rgba(249,192,0,0.25)' : 'none',
                    }}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
            
            <p style={{
              textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--text-sub)',
              fontFamily: 'Rajdhani, sans-serif', fontWeight: 600
            }}>
              {delivering ? (
                '🔄 Delivering ball outcomes...'
              ) : localChoice !== null ? (
                '⏳ Waiting for opponent to play their hand...'
              ) : isUserBatting ? (
                '🏏 Pick your finger shot (guess & mismatch opponent)'
              ) : (
                '🛡️ Bowl your delivery (guess & match opponent to OUT)'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Banner */}
      {toastMessage && (
        <div
          className="animate-pop"
          style={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            background: 'rgba(6,10,24,0.95)',
            border: '2px solid var(--gold)',
            boxShadow: '0 8px 32px rgba(249,192,0,0.3)',
            padding: '12px 24px',
            borderRadius: 16,
            color: '#fff',
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Zap size={18} style={{ color: 'var(--gold)' }} />
          {toastMessage}
        </div>
      )}

      {/* Impact Sub Modal */}
      {showSubModal && (() => {
        const userSide = homeTeam?.id === userTeamId ? 'home' : 'away';
        const mySubs = userSide === 'home' ? (fixture?.homeImpactSub || []) : (fixture?.awayImpactSub || []);
        
        return (
          <div className="modal-backdrop" style={{ zIndex: 10001, background: 'rgba(3,5,10,0.85)' }}>
            <div className="modal animate-pop" style={{ maxWidth: 440, padding: 24 }}>
              <h2 className="font-rajdhani font-bold mb-2 text-gold flex items-center gap-2" style={{ fontSize: 22 }}>
                <Zap size={20} /> Bring in Impact Player
              </h2>
              
              {selectedSubIn === null ? (
                <>
                  <p className="text-muted text-sm mb-4">
                    Step 1: Select 1 of your 5 designated substitutes to bring in.
                  </p>

                  <div className="flex flex-col gap-2 mb-4" style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {mySubs.map((playerId) => {
                      const p = playerMap[playerId];
                      if (!p) return null;
                      return (
                        <button
                          key={playerId}
                          onClick={() => {
                            setSelectedSubIn(p);
                          }}
                          className="player-card hover-glow"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            width: '100%',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: ROLE_COLORS[p.role] || '#555',
                          }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-rajdhani font-bold text-sm text-white truncate">{p.name}</p>
                            <p className="text-xs" style={{ color: ROLE_COLORS[p.role] || '#888', fontWeight: 600 }}>
                              {p.role} · {p.nationality}
                            </p>
                          </div>
                          <span className="badge badge-gold" style={{ fontSize: 9 }}>SELECT</span>
                        </button>
                      );
                    })}
                  </div>

                  <button className="btn btn-ghost w-full" onClick={() => setShowSubModal(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div style={{
                    background: 'rgba(249, 192, 0, 0.05)',
                    border: '1px solid rgba(249, 192, 0, 0.15)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    marginBottom: 14,
                  }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>SUBBING IN</p>
                    <p className="font-rajdhani font-bold text-sm text-white mt-1">{selectedSubIn.name}</p>
                    <p className="text-xs text-gold font-semibold">{selectedSubIn.role} · {selectedSubIn.nationality}</p>
                  </div>

                  <p className="text-muted text-sm mb-4">
                    Step 2: Select a player from your current Playing XI to sub out.
                  </p>

                  <div className="flex flex-col gap-2 mb-4" style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {(() => {
                      const currentOverseas = innings.playingXI.filter(id => playerMap[id]?.nationality === 'Overseas').length;
                      const subInIsOverseas = selectedSubIn.nationality === 'Overseas';

                      return innings.playingXI.map((playerId) => {
                        const p = playerMap[playerId];
                        if (!p) return null;

                        const subOutIsOverseas = p.nationality === 'Overseas';
                        const potentialOverseas = currentOverseas - (subOutIsOverseas ? 1 : 0) + (subInIsOverseas ? 1 : 0);
                        const isViolation = potentialOverseas > 4;

                        return (
                          <button
                            key={playerId}
                            disabled={isViolation}
                            onClick={() => {
                              socket.emit('use-impact-sub', {
                                subInPlayerId: selectedSubIn.id,
                                subOutPlayerId: p.id,
                              });
                              setShowSubModal(false);
                              setSelectedSubIn(null);
                            }}
                            className={`player-card ${isViolation ? '' : 'hover-glow'}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 16px',
                              background: 'var(--bg-card)',
                              border: isViolation ? '1px dashed rgba(239, 68, 68, 0.2)' : '1px solid var(--border)',
                              borderRadius: 12,
                              width: '100%',
                              cursor: isViolation ? 'not-allowed' : 'pointer',
                              textAlign: 'left',
                              opacity: isViolation ? 0.45 : 1,
                              transition: 'all 0.2s',
                            }}
                          >
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: isViolation ? '#444' : (ROLE_COLORS[p.role] || '#555'),
                            }} />
                            <div className="flex-1 min-w-0">
                              <p className="font-rajdhani font-bold text-sm text-white truncate">{p.name}</p>
                              <p className="text-xs" style={{ color: ROLE_COLORS[p.role] || '#888', fontWeight: 600 }}>
                                {p.role} · {p.nationality}
                              </p>
                            </div>
                            {isViolation ? (
                              <span className="badge badge-red" style={{ fontSize: 9 }}>MAX 4 OVERSEAS</span>
                            ) : (
                              <span className="badge badge-gold" style={{ fontSize: 9 }}>SUB OUT</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost flex-1" onClick={() => setSelectedSubIn(null)}>
                      Back
                    </button>
                    <button className="btn btn-ghost flex-1" onClick={() => setShowSubModal(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
