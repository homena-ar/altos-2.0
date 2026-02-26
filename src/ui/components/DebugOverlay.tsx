import { useState } from 'react';
import type { GraphNode } from '../../routing/graph';
import type { MapData } from '../../map/types';

interface Props {
  graph: Map<string, GraphNode>;
  mapData: MapData;
}

export function DebugOverlay({ graph, mapData }: Props) {
  const [showNodes, setShowNodes] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showLanes, setShowLanes] = useState(true);
  const [showConnectors, setShowConnectors] = useState(true);

  const nodes = Array.from(graph.values());
  const edgeCount = nodes.reduce((s, n) => s + n.edges.length, 0);

  return (
    <g className="debug-overlay">
      {/* Toggle controls rendered as SVG foreignObject */}
      <foreignObject x={5} y={5} width={200} height={105}>
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '7px',
            fontFamily: 'monospace',
            color: '#334155',
            pointerEvents: 'auto',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ marginBottom: '2px', color: '#6366f1', fontWeight: 'bold' }}>
            Nodos: {nodes.length} | Aristas: {edgeCount}
          </div>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} style={{ marginRight: '4px' }} />
            Aristas
          </label>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="checkbox" checked={showNodes} onChange={(e) => setShowNodes(e.target.checked)} style={{ marginRight: '4px' }} />
            Nodos
          </label>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="checkbox" checked={showLanes} onChange={(e) => setShowLanes(e.target.checked)} style={{ marginRight: '4px' }} />
            Carriles
          </label>
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="checkbox" checked={showConnectors} onChange={(e) => setShowConnectors(e.target.checked)} style={{ marginRight: '4px' }} />
            Connectors casa&rarr;calle
          </label>
        </div>
      </foreignObject>

      {/* Draw edges */}
      {showEdges && nodes.map(node =>
        node.edges.map(edge => {
          const to = graph.get(edge.to);
          if (!to) return null;
          const isConnector = edge.segment?.id.startsWith('connector_');
          if (isConnector && !showConnectors) return null;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={node.point.x}
                y1={node.point.y}
                x2={to.point.x}
                y2={to.point.y}
                stroke={isConnector ? '#ec4899' : edge.isOneWay ? '#f97316' : '#6366f1'}
                strokeWidth={isConnector ? 0.8 : 0.6}
                opacity={0.6}
                strokeDasharray={isConnector ? '2,1' : undefined}
              />
              {edge.isOneWay && !isConnector && (
                <ArrowHead from={node.point} to={to.point} color="#f97316" />
              )}
            </g>
          );
        })
      )}

      {/* Draw nodes */}
      {showNodes && nodes.map(node => (
        <circle
          key={node.id}
          cx={node.point.x}
          cy={node.point.y}
          r={1.2}
          fill={node.id.startsWith('__') ? '#ec4899' : '#6366f1'}
          opacity={0.8}
        />
      ))}

      {/* Draw one-way lanes from SVG */}
      {showLanes && mapData.oneWayLanes.map(lane => (
        <line
          key={lane.id}
          x1={lane.start.x}
          y1={lane.start.y}
          x2={lane.end.x}
          y2={lane.end.y}
          stroke={lane.color === 'green' ? '#22c55e' : '#ef4444'}
          strokeWidth={1.5}
          opacity={0.4}
          strokeDasharray="3,2"
        />
      ))}
    </g>
  );
}

function ArrowHead({ from, to, color }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return null;

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const angle = Math.atan2(dy, dx);

  const size = 2;
  const x1 = midX - size * Math.cos(angle - 0.5);
  const y1 = midY - size * Math.sin(angle - 0.5);
  const x2 = midX - size * Math.cos(angle + 0.5);
  const y2 = midY - size * Math.sin(angle + 0.5);

  return (
    <polygon
      points={`${midX},${midY} ${x1},${y1} ${x2},${y2}`}
      fill={color}
      opacity={0.7}
    />
  );
}
