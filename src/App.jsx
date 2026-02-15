import { useState } from 'react'
import { GameProvider, useGameStore } from './hooks/useGameStore'
import MapView from './components/Map/MapContainer'
import Dashboard from './components/Dashboard/Dashboard'
import LiveRunCard from './components/Dashboard/LiveRunCard'
import Login from './components/Auth/Login'
import Signup from './components/Auth/Signup'
import './App.css'

const GameContent = () => {
    const { token } = useGameStore();
    const [isLogin, setIsLogin] = useState(true);

    if (!token) {
        return (
            <div className="auth-wrapper">
                <div className="auth-overlay">
                    {isLogin ? 
                        <Login onSwitch={() => setIsLogin(false)} /> : 
                        <Signup onSwitch={() => setIsLogin(true)} />
                    }
                </div>
                <MapView />
                <style>{`
                    .auth-wrapper { position: relative; width: 100%; height: 100%; }
                    .auth-overlay {
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 100%;
                        display: flex; justify-content: center; align-items: center;
                        z-index: 2000;
                        background: rgba(0,0,0,0.7);
                        backdrop-filter: blur(5px);
                    }
                `}</style>
            </div>
        );
    }

    const { gpsStatus, gpsError, startGpsTracking } = useGameStore();

    if (gpsStatus === 'requesting') {
        return (
            <div className="loading-screen">
                <div className="loader-box">
                    <div className="scanning-line"></div>
                    <h2>ESTABLISHING GPS LINK...</h2>
                    <p>PLEASE ENSURE CLEAR VIEW OF THE SKY</p>
                </div>
                <style>{`
                    .loading-screen {
                        height: 100vh;
                        background: #000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        color: #00ffea;
                        font-family: inherit;
                    }
                    .loader-box {
                        text-align: center;
                        border: 1px solid #00ffea;
                        padding: 3rem;
                        position: relative;
                        background: rgba(0,255,234,0.05);
                        box-shadow: 0 0 30px rgba(0,255,234,0.1);
                    }
                    .scanning-line {
                        position: absolute;
                        top: 0; left: 0; width: 100%; height: 2px;
                        background: #00ffea;
                        box-shadow: 0 0 10px #00ffea;
                        animation: scan-vertical 2s linear infinite;
                    }
                    @keyframes scan-vertical {
                        0% { top: 0; }
                        50% { top: 100%; }
                        100% { top: 0; }
                    }
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
                    .error-screen {
                        height: 100vh;
                        background: #1a0000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        color: #ff3333;
                    }
                    .error-box {
                        text-align: center;
                        max-width: 400px;
                        padding: 2rem;
                        border: 2px solid #ff3333;
                        box-shadow: 0 0 50px rgba(255,0,0,0.2);
                    }
                    .retry-btn {
                        margin-top: 2rem;
                        background: transparent;
                        border: 1px solid #ff3333;
                        color: #ff3333;
                        padding: 10px 20px;
                        cursor: pointer;
                        font-family: inherit;
                    }
                    .retry-btn:hover {
                        background: #ff3333;
                        color: #000;
                    }
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

function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  )
}

export default App
