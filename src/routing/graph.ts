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

const SNAP_TOLERANCE = 8;

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
  const existing = snapPoint(p, nodeMap);
  if (existing) return existing;

  const key = pointKey(p);
  if (!nodeMap.has(key)) {
    nodeMap.set(key, { id: key, point: { ...p }, edges: [] });
  }
  return key;
}

function isPointOnSegment(p: Point, seg: { start: Point; end: Point }, tolerance: number = 4): boolean {
  const d1 = dist(p, seg.start);
  const d2 = dist(p, seg.end);
  const segLen = dist(seg.start, seg.end);
  return Math.abs(d1 + d2 - segLen) < tolerance;
}

/** Convert a OneWayLane to a StreetSegment for graph building */
function laneToSegment(lane: OneWayLane): StreetSegment {
  return {
    id: lane.id,
    start: lane.start,
    end: lane.end,
    orientation: lane.orientation === 'h' ? 'h' : 'v',
  };
}

/** Get the unit direction vector for a one-way lane */
function getOneWayDir(lane: OneWayLane): Point {
  switch (lane.direction) {
    case '+x': return { x: 1, y: 0 };
    case '-x': return { x: -1, y: 0 };
    case '+y': return { x: 0, y: 1 };
    case '-y': return { x: 0, y: -1 };
    default: return { x: 1, y: 0 };
  }
}

/** Check if a street segment IS one of the one-way lanes (by id) */
function isExplicitLane(seg: StreetSegment, lanes: OneWayLane[]): OneWayLane | null {
  for (const lane of lanes) {
    if (seg.id === lane.id) return lane;
  }
  return null;
}

/** Check if a street segment overlaps with a one-way lane (by geometry) */
function findOverlappingLane(seg: StreetSegment, lanes: OneWayLane[]): OneWayLane | null {
  for (const lane of lanes) {
    if (seg.orientation !== lane.orientation) continue;
    const segMid = {
      x: (seg.start.x + seg.end.x) / 2,
      y: (seg.start.y + seg.end.y) / 2,
    };
    if (isPointOnSegment(segMid, lane, 12)) {
      return lane;
    }
  }
  return null;
}

export function buildGraph(mapData: MapData): Map<string, GraphNode> {
  const nodeMap = new Map<string, GraphNode>();

  // Merge regular streets AND one-way lanes into the segment list.
  // One-way lanes (st_merge_*) ARE actual streets (the main boulevard)
  // that have no corresponding st_0### paths in the SVG.
  const laneSegments = mapData.oneWayLanes.map(laneToSegment);
  const segments: StreetSegment[] = [...mapData.streets, ...laneSegments];

  // First pass: create nodes from all segment endpoints
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

    nodesOnSeg.sort((a, b) => a.t - b.t);

    const chain = [
      { key: startKey, t: 0 },
      ...nodesOnSeg,
      { key: endKey, t: 1 },
    ];

    // Determine one-way constraint:
    // 1. If this segment IS a one-way lane itself, use its direction
    // 2. If this segment overlaps a one-way lane, use that lane's direction
    const explicitLane = isExplicitLane(seg, mapData.oneWayLanes);
    const overlappingLane = explicitLane ? null : findOverlappingLane(seg, mapData.oneWayLanes);
    const oneWayLane = explicitLane || overlappingLane;

    for (let k = 0; k < chain.length - 1; k++) {
      const fromKey = chain[k].key;
      const toKey = chain[k + 1].key;
      if (fromKey === toKey) continue;

      const fromNode = nodeMap.get(fromKey)!;
      const toNode = nodeMap.get(toKey)!;
      const w = dist(fromNode.point, toNode.point);

      if (oneWayLane) {
        const edgeDir = {
          x: toNode.point.x - fromNode.point.x,
          y: toNode.point.y - fromNode.point.y,
        };
        const owDir = getOneWayDir(oneWayLane);
        const dot = edgeDir.x * owDir.x + edgeDir.y * owDir.y;

        if (dot >= 0) {
          addEdge(nodeMap, fromKey, toKey, w, seg, true);
        } else {
          addEdge(nodeMap, toKey, fromKey, w, seg, true);
        }
      } else {
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
