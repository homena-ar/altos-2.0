import type { GraphNode } from './graph';
import type { Point } from '../map/types';

export interface RouteResult {
  path: string[];       // node IDs in order
  points: Point[];      // coordinates in order
  totalDistance: number;
  instructions: TurnInstruction[];
}

export interface TurnInstruction {
  point: Point;
  direction: 'straight' | 'left' | 'right' | 'u-turn' | 'arrive';
  streetName?: string;
  distanceToNext: number;
  text: string;
}

function heuristic(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function getTurnDirection(prevAngle: number, nextAngle: number): 'straight' | 'left' | 'right' | 'u-turn' {
  let diff = nextAngle - prevAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  if (Math.abs(diff) < 0.4) return 'straight';
  if (Math.abs(diff) > 2.7) return 'u-turn';
  if (diff > 0) return 'right';  // In SVG, Y is flipped, so positive = right
  return 'left';
}

function getTurnText(dir: 'straight' | 'left' | 'right' | 'u-turn' | 'arrive', distance: number): string {
  const distStr = `${Math.round(distance)}m`;
  switch (dir) {
    case 'straight': return `Seguir derecho ${distStr}`;
    case 'left': return `Girar a la izquierda, luego ${distStr}`;
    case 'right': return `Girar a la derecha, luego ${distStr}`;
    case 'u-turn': return `Dar vuelta en U`;
    case 'arrive': return `Has llegado a tu destino`;
  }
}

export function astar(
  graph: Map<string, GraphNode>,
  startId: string,
  goalId: string
): RouteResult | null {
  const startNode = graph.get(startId);
  const goalNode = graph.get(goalId);
  if (!startNode || !goalNode) return null;

  const openSet = new Set<string>([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startId, 0);
  fScore.set(startId, heuristic(startNode.point, goalNode.point));

  while (openSet.size > 0) {
    // Find node with lowest fScore in openSet
    let current: string | null = null;
    let currentF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = id;
      }
    }

    if (!current) break;
    if (current === goalId) {
      return reconstructPath(graph, cameFrom, current);
    }

    openSet.delete(current);
    const currentNode = graph.get(current)!;

    for (const edge of currentNode.edges) {
      const tentG = (gScore.get(current) ?? Infinity) + edge.weight;
      const prevG = gScore.get(edge.to) ?? Infinity;

      if (tentG < prevG) {
        cameFrom.set(edge.to, current);
        gScore.set(edge.to, tentG);
        const neighbor = graph.get(edge.to);
        if (neighbor) {
          fScore.set(edge.to, tentG + heuristic(neighbor.point, goalNode.point));
        }
        openSet.add(edge.to);
      }
    }
  }

  return null; // No path found
}

function reconstructPath(
  graph: Map<string, GraphNode>,
  cameFrom: Map<string, string>,
  current: string
): RouteResult {
  const path: string[] = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }

  const points = path.map(id => graph.get(id)!.point);
  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistance += heuristic(points[i - 1], points[i]);
  }

  // Generate turn-by-turn instructions
  const instructions: TurnInstruction[] = [];

  if (points.length >= 2) {
    // Start instruction
    instructions.push({
      point: points[0],
      direction: 'straight',
      distanceToNext: heuristic(points[0], points[1]),
      text: 'Iniciar ruta',
    });

    // Mid-point instructions
    for (let i = 1; i < points.length - 1; i++) {
      const prevAngle = getAngle(points[i - 1], points[i]);
      const nextAngle = getAngle(points[i], points[i + 1]);
      const turn = getTurnDirection(prevAngle, nextAngle);
      const distNext = heuristic(points[i], points[i + 1]);

      if (turn !== 'straight') {
        instructions.push({
          point: points[i],
          direction: turn,
          distanceToNext: distNext,
          text: getTurnText(turn, distNext),
        });
      }
    }

    // Arrival
    instructions.push({
      point: points[points.length - 1],
      direction: 'arrive',
      distanceToNext: 0,
      text: getTurnText('arrive', 0),
    });
  }

  return { path, points, totalDistance, instructions };
}
