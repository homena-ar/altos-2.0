import { useState } from 'react';
import { useStore } from '../../data/store';
import { housesPerBlock, setBlockOverride, getBlockOverride, clearOverride } from '../../houseNumbering';
import type { Corner, BlockOverride } from '../../houseNumbering';

export function AdminPanel() {
  const { blockOverrides, setBlockOverride: storeSetOverride } = useStore();

  const [selectedBlock, setSelectedBlock] = useState('');
  const [cornerOverride, setCornerOverride] = useState<Corner | ''>('');
  const [dirOverride, setDirOverride] = useState<'cw' | 'ccw' | ''>('');
  const [manualInput, setManualInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const blocks = Object.keys(housesPerBlock).sort((a, b) => Number(a) - Number(b));

  const handleSelectBlock = (blockId: string) => {
    setSelectedBlock(blockId);
    const existing = getBlockOverride(blockId) || blockOverrides.get(blockId);
    if (existing) {
      setCornerOverride(existing.startCorner || '');
      setDirOverride(existing.direction || '');
      if (existing.manualPositions) {
        const entries = Object.entries(existing.manualPositions)
          .map(([k, v]) => `${k}:${v.x},${v.y}`)
          .join('\n');
        setManualInput(entries);
      } else {
        setManualInput('');
      }
    } else {
      setCornerOverride('');
      setDirOverride('');
      setManualInput('');
    }
    setStatusMsg('');
  };

  const handleSave = () => {
    if (!selectedBlock) return;

    const override: BlockOverride = {};

    if (cornerOverride) {
      override.startCorner = cornerOverride as Corner;
    }
    if (dirOverride) {
      override.direction = dirOverride as 'cw' | 'ccw';
    }
    if (manualInput.trim()) {
      const positions: Record<number, { x: number; y: number }> = {};
      manualInput.trim().split('\n').forEach(line => {
        const match = line.match(/(\d+):\s*([\d.]+),\s*([\d.]+)/);
        if (match) {
          positions[parseInt(match[1])] = {
            x: parseFloat(match[2]),
            y: parseFloat(match[3]),
          };
        }
      });
      if (Object.keys(positions).length > 0) {
        override.manualPositions = positions;
      }
    }

    setBlockOverride(selectedBlock, override);
    storeSetOverride(selectedBlock, override);
    setStatusMsg(`Override guardado para Manzana ${selectedBlock}`);
  };

  const handleClear = () => {
    if (!selectedBlock) return;
    clearOverride(selectedBlock);
    setCornerOverride('');
    setDirOverride('');
    setManualInput('');
    setStatusMsg(`Override eliminado para Manzana ${selectedBlock}`);
  };

  return (
    <div className="panel admin-panel">
      <h2>Admin - Correccion de Casas</h2>

      <div className="field">
        <label>Manzana:</label>
        <select value={selectedBlock} onChange={e => handleSelectBlock(e.target.value)}>
          <option value="">Seleccionar manzana...</option>
          {blocks.map(b => (
            <option key={b} value={b}>
              Manzana {b} ({housesPerBlock[b]} casas)
              {(getBlockOverride(b) || blockOverrides.get(b)) ? ' *' : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedBlock && (
        <>
          <div className="admin-info">
            <span>Casas: {housesPerBlock[selectedBlock]}</span>
            <span>Lado 1: {Math.ceil(housesPerBlock[selectedBlock] / 2)}</span>
            <span>Lado 2: {Math.floor(housesPerBlock[selectedBlock] / 2)}</span>
          </div>

          <div className="field">
            <label>Esquina de inicio (override):</label>
            <div className="corner-buttons">
              {(['NW', 'NE', 'SE', 'SW'] as Corner[]).map(c => (
                <button
                  key={c}
                  className={`corner-btn ${cornerOverride === c ? 'active' : ''}`}
                  onClick={() => setCornerOverride(cornerOverride === c ? '' : c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Direccion (override):</label>
            <div className="origin-buttons">
              <button
                className={`origin-btn ${dirOverride === 'cw' ? 'active' : ''}`}
                onClick={() => setDirOverride(dirOverride === 'cw' ? '' : 'cw')}
              >
                Horario (CW)
              </button>
              <button
                className={`origin-btn ${dirOverride === 'ccw' ? 'active' : ''}`}
                onClick={() => setDirOverride(dirOverride === 'ccw' ? '' : 'ccw')}
              >
                Anti-horario (CCW)
              </button>
            </div>
          </div>

          <div className="field">
            <label>Posiciones manuales (casa:x,y por linea):</label>
            <textarea
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder={"1:250.5,300.2\n2:252.0,300.2\n3:253.5,300.2"}
              rows={5}
              className="mono"
            />
          </div>

          <div className="btn-row">
            <button className="btn-primary" onClick={handleSave}>Guardar Override</button>
            <button className="btn-secondary" onClick={handleClear}>Limpiar</button>
          </div>

          {statusMsg && <p className="status-msg">{statusMsg}</p>}
        </>
      )}

      {/* List existing overrides */}
      <div className="overrides-list">
        <h3>Overrides activos</h3>
        {blockOverrides.size === 0 && <p className="empty-msg">Sin overrides</p>}
        {Array.from(blockOverrides.entries()).map(([blockId, override]) => (
          <div key={blockId} className="override-item">
            <strong>Manzana {blockId}</strong>
            {override.startCorner && <span>Esquina: {override.startCorner}</span>}
            {override.direction && <span>Dir: {override.direction}</span>}
            {override.manualPositions && (
              <span>{Object.keys(override.manualPositions).length} posiciones manuales</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
