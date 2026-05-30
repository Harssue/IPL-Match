import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import HomePage     from './pages/HomePage.jsx';
import FixturesPage from './pages/FixturesPage.jsx';
import PreMatchPage from './pages/PreMatchPage.jsx';
import MatchPage    from './pages/MatchPage.jsx';
import PlayoffsPage from './pages/PlayoffsPage.jsx';

function RequireSetup({ children }) {
  const { gameSetup } = useApp();
  if (!gameSetup) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/fixtures" element={<RequireSetup><FixturesPage /></RequireSetup>} />
      <Route path="/pre-match/:fixtureId" element={<RequireSetup><PreMatchPage /></RequireSetup>} />
      <Route path="/match/:fixtureId" element={<RequireSetup><MatchPage /></RequireSetup>} />
      <Route path="/playoffs" element={<RequireSetup><PlayoffsPage /></RequireSetup>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
