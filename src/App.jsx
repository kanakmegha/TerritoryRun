import { GameProvider } from './hooks/useGameStore'
import MapView from './components/Map/MapContainer'
import Dashboard from './components/Dashboard/Dashboard'
import './App.css'

function App() {
  return (
    <GameProvider>
      <div className="app-container">
        <MapView />
        <Dashboard />
      </div>
    </GameProvider>
  )
}

export default App
