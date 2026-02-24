import type { Point } from '../../map/types';

interface Props {
  point: Point;
  color: string;
  label: string;
}

export function PinOverlay({ point, color, label }: Props) {
  return (
    <g className="pin-overlay" transform={`translate(${point.x}, ${point.y})`}>
      {/* Pin shadow */}
      <ellipse cx={0} cy={1} rx={3} ry={1.5} fill="rgba(0,0,0,0.2)" />

      {/* Pin body */}
      <path
        d="M0,-12 C-4,-12 -6,-9 -6,-6 C-6,-2 0,2 0,2 C0,2 6,-2 6,-6 C6,-9 4,-12 0,-12Z"
        fill={color}
        stroke="white"
        strokeWidth={0.8}
      />

      {/* Inner circle */}
      <circle cx={0} cy={-7} r={2.5} fill="white" />

      {/* Label */}
      <text
        x={0}
        y={-5.5}
        textAnchor="middle"
        fontSize={3.5}
        fontWeight="bold"
        fill={color}
        fontFamily="Arial, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}
