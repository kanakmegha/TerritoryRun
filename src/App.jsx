import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GameProvider, useGameStore } from './hooks/useGameStore'
import MapView from './components/Map/MapContainer'
import Dashboard from './components/Dashboard/Dashboard'
import LiveRunCard from './components/Dashboard/LiveRunCard'
import LandingPage from './components/Dashboard/LandingPage'
import Home from './components/Dashboard/Home'
import './App.css'

// Silence Chrome Extension AddListener Errors
if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
        if (e.message && e.message.includes("reading 'addListener'")) {
            e.stopImmediatePropagation();
            e.preventDefault();
        }
    });
}

// Map/Game View Component wrapper
const GameScreen = () => {
    const { token, gpsStatus, gpsError, startGpsTracking } = useGameStore();

    // Strict Auth Guard Routing
    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (gpsStatus === 'requesting') {
        return (
            <div className="loading-screen">
                <div className="loader-box">
                    <div className="scanning-line"></div>
                    <h2>ESTABLISHING GPS LINK...</h2>
                    <p>PLEASE ENSURE CLEAR VIEW OF THE SKY</p>
                </div>
                <style>{`
                    .loading-screen { height: 100vh; background: #000; display: flex; justify-content: center; align-items: center; color: #00ffea; }
                    .loader-box { text-align: center; border: 1px solid #00ffea; padding: 3rem; position: relative; background: rgba(0,255,234,0.05); }
                    .scanning-line { position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: #00ffea; animation: scan-vertical 2s linear infinite; }
                    @keyframes scan-vertical { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
                    h2 { letter-spacing: 4px; margin-bottom: 10px; }
                    p { font-size: 0.8rem; opacity: 0.6; }
                `}</style>
            </div>
        );
    }

    if (gpsStatus === 'error') {
        return (
            <div className="error-screen">
                <div className="error-box">
                    <h1>🔴 ENCRYPTION FAILURE</h1>
                    <p>{gpsError}</p>
                    <button onClick={startGpsTracking} className="retry-btn">RE-INITIALIZE PROTOCOL</button>
                </div>
                <style>{`
                    .error-screen { height: 100vh; background: #1a0000; display: flex; justify-content: center; align-items: center; color: #ff3333; }
                    .error-box { text-align: center; max-width: 400px; padding: 2rem; border: 2px solid #ff3333; }
                    .retry-btn { margin-top: 2rem; background: transparent; border: 1px solid #ff3333; color: #ff3333; padding: 10px 20px; cursor: pointer; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="app-container">
            <MapView />
            <Dashboard />
            <LiveRunCard />
        </div>
    );
};

// Global App wrapper
function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Home />} />
          <Route path="/map" element={<GameScreen />} />
          
          {/* Catch-all redirect to Landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App

