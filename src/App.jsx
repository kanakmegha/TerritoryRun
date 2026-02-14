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
                {/* Background map (non-interactive) */}
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
