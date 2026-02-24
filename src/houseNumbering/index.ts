import type { Point, Block } from '../map/types';

export type Corner = 'NW' | 'NE' | 'SE' | 'SW';

export interface HouseAnchorResult {
  point: Point;
  side: 1 | 2;          // Which long side the house is on
  indexOnSide: number;   // 0-based index on that side
}

export interface BlockOverride {
  startCorner?: Corner;
  direction?: 'cw' | 'ccw';
  manualPositions?: Record<number, Point>;
}

// Houses per block from the spec
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

// Admin overrides storage
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

/**
 * Detect whether a block is "horizontal" (wider than tall) or "vertical" (taller than wide).
 */
function isHorizontalBlock(block: Block): boolean {
  return block.rect.width > block.rect.height;
}

/**
 * Get the four corners of a block's bounding box.
 */
function getCorners(block: Block): Record<Corner, Point> {
  const { x, y, width, height } = block.rect;
  return {
    NW: { x, y },
    NE: { x: x + width, y },
    SE: { x: x + width, y: y + height },
    SW: { x, y: y + height },
  };
}

/**
 * Determine the default start corner for a block.
 * Uses the start marker from the SVG if available, falling back to NW.
 */
function getDefaultStartCorner(block: Block): Corner {
  const corners = getCorners(block);
  const sc = block.startCorner;

  // Find which corner is closest to the start marker
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
 * Compute the anchor point for a house number within a block.
 *
 * Houses are distributed on the two long sides of the block:
 * - Side 1: ceil(N/2) houses (house 1..N1)
 * - Side 2: floor(N/2) houses (house N1+1..N)
 *
 * @param block The block data
 * @param houseNumber The house number (1-based)
 * @param totalHouses Total houses in this block
 * @param streetOffset Pixels to offset from block edge towards the street
 */
export function computeHouseAnchor(
  block: Block,
  houseNumber: number,
  totalHouses?: number,
  streetOffset: number = 4
): HouseAnchorResult | null {
  const N = totalHouses ?? housesPerBlock[block.id];
  if (!N || houseNumber < 1 || houseNumber > N) return null;

  // Check for manual override
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

  // Determine start corner
  const startCorner = override?.startCorner ?? getDefaultStartCorner(block);

  // Define long sides based on orientation and start corner
  let sideAStart: Point, sideAEnd: Point;
  let sideBStart: Point, sideBEnd: Point;

  if (horizontal) {
    // Long sides are top and bottom
    switch (startCorner) {
      case 'NW':
        sideAStart = corners.NW; sideAEnd = corners.NE;   // top left -> right
        sideBStart = corners.SW; sideBEnd = corners.SE;     // bottom left -> right (return)
        break;
      case 'NE':
        sideAStart = corners.NE; sideAEnd = corners.NW;   // top right -> left
        sideBStart = corners.SE; sideBEnd = corners.SW;
        break;
      case 'SE':
        sideAStart = corners.SE; sideAEnd = corners.SW;   // bottom right -> left
        sideBStart = corners.NE; sideBEnd = corners.NW;
        break;
      case 'SW':
        sideAStart = corners.SW; sideAEnd = corners.SE;   // bottom left -> right
        sideBStart = corners.NW; sideBEnd = corners.NE;
        break;
    }
  } else {
    // Vertical block: long sides are left and right
    switch (startCorner) {
      case 'NW':
        sideAStart = corners.NW; sideAEnd = corners.SW;   // left top -> bottom
        sideBStart = corners.NE; sideBEnd = corners.SE;
        break;
      case 'NE':
        sideAStart = corners.NE; sideAEnd = corners.SE;   // right top -> bottom
        sideBStart = corners.NW; sideBEnd = corners.SW;
        break;
      case 'SE':
        sideAStart = corners.SE; sideAEnd = corners.NE;   // right bottom -> top
        sideBStart = corners.SW; sideBEnd = corners.NW;
        break;
      case 'SW':
        sideAStart = corners.SW; sideAEnd = corners.NW;   // left bottom -> top
        sideBStart = corners.SE; sideBEnd = corners.NE;
        break;
    }
  }

  let point: Point;
  let side: 1 | 2;
  let indexOnSide: number;

  if (houseNumber <= N1) {
    // Side A
    side = 1;
    indexOnSide = houseNumber - 1;
    const t = N1 > 1 ? indexOnSide / (N1 - 1) : 0.5;
    const baseX = sideAStart!.x + (sideAEnd!.x - sideAStart!.x) * t;
    const baseY = sideAStart!.y + (sideAEnd!.y - sideAStart!.y) * t;

    // Offset towards street (away from block center)
    const cx = block.center.x;
    const cy = block.center.y;
    const dx = baseX - cx;
    const dy = baseY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    point = {
      x: baseX + (len > 0 ? (dx / len) * streetOffset : 0),
      y: baseY + (len > 0 ? (dy / len) * streetOffset : 0),
    };
  } else {
    // Side B
    side = 2;
    indexOnSide = houseNumber - N1 - 1;
    const t = N2 > 1 ? indexOnSide / (N2 - 1) : 0.5;
    const baseX = sideBStart!.x + (sideBEnd!.x - sideBStart!.x) * t;
    const baseY = sideBStart!.y + (sideBEnd!.y - sideBStart!.y) * t;

    const cx = block.center.x;
    const cy = block.center.y;
    const dx = baseX - cx;
    const dy = baseY - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    point = {
      x: baseX + (len > 0 ? (dx / len) * streetOffset : 0),
      y: baseY + (len > 0 ? (dy / len) * streetOffset : 0),
    };
  }

  return { point, side, indexOnSide };
}

/**
 * Validate that a house number is valid for a given block.
 */
export function isValidHouse(blockId: string, houseNumber: number): boolean {
  const n = housesPerBlock[blockId];
  if (!n) return false;
  return houseNumber >= 1 && houseNumber <= n;
}

/**
 * Get houses count for a block, or 0 if unknown.
 */
export function getHouseCount(blockId: string): number {
  return housesPerBlock[blockId] || 0;
}
