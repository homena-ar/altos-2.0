import { useState, useMemo } from 'react';
import { useStore } from '../../data/store';
import { housesPerBlock, isValidHouse } from '../../houseNumbering';
import type { OriginType } from '../../data/store';

const originLabels: Record<OriginType, string> = {
  marquez: 'Av. Marquez',
  florida: 'Florida',
  gps: 'Mi ubicacion',
  block_house: 'Manzana',
  map_click: 'Click mapa',
};

export function NavigationPanel() {
  const {
    origin, setOrigin, destinationBlock, destinationHouse,
    setDestination, route, routeError, isNavigating, setIsNavigating,
    setAnimationProgress, resetRoute,
    setOriginBlockHouse, setClickMode,
  } = useStore();

  const [blockInput, setBlockInput] = useState(destinationBlock);
  const [houseInput, setHouseInput] = useState(destinationHouse?.toString() || '');
  const [blockError, setBlockError] = useState('');
  const [houseError, setHouseError] = useState('');

  // Origin block/house for block_house mode
  const [origBlockInput, setOrigBlockInput] = useState('');
  const [origHouseInput, setOrigHouseInput] = useState('');

  const availableBlocks = useMemo(() => Object.keys(housesPerBlock).sort((a, b) => Number(a) - Number(b)), []);

  const filteredBlocks = useMemo(() => {
    if (!blockInput) return availableBlocks.slice(0, 15);
    return availableBlocks.filter(b => b.startsWith(blockInput));
  }, [blockInput, availableBlocks]);

  const maxHouses = blockInput && housesPerBlock[blockInput] ? housesPerBlock[blockInput] : 0;
  const origMaxHouses = origBlockInput && housesPerBlock[origBlockInput] ? housesPerBlock[origBlockInput] : 0;

  const handleBlockChange = (val: string) => {
    setBlockInput(val);
    setBlockError('');
    setHouseInput('');
    setHouseError('');
    if (val && !housesPerBlock[val]) {
      setBlockError(`Manzana ${val} no existe`);
    }
  };

  const handleHouseChange = (val: string) => {
    setHouseInput(val);
    setHouseError('');
    const num = parseInt(val, 10);
    if (val && blockInput && !isNaN(num) && !isValidHouse(blockInput, num)) {
      setHouseError(`Casa debe ser entre 1 y ${maxHouses}`);
    }
  };

  const handleNavigate = () => {
    if (!blockInput || blockError) return;
    const houseNum = houseInput ? parseInt(houseInput, 10) : null;
    if (houseNum !== null && houseError) return;
    setDestination(blockInput, houseNum);
  };

  const handleStartAnimation = () => {
    if (route) {
      setAnimationProgress(0);
      setIsNavigating(true);
    }
  };

  const handleReset = () => {
    setBlockInput('');
    setHouseInput('');
    setBlockError('');
    setHouseError('');
    setOrigBlockInput('');
    setOrigHouseInput('');
    resetRoute();
  };

  const handleOriginBlockHouse = () => {
    if (!origBlockInput || !housesPerBlock[origBlockInput]) return;
    const num = origHouseInput ? parseInt(origHouseInput, 10) : null;
    setOriginBlockHouse(origBlockInput, num);
    setOrigin('block_house');
  };

  return (
    <div className="panel navigation-panel">
      <div className="panel-header">
        <h2>Navegacion</h2>
        {(destinationBlock || route) && (
          <button className="btn-small" onClick={handleReset}>
            Reiniciar
          </button>
        )}
      </div>

      {/* Origin selector */}
      <div className="field">
        <label>Desde:</label>
        <div className="origin-buttons">
          {([
            ['marquez', 'Marquez'],
            ['florida', 'Florida'],
            ['gps', 'GPS'],
            ['block_house', 'Mz+Casa'],
            ['map_click', 'Mapa'],
          ] as [OriginType, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`origin-btn ${origin === key ? 'active' : ''}`}
              onClick={() => {
                if (key === 'map_click') {
                  setClickMode('origin');
                } else {
                  setOrigin(key);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Origin block+house sub-form */}
      {origin === 'block_house' && (
        <div className="origin-block-house-form">
          <div className="field-row">
            <div className="field">
              <label>Manzana origen:</label>
              <input
                type="text"
                value={origBlockInput}
                onChange={e => setOrigBlockInput(e.target.value)}
                placeholder="Ej: 24"
                list="orig-blocks-list"
              />
              <datalist id="orig-blocks-list">
                {availableBlocks.map(b => (
                  <option key={b} value={b}>Mz {b}</option>
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Casa origen:</label>
              <input
                type="number"
                min={1}
                max={origMaxHouses}
                value={origHouseInput}
                onChange={e => setOrigHouseInput(e.target.value)}
                placeholder={origMaxHouses ? `1-${origMaxHouses}` : '-'}
                disabled={!origBlockInput || !housesPerBlock[origBlockInput]}
              />
            </div>
          </div>
          <button
            className="btn-secondary"
            onClick={handleOriginBlockHouse}
            disabled={!origBlockInput || !housesPerBlock[origBlockInput]}
            style={{ marginBottom: '0.5rem' }}
          >
            Fijar origen
          </button>
        </div>
      )}

      {/* Destination */}
      <div className="field">
        <label>Destino - Manzana:</label>
        <div className="field-row">
          <div className="field" style={{ flex: 2 }}>
            <input
              type="text"
              value={blockInput}
              onChange={(e) => handleBlockChange(e.target.value)}
              placeholder="Ej: 29"
              list="blocks-list"
            />
            <datalist id="blocks-list">
              {filteredBlocks.map(b => (
                <option key={b} value={b}>Manzana {b} ({housesPerBlock[b]} casas)</option>
              ))}
            </datalist>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <input
              type="number"
              min={1}
              max={maxHouses}
              value={houseInput}
              onChange={(e) => handleHouseChange(e.target.value)}
              placeholder={maxHouses ? `Casa` : '-'}
              disabled={!blockInput || !!blockError}
            />
          </div>
        </div>
        {blockError && <span className="error">{blockError}</span>}
        {houseError && <span className="error">{houseError}</span>}
        {maxHouses > 0 && !blockError && <span className="hint">{maxHouses} casas en Mz {blockInput}</span>}
      </div>

      <div className="field-row" style={{ marginBottom: '0.5rem' }}>
        <button
          className="btn-primary"
          onClick={handleNavigate}
          disabled={!blockInput || !!blockError || (!!houseInput && !!houseError)}
          style={{ flex: 2 }}
        >
          Calcular Ruta
        </button>
        <button
          className="btn-secondary"
          onClick={() => setClickMode('destination')}
          style={{ flex: 1 }}
          title="Seleccionar destino en el mapa"
        >
          Click mapa
        </button>
      </div>

      {/* Route error */}
      {routeError && !route && (
        <div className="route-error">
          {routeError}
        </div>
      )}

      {/* Route info */}
      {route && (
        <div className="route-info">
          {/* Origin → Destination summary */}
          <div className="route-summary">
            {originLabels[origin]} &rarr; Manzana {destinationBlock}
            {destinationHouse ? `, Casa ${destinationHouse}` : ''}
          </div>

          <div className="route-stats">
            <span>Distancia: ~{Math.round(route.totalDistance)}m</span>
            <span>Pasos: {route.instructions.length}</span>
          </div>

          <button
            className="btn-secondary"
            onClick={handleStartAnimation}
            disabled={isNavigating}
          >
            {isNavigating ? 'Navegando...' : 'Iniciar Navegacion'}
          </button>

          {/* Turn-by-turn */}
          <div className="turn-by-turn">
            <h3>Instrucciones</h3>
            {route.instructions.map((inst, i) => (
              <div key={i} className={`instruction ${inst.direction}`}>
                <span className="turn-icon">
                  {inst.direction === 'straight' && '\u2B06'}
                  {inst.direction === 'left' && '\u2B05'}
                  {inst.direction === 'right' && '\u27A1'}
                  {inst.direction === 'u-turn' && '\u21A9'}
                  {inst.direction === 'arrive' && '\u{1F3C1}'}
                </span>
                <span className="turn-text">{inst.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
