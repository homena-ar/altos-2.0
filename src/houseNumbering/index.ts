import type { Point, Block } from '../map/types';

export type Corner = 'NW' | 'NE' | 'SE' | 'SW';

export interface HouseAnchorResult {
  point: Point;
  side: 1 | 2;
  indexOnSide: number;
}

export interface BlockOverride {
  startCorner?: Corner;
  direction?: 'cw' | 'ccw';
  manualPositions?: Record<number, Point>;
}

export const housesPerBlock: Record<string, number> = {
  "3": 32, "4": 26, "5": 32, "6": 26, "7": 32, "8": 32, "9": 32, "10": 32,
  "11": 32, "12": 32, "13": 32, "14": 32,
  "15": 20, "16": 20, "17": 20, "18": 20, "19": 20, "20": 20,
  "23": 32, "24": 32, "25": 28, "26": 28, "27": 24, "28": 20, "29": 18,
  "30": 32, "31": 32, "32": 32, "33": 32, "34": 32, "35": 32, "36": 32,
  "37": 32, "38": 32, "39": 32, "40": 32, "41": 32, "42": 32, "43": 32,
  "44": 32, "45": 32, "46": 32, "47": 32, "48": 32, "49": 32,
  "50": 26, "51": 26, "52": 32, "53": 32, "54": 32, "55": 32, "56": 32,
  "57": 32, "58": 22, "59": 48, "60": 41, "61": 18, "62": 32, "63": 32,
  "64": 32, "65": 26, "66": 26, "67": 26, "70": 26,
  "75": 32, "78": 32, "79": 32, "80": 32, "81": 32, "82": 32, "83": 32,
  "84": 32, "85": 32, "86": 32, "87": 32, "88": 32, "89": 32, "90": 32,
  "91": 32, "92": 32, "93": 32, "94": 32, "95": 32, "96": 32, "97": 32,
  "99": 32,
};

const blockOverrides = new Map<string, BlockOverride>();

export function setBlockOverride(blockId: string, override: BlockOverride): void {
  blockOverrides.set(blockId, { ...blockOverrides.get(blockId), ...override });
}

export function getBlockOverride(blockId: string): BlockOverride | undefined {
  return blockOverrides.get(blockId);
}

export function getAllOverrides(): Map<string, BlockOverride> {
  return new Map(blockOverrides);
}

export function clearOverride(blockId: string): void {
  blockOverrides.delete(blockId);
}

function isHorizontalBlock(block: Block): boolean {
  return block.rect.width > block.rect.height;
}

function getCorners(block: Block): Record<Corner, Point> {
  const { x, y, width, height } = block.rect;
  return {
    NW: { x, y },
    NE: { x: x + width, y },
    SE: { x: x + width, y: y + height },
    SW: { x, y: y + height },
  };
}

function getDefaultStartCorner(block: Block): Corner {
  const corners = getCorners(block);
  const sc = block.startCorner;
  let bestCorner: Corner = 'NW';
  let bestDist = Infinity;
  for (const [c, pt] of Object.entries(corners) as [Corner, Point][]) {
    const d = Math.sqrt((sc.x - pt.x) ** 2 + (sc.y - pt.y) ** 2);
    if (d < bestDist) {
      bestDist = d;
      bestCorner = c;
    }
  }
  return bestCorner;
}

/**
 * Side A (1..N1): advances along first long side from start corner.
 * Side B (N1+1..N): opposite long side, REVERSED so B[0] is across from A[N1-1].
 *   house N1+1 is adjacent to house N1 ("pega la vuelta").
 *
 * Example N=30, start NW, horizontal:
 *   A: 1..15 go NW -> NE (top, left to right)
 *   B: 16..30 go SE -> SW (bottom, right to left)
 *   house 16 is below house 15.
 */
