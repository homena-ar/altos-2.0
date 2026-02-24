import type { Block, StreetSegment, OneWayLane, Landmark, AccessPoint, MapData, Point } from './types';

function parsePathD(d: string): { start: Point; end: Point } | null {
  // Handle M x,y h len (horizontal line)
  const hMatch = d.match(/M([\d.]+),([\d.]+)\s*h([\d.-]+)/);
  if (hMatch) {
    const x = parseFloat(hMatch[1]);
    const y = parseFloat(hMatch[2]);
    const len = parseFloat(hMatch[3]);
    return { start: { x, y }, end: { x: x + len, y } };
  }

  // Handle M x,y v len (vertical line)
  const vMatch = d.match(/M([\d.]+),([\d.]+)\s*v([\d.-]+)/);
  if (vMatch) {
    const x = parseFloat(vMatch[1]);
    const y = parseFloat(vMatch[2]);
    const len = parseFloat(vMatch[3]);
    return { start: { x, y }, end: { x, y: y + len } };
  }

  // Handle M x,y l dx,dy (diagonal line)
  const lMatch = d.match(/M([\d.]+),([\d.]+)\s*l([\d.-]+),([\d.-]+)/);
  if (lMatch) {
    const x = parseFloat(lMatch[1]);
    const y = parseFloat(lMatch[2]);
    const dx = parseFloat(lMatch[3]);
    const dy = parseFloat(lMatch[4]);
    return { start: { x, y }, end: { x: x + dx, y: y + dy } };
  }

  // Handle single point M x,y (marker)
  const mMatch = d.match(/M([\d.]+),([\d.]+)$/);
  if (mMatch) {
    const x = parseFloat(mMatch[1]);
    const y = parseFloat(mMatch[2]);
    return { start: { x, y }, end: { x, y } };
  }

  return null;
}

function getOrientation(start: Point, end: Point): 'h' | 'v' | 'd' {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dy < 1) return 'h';
  if (dx < 1) return 'v';
  return 'd';
}

