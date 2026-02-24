import type { GraphNode } from '../../routing/graph';
import type { MapData } from '../../map/types';

interface Props {
  graph: Map<string, GraphNode>;
  mapData: MapData;
}

export function DebugOverlay({ graph, mapData }: Props) {
  const nodes = Array.from(graph.values());

  return (
    <g className="debug-overlay">
      {/* Draw edges */}
      {nodes.map(node =>
        node.edges.map(edge => {
          const to = graph.get(edge.to);
          if (!to) return null;
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <line
                x1={node.point.x}
                y1={node.point.y}
                x2={to.point.x}
                y2={to.point.y}
                stroke={edge.isOneWay ? '#f97316' : '#6366f1'}
                strokeWidth={0.6}
                opacity={0.6}
              />
              {/* Arrow for one-way */}
              {edge.isOneWay && (
                <ArrowHead
                  from={node.point}
                  to={to.point}
                  color="#f97316"
                />
              )}
            </g>
          );
        })
      )}

      {/* Draw nodes */}
      {nodes.map(node => (
        <circle
          key={node.id}
          cx={node.point.x}
          cy={node.point.y}
          r={1.2}
          fill="#6366f1"
          opacity={0.8}
        />
      ))}

      {/* Draw one-way lanes from SVG */}
      {mapData.oneWayLanes.map(lane => (
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

      {/* Node count label */}
      <text x={10} y={15} fontSize={8} fill="#6366f1" fontFamily="monospace">
        Nodos: {nodes.length} | Aristas: {nodes.reduce((s, n) => s + n.edges.length, 0)}
      </text>
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