export function computeHouseAnchor(
  block: Block,
  houseNumber: number,
  totalHouses?: number,
  streetOffset: number = 4
): HouseAnchorResult | null {
  const N = totalHouses ?? housesPerBlock[block.id];
  if (!N || houseNumber < 1 || houseNumber > N) return null;

  const override = blockOverrides.get(block.id);
  if (override?.manualPositions?.[houseNumber]) {
    return {
      point: override.manualPositions[houseNumber],
      side: houseNumber <= Math.ceil(N / 2) ? 1 : 2,
      indexOnSide: houseNumber <= Math.ceil(N / 2)
        ? houseNumber - 1
        : houseNumber - Math.ceil(N / 2) - 1,
    };
  }

  const N1 = Math.ceil(N / 2);
  const N2 = Math.floor(N / 2);
  const horizontal = isHorizontalBlock(block);
  const corners = getCorners(block);
  const startCorner = override?.startCorner ?? getDefaultStartCorner(block);

  // Side A: start -> end along first long side
  // Side B: REVERSED opposite side (B[0] behind A[N1-1])
  let sideAStart: Point, sideAEnd: Point;
  let sideBStart: Point, sideBEnd: Point;

  if (horizontal) {
    switch (startCorner) {
      case 'NW':
        sideAStart = corners.NW; sideAEnd = corners.NE;
        sideBStart = corners.SE; sideBEnd = corners.SW; // reversed!
        break;
      case 'NE':
        sideAStart = corners.NE; sideAEnd = corners.NW;
        sideBStart = corners.SW; sideBEnd = corners.SE;
        break;
      case 'SE':
        sideAStart = corners.SE; sideAEnd = corners.SW;
        sideBStart = corners.NW; sideBEnd = corners.NE;
        break;
      case 'SW':
        sideAStart = corners.SW; sideAEnd = corners.SE;
        sideBStart = corners.NE; sideBEnd = corners.NW;
        break;
    }
  } else {
    switch (startCorner) {
      case 'NW':
        sideAStart = corners.NW; sideAEnd = corners.SW;
        sideBStart = corners.SE; sideBEnd = corners.NE;
        break;
      case 'NE':
        sideAStart = corners.NE; sideAEnd = corners.SE;
        sideBStart = corners.SW; sideBEnd = corners.NW;
        break;
      case 'SE':
        sideAStart = corners.SE; sideAEnd = corners.NE;
        sideBStart = corners.NW; sideBEnd = corners.SW;
        break;
      case 'SW':
        sideAStart = corners.SW; sideAEnd = corners.NW;
        sideBStart = corners.NE; sideBEnd = corners.SE;
        break;
    }
  }

  let point: Point;
  let side: 1 | 2;
  let indexOnSide: number;

  if (houseNumber <= N1) {
    side = 1;
    indexOnSide = houseNumber - 1;
    const t = N1 > 1 ? indexOnSide / (N1 - 1) : 0.5;
    const baseX = sideAStart!.x + (sideAEnd!.x - sideAStart!.x) * t;
    const baseY = sideAStart!.y + (sideAEnd!.y - sideAStart!.y) * t;
    const cx = block.center.x, cy = block.center.y;
    const dx = baseX - cx, dy = baseY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    point = {
      x: baseX + (len > 0 ? (dx / len) * streetOffset : 0),
      y: baseY + (len > 0 ? (dy / len) * streetOffset : 0),
    };
  } else {
    side = 2;
    indexOnSide = houseNumber - N1 - 1;
    const t = N2 > 1 ? indexOnSide / (N2 - 1) : 0.5;
    const baseX = sideBStart!.x + (sideBEnd!.x - sideBStart!.x) * t;
    const baseY = sideBStart!.y + (sideBEnd!.y - sideBStart!.y) * t;
    const cx = block.center.x, cy = block.center.y;
    const dx = baseX - cx, dy = baseY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    point = {
      x: baseX + (len > 0 ? (dx / len) * streetOffset : 0),
      y: baseY + (len > 0 ? (dy / len) * streetOffset : 0),
    };
  }

  return { point, side, indexOnSide };
}

export function isValidHouse(blockId: string, houseNumber: number): boolean {
  const n = housesPerBlock[blockId];
  if (!n) return false;
  return houseNumber >= 1 && houseNumber <= n;
}

export function getHouseCount(blockId: string): number {
  return housesPerBlock[blockId] || 0;
}