export function parseSVGMap(svgText: string): MapData {
  const parser = new DOMParser();
  // Fix namespace issue - replace ns0: with standard SVG
  const cleanedSvg = svgText
    .replace(/ns0:/g, '')
    .replace(/xmlns:ns0/g, 'xmlns');
  const doc = parser.parseFromString(cleanedSvg, 'image/svg+xml');

  const blocks = new Map<string, Block>();
  const streets: StreetSegment[] = [];
  const oneWayLanes: OneWayLane[] = [];
  const landmarks: Landmark[] = [];
  const accessPoints: AccessPoint[] = [];

  // Parse viewBox
  const svgEl = doc.querySelector('svg');
  const vb = svgEl?.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 573.2, 704.1];

  // Parse blocks (groups with id="M##")
  const blockGroups = doc.querySelectorAll('g[id^="M"]');
  blockGroups.forEach(g => {
    const id = g.getAttribute('id');
    if (!id || !/^M\d+$/.test(id)) return;
    const blockNum = id.replace('M', '');
    const rect = g.querySelector('rect');
    if (!rect) return;

    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');

    blocks.set(blockNum, {
      id: blockNum,
      svgId: id,
      rect: { x, y, width: w, height: h },
      center: { x: x + w / 2, y: y + h / 2 },
      startCorner: { x: x, y: y }, // Will be overridden by start markers
      label: blockNum,
    });
  });

  // Parse start markers (circles with id="start_M##")
  const startCircles = doc.querySelectorAll('circle[id^="start_M"]');
  startCircles.forEach(circle => {
    const id = circle.getAttribute('id');
    if (!id) return;
    const blockNum = id.replace('start_M', '');
    const block = blocks.get(blockNum);
    if (block) {
      block.startCorner = {
        x: parseFloat(circle.getAttribute('cx') || '0'),
        y: parseFloat(circle.getAttribute('cy') || '0'),
      };
    }
  });

  // Parse street segments (paths with id="st_####")
  const streetPaths = doc.querySelectorAll('path[id^="st_"]');
  streetPaths.forEach(path => {
    const id = path.getAttribute('id') || '';
    const d = path.getAttribute('d') || '';
    if (id.startsWith('st_merge')) return; // These are traffic lanes
    const parsed = parsePathD(d);
    if (!parsed) return;
    // Skip zero-length paths
    if (parsed.start.x === parsed.end.x && parsed.start.y === parsed.end.y) return;

    streets.push({
      id,
      start: parsed.start,
      end: parsed.end,
      orientation: getOrientation(parsed.start, parsed.end),
    });
  });

  // Parse one-way lanes
  const lanePaths = doc.querySelectorAll('path[data-type="oneway"]');
  lanePaths.forEach(path => {
    const id = path.getAttribute('id') || '';
    const d = path.getAttribute('d') || '';
    const parsed = parsePathD(d);
    if (!parsed) return;

    oneWayLanes.push({
      id,
      laneId: path.getAttribute('data-lane-id') || '',
      start: parsed.start,
      end: parsed.end,
      orientation: (path.getAttribute('data-ori') as 'h' | 'v') || 'h',
      direction: path.getAttribute('data-vec') || '+x',
      color: (path.getAttribute('data-color') as 'green' | 'red') || 'green',
    });
  });

  // Parse landmarks
  const plazaBenitez = doc.getElementById('PLAZA_BENITEZ-2')?.querySelector('rect');
  if (plazaBenitez) {
    const x = parseFloat(plazaBenitez.getAttribute('x') || '0');
    const y = parseFloat(plazaBenitez.getAttribute('y') || '0');
    const w = parseFloat(plazaBenitez.getAttribute('width') || '0');
    const h = parseFloat(plazaBenitez.getAttribute('height') || '0');
    landmarks.push({
      id: 'PLAZA_BENITEZ', name: 'Plaza Miguel Benítez',
      center: { x: x + w / 2, y: y + h / 2 }, type: 'plaza',
    });
  }

  const plazaSec = doc.getElementById('PLAZA_SECUNDARIA')?.querySelector('rect');
  if (plazaSec) {
    const x = parseFloat(plazaSec.getAttribute('x') || '0');
    const y = parseFloat(plazaSec.getAttribute('y') || '0');
    const w = parseFloat(plazaSec.getAttribute('width') || '0');
    const h = parseFloat(plazaSec.getAttribute('height') || '0');
    landmarks.push({
      id: 'PLAZA_SECUNDARIA', name: 'Plaza Secundaria',
      center: { x: x + w / 2, y: y + h / 2 }, type: 'plaza',
    });
  }

  const capilla = doc.getElementById('Capilla')?.querySelector('rect');
  if (capilla) {
    const x = parseFloat(capilla.getAttribute('x') || '0');
    const y = parseFloat(capilla.getAttribute('y') || '0');
    const w = parseFloat(capilla.getAttribute('width') || '0');
    const h = parseFloat(capilla.getAttribute('height') || '0');
    landmarks.push({
      id: 'Capilla', name: 'Capilla',
      center: { x: x + w / 2, y: y + h / 2 }, type: 'chapel',
    });
  }

  // Access points
  // Acceso Principal (Av. Márquez) - bottom of map
  accessPoints.push({
    id: 'acceso_principal',
    name: 'Entrada Principal (Av. Márquez)',
    position: { x: 410, y: 637 },
    type: 'main',
  });

  // Acceso Florida - top of map
  accessPoints.push({
    id: 'acceso_florida',
    name: 'Entrada Secundaria (Florida)',
    position: { x: 470, y: 30 },
    type: 'secondary',
  });

  // Parse perimeter from PLANO polygon
  const plano = doc.getElementById('PLANO');
  const perimeter: Point[] = [];
  if (plano) {
    const points = plano.getAttribute('points');
    if (points) {
      const pairs = points.trim().split(/\s+/);
      pairs.forEach(pair => {
        const [x, y] = pair.split(',').map(Number);
        if (!isNaN(x) && !isNaN(y)) {
          perimeter.push({ x, y });
        }
      });
    }
  }

  return {
    viewBox: { width: vb[2], height: vb[3] },
    blocks,
    streets,
    oneWayLanes,
    landmarks,
    accessPoints,
    perimeter,
  };
}
