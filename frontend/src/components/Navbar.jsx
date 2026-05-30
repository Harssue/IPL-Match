import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Trophy, LayoutGrid, Home, LogOut, ChevronRight } from 'lucide-react';

export default function Navbar() {
  const { gameSetup, clearSetup } = useApp();
  const loc = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => loc.pathname === path || loc.pathname.startsWith(path + '/');

  const handleLogout = () => {
    clearSetup();
    navigate('/');
  };

  return (
    <nav className="navbar">
      {/* Brand */}
      <Link to="/" className="navbar-brand gold-text" style={{ letterSpacing: '3px' }}>
        🏏 IPL
      </Link>

      {gameSetup ? (
        <>
          {/* Team pill */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 14px 5px 8px',
              background: `${gameSetup.userTeamColor}12`,
              border: `1px solid ${gameSetup.userTeamColor}30`,
              borderRadius: 999, flexShrink: 0,
            }}
          >
            <div
              className="team-logo"
              style={{
                width: 26, height: 26, borderRadius: 7, fontSize: 9,
                background: `${gameSetup.userTeamColor}25`,
                color: gameSetup.userTeamColor,
                border: `1.5px solid ${gameSetup.userTeamColor}50`,
              }}
            >
              {gameSetup.userTeamLogo}
            </div>
            <span style={{ color: gameSetup.userTeamColor, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14 }}>
              {gameSetup.userTeamShort}
            </span>
          </div>

          <div className="navbar-links">
            <Link to="/fixtures"
              className={`navbar-link ${isActive('/fixtures') || isActive('/pre-match') || isActive('/match') ? 'active' : ''}`}
            >
              <LayoutGrid size={15} /> Schedule
            </Link>
            <Link to="/playoffs"
              className={`navbar-link ${isActive('/playoffs') ? 'active' : ''}`}
            >
              <Trophy size={15} /> Playoffs
            </Link>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ gap: 5, marginLeft: 4 }}
            title="Change team"
          >
            <LogOut size={13} /> Exit
          </button>
        </>
      ) : (
        <div className="navbar-links" style={{ marginLeft: 'auto' }}>
          <Link to="/" className={`navbar-link ${loc.pathname === '/' ? 'active' : ''}`}>
            <Home size={15} /> Home
          </Link>
        </div>
      )}
    </nav>
  );
}
