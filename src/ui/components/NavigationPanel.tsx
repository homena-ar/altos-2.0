import { useState, useMemo } from 'react';
import { useStore } from '../../data/store';
import { housesPerBlock, isValidHouse } from '../../houseNumbering';
import type { OriginType } from '../../data/store';

export function NavigationPanel() {
  const {
    origin, setOrigin, destinationBlock, destinationHouse,
    setDestination, route, isNavigating, setIsNavigating,
    setAnimationProgress,
  } = useStore();

  const [blockInput, setBlockInput] = useState(destinationBlock);
  const [houseInput, setHouseInput] = useState(destinationHouse?.toString() || '');
  const [blockError, setBlockError] = useState('');
  const [houseError, setHouseError] = useState('');

  const availableBlocks = useMemo(() => Object.keys(housesPerBlock).sort((a, b) => Number(a) - Number(b)), []);

  const filteredBlocks = useMemo(() => {
    if (!blockInput) return availableBlocks.slice(0, 15);
    return availableBlocks.filter(b => b.startsWith(blockInput));
  }, [blockInput, availableBlocks]);

  const maxHouses = blockInput && housesPerBlock[blockInput] ? housesPerBlock[blockInput] : 0;

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

  return (
    <div className="panel navigation-panel">
      <h2>Navegacion</h2>

      {/* Origin selector */}
      <div className="field">
        <label>Desde:</label>
        <div className="origin-buttons">
          {([
            ['marquez', 'Av. Marquez'],
            ['florida', 'Florida'],
            ['gps', 'Mi ubicacion'],
          ] as [OriginType, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`origin-btn ${origin === key ? 'active' : ''}`}
              onClick={() => setOrigin(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Destination input */}
      <div className="field">
        <label>Manzana:</label>
        <div className="input-with-autocomplete">
          <input
            type="text"
            value={blockInput}
            onChange={(e) => handleBlockChange(e.target.value)}
            placeholder="Ej: 44"
            list="blocks-list"
          />
          <datalist id="blocks-list">
            {filteredBlocks.map(b => (
              <option key={b} value={b}>Manzana {b} ({housesPerBlock[b]} casas)</option>
            ))}
          </datalist>
        </div>
        {blockError && <span className="error">{blockError}</span>}
        {maxHouses > 0 && <span className="hint">{maxHouses} casas</span>}
      </div>

      <div className="field">
        <label>Casa:</label>
        <input
          type="number"
          min={1}
          max={maxHouses}
          value={houseInput}
          onChange={(e) => handleHouseChange(e.target.value)}
          placeholder={maxHouses ? `1-${maxHouses}` : 'Selecciona manzana'}
          disabled={!blockInput || !!blockError}
        />
        {houseError && <span className="error">{houseError}</span>}
      </div>

      <button
        className="btn-primary"
        onClick={handleNavigate}
        disabled={!blockInput || !!blockError || (!!houseInput && !!houseError)}
      >
        Calcular Ruta
      </button>

      {/* Route info */}
      {route && (
        <div className="route-info">
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
