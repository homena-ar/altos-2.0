import { MapViewer } from './ui/components/MapViewer';
import { NavigationPanel } from './ui/components/NavigationPanel';
import { CommercePanel } from './ui/components/CommercePanel';
import { AdminPanel } from './ui/components/AdminPanel';
import { useStore } from './data/store';
import './App.css';

function App() {
  const { debugMode, setDebugMode, activePanel, setActivePanel } = useStore();

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>Barrio Altos de Podesta</h1>
        <div className="header-controls">
          <label className="debug-toggle">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            Debug
          </label>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <nav className="sidebar-tabs">
            <button
              className={`tab ${activePanel === 'nav' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'nav' ? null : 'nav')}
            >
              Navegar
            </button>
            <button
              className={`tab ${activePanel === 'commerce' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'commerce' ? null : 'commerce')}
            >
              Comercios
            </button>
            <button
              className={`tab ${activePanel === 'admin' ? 'active' : ''}`}
              onClick={() => setActivePanel(activePanel === 'admin' ? null : 'admin')}
            >
              Admin
            </button>
          </nav>

          <div className="sidebar-content">
            {activePanel === 'nav' && <NavigationPanel />}
            {activePanel === 'commerce' && <CommercePanel />}
            {activePanel === 'admin' && <AdminPanel />}
          </div>
        </aside>

        {/* Map */}
        <main className="map-area">
          <MapViewer />
        </main>
      </div>
    </div>
  );
}

export default App;
