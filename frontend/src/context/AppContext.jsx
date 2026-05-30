import { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

/**
 * gameSetup stored in localStorage:
 * {
 *   auctionGameId, userGameTeamId, userTeamId,
 *   userTeamName, userTeamShort, userTeamColor, userTeamLogo
 * }
 */
export function AppProvider({ children }) {
  const [gameSetup, setGameSetup] = useState(() => {
    try { return JSON.parse(localStorage.getItem('iplMatchSetup') || 'null'); }
    catch { return null; }
  });

  const saveSetup = (setup) => {
    setGameSetup(setup);
    localStorage.setItem('iplMatchSetup', JSON.stringify(setup));
  };

  const clearSetup = () => {
    setGameSetup(null);
    localStorage.removeItem('iplMatchSetup');
  };

  return (
    <AppContext.Provider value={{ gameSetup, saveSetup, clearSetup }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
