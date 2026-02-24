import type { RouteResult } from '../../routing/astar';

interface Props {
  route: RouteResult;
  animationProgress: number;
}

export function RouteOverlay({ route, animationProgress }: Props) {
  if (route.points.length < 2) return null;

  // Build polyline string
  const polylinePoints = route.points.map(p => `${p.x},${p.y}`).join(' ');

  // Calculate animated position along the route
  const totalLen = route.totalDistance;
  const targetDist = animationProgress * totalLen;
  let accumulated = 0;
  let animPoint = route.points[0];

  for (let i = 1; i < route.points.length; i++) {
    const segLen = Math.sqrt(
      (route.points[i].x - route.points[i - 1].x) ** 2 +
      (route.points[i].y - route.points[i - 1].y) ** 2
    );
    if (accumulated + segLen >= targetDist) {
      const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      animPoint = {
        x: route.points[i - 1].x + (route.points[i].x - route.points[i - 1].x) * t,
        y: route.points[i - 1].y + (route.points[i].y - route.points[i - 1].y) * t,
      };
      break;
    }
    accumulated += segLen;
  }

  return (
    <g className="route-overlay">
      {/* Route shadow */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Route line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Animated dot */}
      {animationProgress > 0 && animationProgress < 1 && (
        <>
          <circle
            cx={animPoint.x}
            cy={animPoint.y}
            r={4}
            fill="#3b82f6"
            opacity={0.3}
          >
            <animate
              attributeName="r"
              from="4"
              to="8"
              dur="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.4"
              to="0"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={animPoint.x}
            cy={animPoint.y}
            r={3}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1}
          />
        </>
      )}

      {/* Turn markers */}
      {route.instructions.map((inst, i) => (
        <g key={i}>
          {inst.direction !== 'straight' && inst.direction !== 'arrive' && (
            <circle
              cx={inst.point.x}
              cy={inst.point.y}
              r={2}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={0.8}
            />
          )}
        </g>
      ))}
    </g>
  );
}
