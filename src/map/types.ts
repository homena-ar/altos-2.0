export interface Point {
  x: number;
  y: number;
}

export interface Block {
  id: string;         // e.g. "99"
  svgId: string;      // e.g. "M99"
  rect: { x: number; y: number; width: number; height: number };
  center: Point;
  startCorner: Point; // from start_M99 circle
  label: string;
}

export interface StreetSegment {
  id: string;
  start: Point;
  end: Point;
  orientation: 'h' | 'v' | 'd'; // horizontal, vertical, diagonal
}

export interface OneWayLane {
  id: string;
  laneId: string;
  start: Point;
  end: Point;
  orientation: 'h' | 'v';
  direction: string;  // "+x", "+y", "-x", "-y"
  color: 'green' | 'red';
}

export interface Landmark {
  id: string;
  name: string;
  center: Point;
  type: 'plaza' | 'school' | 'chapel' | 'garden' | 'other';
}

export interface AccessPoint {
  id: string;
  name: string;
  position: Point;
  type: 'main' | 'secondary';
}

export interface MapData {
  viewBox: { width: number; height: number };
  blocks: Map<string, Block>;
  streets: StreetSegment[];
  oneWayLanes: OneWayLane[];
  landmarks: Landmark[];
  accessPoints: AccessPoint[];
  perimeter: Point[];
}
