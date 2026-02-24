import type { Point, MapData, StreetSegment, OneWayLane } from '../map/types';

export interface GraphNode {
  id: string;
  point: Point;
  edges: GraphEdge[];
}

export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
  segment?: StreetSegment;
  isOneWay: boolean;
}

const SNAP_TOLERANCE = 8; // pixels tolerance for connecting streets

function pointKey(p: Point): string {
  return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function snapPoint(p: Point, nodeMap: Map<string, GraphNode>): string | null {
  let bestKey: string | null = null;
  let bestDist = SNAP_TOLERANCE;
  for (const [key, node] of nodeMap) {
    const d = dist(p, node.point);
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

function getOrCreateNode(p: Point, nodeMap: Map<string, GraphNode>): string {
  // Try to snap to existing node
  const existing = snapPoint(p, nodeMap);
  if (existing) return existing;

  const key = pointKey(p);
  if (!nodeMap.has(key)) {
    nodeMap.set(key, { id: key, point: { ...p }, edges: [] });
  }
  return key;
}

// Check if a point is on a segment (with tolerance)
function isPointOnSegment(p: Point, seg: { start: Point; end: Point }, tolerance: number = 4): boolean {
  const d1 = dist(p, seg.start);
  const d2 = dist(p, seg.end);
  const segLen = dist(seg.start, seg.end);
  return Math.abs(d1 + d2 - segLen) < tolerance;
}

// Determine one-way constraints from the lane data
function getOneWayConstraints(mapData: MapData): Map<string, { direction: Point }> {
  const constraints = new Map<string, { direction: Point }>();

  mapData.oneWayLanes.forEach(lane => {
    // The direction vector tells us which way traffic flows
    let dir: Point;
    switch (lane.direction) {
      case '+x': dir = { x: 1, y: 0 }; break;
      case '-x': dir = { x: -1, y: 0 }; break;
      case '+y': dir = { x: 0, y: 1 }; break;
      case '-y': dir = { x: 0, y: -1 }; break;
      default: dir = { x: 1, y: 0 };
    }
    constraints.set(lane.id, { direction: dir });
  });

  return constraints;
}

// Check if a street segment is affected by a one-way lane
function findOneWayForSegment(
  seg: StreetSegment,
  lanes: OneWayLane[]
): OneWayLane | null {
  for (const lane of lanes) {
    // Check if segment overlaps with lane
    const segMid = {
      x: (seg.start.x + seg.end.x) / 2,
      y: (seg.start.y + seg.end.y) / 2,
    };

    if (seg.orientation === lane.orientation && isPointOnSegment(segMid, lane, 12)) {
      return lane;
    }
  }
  return null;
}

export function buildGraph(mapData: MapData): Map<string, GraphNode> {
  const nodeMap = new Map<string, GraphNode>();
  void getOneWayConstraints(mapData);

  // First pass: create nodes from all street endpoints
  const segments = [...mapData.streets];

  segments.forEach(seg => {
    getOrCreateNode(seg.start, nodeMap);
    getOrCreateNode(seg.end, nodeMap);
  });

  // Also add access points as nodes
  mapData.accessPoints.forEach(ap => {
    getOrCreateNode(ap.position, nodeMap);
  });

  // Find intersections: where segments cross each other
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const inter = findIntersection(segments[i], segments[j]);
      if (inter) {
        getOrCreateNode(inter, nodeMap);
      }
    }
  }

  // Second pass: split segments at intersection nodes and create edges
  segments.forEach(seg => {
    const startKey = getOrCreateNode(seg.start, nodeMap);
    const endKey = getOrCreateNode(seg.end, nodeMap);

    // Collect all nodes that lie on this segment
    const nodesOnSeg: { key: string; t: number }[] = [];
    const segLen = dist(seg.start, seg.end);
    if (segLen < 0.5) return;

    for (const [key, node] of nodeMap) {
      if (key === startKey || key === endKey) continue;
      if (isPointOnSegment(node.point, seg, 4)) {
        const t = dist(seg.start, node.point) / segLen;
        nodesOnSeg.push({ key, t });
      }
    }

    // Sort by parameter along segment
    nodesOnSeg.sort((a, b) => a.t - b.t);

    // Create chain of edges
    const chain = [
      { key: startKey, t: 0 },
      ...nodesOnSeg,
      { key: endKey, t: 1 },
    ];

    // Check one-way constraint for this segment
    const oneWay = findOneWayForSegment(seg, mapData.oneWayLanes);

    for (let k = 0; k < chain.length - 1; k++) {
      const fromKey = chain[k].key;
      const toKey = chain[k + 1].key;
      if (fromKey === toKey) continue;

      const fromNode = nodeMap.get(fromKey)!;
      const toNode = nodeMap.get(toKey)!;
      const w = dist(fromNode.point, toNode.point);

      if (oneWay) {
        // Determine if the edge direction matches the one-way direction
        const edgeDir = {
          x: toNode.point.x - fromNode.point.x,
          y: toNode.point.y - fromNode.point.y,
        };
        let owDir: Point;
        switch (oneWay.direction) {
          case '+x': owDir = { x: 1, y: 0 }; break;
          case '-x': owDir = { x: -1, y: 0 }; break;
          case '+y': owDir = { x: 0, y: 1 }; break;
          case '-y': owDir = { x: 0, y: -1 }; break;
          default: owDir = { x: 1, y: 0 };
        }

        const dot = edgeDir.x * owDir.x + edgeDir.y * owDir.y;

        if (dot >= 0) {
          // Forward direction allowed
          addEdge(nodeMap, fromKey, toKey, w, seg, true);
        } else {
          // Reverse direction allowed
          addEdge(nodeMap, toKey, fromKey, w, seg, true);
        }
      } else {
        // Bidirectional
        addEdge(nodeMap, fromKey, toKey, w, seg, false);
        addEdge(nodeMap, toKey, fromKey, w, seg, false);
      }
    }
  });

  return nodeMap;
}

function addEdge(
  nodeMap: Map<string, GraphNode>,
  fromKey: string,
  toKey: string,
  weight: number,
  segment: StreetSegment,
  isOneWay: boolean
): void {
  const fromNode = nodeMap.get(fromKey);
  if (!fromNode) return;

  // Avoid duplicate edges
  if (fromNode.edges.some(e => e.to === toKey)) return;

  fromNode.edges.push({
    from: fromKey,
    to: toKey,
    weight,
    segment,
    isOneWay,
  });
}

function findIntersection(seg1: StreetSegment, seg2: StreetSegment): Point | null {
  // Only handle h/v intersections for simplicity
  if (seg1.orientation === seg2.orientation) return null;

  const hSeg = seg1.orientation === 'h' ? seg1 : seg2;
  const vSeg = seg1.orientation === 'v' ? seg1 : seg2;

  if (hSeg.orientation !== 'h' || vSeg.orientation !== 'v') return null;

  const hY = hSeg.start.y;
  const vX = vSeg.start.x;

  const hMinX = Math.min(hSeg.start.x, hSeg.end.x) - 1;
  const hMaxX = Math.max(hSeg.start.x, hSeg.end.x) + 1;
  const vMinY = Math.min(vSeg.start.y, vSeg.end.y) - 1;
  const vMaxY = Math.max(vSeg.start.y, vSeg.end.y) + 1;

  if (vX >= hMinX && vX <= hMaxX && hY >= vMinY && hY <= vMaxY) {
    return { x: vX, y: hY };
  }

  return null;
}

export function findNearestNode(point: Point, graph: Map<string, GraphNode>): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const [key, node] of graph) {
    const d = dist(point, node.point);
    if (d < bestDist) {
      bestDist = d;
      best = key;
    }
  }

  return best;
}
