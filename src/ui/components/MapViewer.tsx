import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../data/store';
import { parseSVGMap } from '../../map/parser';
import { buildGraph, connectPointToGraph, cloneGraph } from '../../routing/graph';
import { astar } from '../../routing/astar';
import { computeHouseAnchor, housesPerBlock } from '../../houseNumbering';
import { DebugOverlay } from './DebugOverlay';
import { RouteOverlay } from './RouteOverlay';
import { PinOverlay } from './PinOverlay';

const MAP_W = 573.2;
const MAP_H = 704.1;

/** Extract inner SVG content (everything between the root <svg> and </svg> tags) */
function extractSvgInner(svgText: string): string {
  const cleaned = svgText.replace(/ns0:/g, '').replace(/xmlns:ns0/g, 'xmlns');
  const match = cleaned.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match ? match[1] : cleaned;
}

/** Convert client coordinates to SVG viewBox coordinates using getScreenCTM */
function clientToSVG(svgEl: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return null;
  const inv = ctm.inverse();
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const svgPt = pt.matrixTransform(inv);
  return { x: svgPt.x, y: svgPt.y };
}

export function MapViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ViewBox-based pan/zoom (no CSS transforms -> no rasterization)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const [isPanning, setIsPanning] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const lastTouchesRef = useRef<Touch[]>([]);

  const {
    svgContent, setSvgContent, setMapData, setGraph,
    mapData, graph, route, debugMode, destinationPoint,
    originPoint, animationProgress, isNavigating,
    setRoute, setOriginPoint, setDestinationPoint,
    setIsNavigating, setAnimationProgress,
    origin, originBlock, originHouse,
    destinationBlock, destinationHouse, destinationCommerce,
    commerces, mapLoaded, setRouteError,
    clickMode, setClickMode, setMapClickOrigin, setMapClickDest,
    setOrigin, mapClickOrigin, mapClickDest,
  } = useStore();

  // Load SVG on mount
  useEffect(() => {
    fetch('/mapa.svg')
      .then(r => r.text())
      .then(text => {
        setSvgContent(text);
        const data = parseSVGMap(text);
        setMapData(data);
        const g = buildGraph(data);
        setGraph(g);
      });
  }, [setSvgContent, setMapData, setGraph]);

  // Compute origin point when origin changes
  useEffect(() => {
    if (!mapData) return;
    const ap = mapData.accessPoints;
    switch (origin) {
      case 'marquez':
        setOriginPoint(ap.find(a => a.type === 'main')?.position ?? null);
        break;
      case 'florida':
        setOriginPoint(ap.find(a => a.type === 'secondary')?.position ?? null);
        break;
      case 'gps':
        break;
      case 'block_house': {
        if (originBlock) {
          const block = mapData.blocks.get(originBlock);
          if (block && originHouse) {
            const anchor = computeHouseAnchor(block, originHouse, housesPerBlock[originBlock]);
            if (anchor) {
              setOriginPoint(anchor.point);
              return;
            }
          }
          if (block) {
            setOriginPoint(block.center);
            return;
          }
        }
        break;
      }
      case 'map_click':
        if (mapClickOrigin) {
          setOriginPoint(mapClickOrigin);
        }
        break;
    }
  }, [origin, mapData, originBlock, originHouse, mapClickOrigin, setOriginPoint]);

  // Compute destination point when destination changes
  useEffect(() => {
    if (!mapData) return;

    // Map click destination overrides block/commerce
    if (mapClickDest) {
      setDestinationPoint(mapClickDest);
      return;
    }

    if (destinationCommerce) {
      const commerce = commerces.find(c => c.id === destinationCommerce);
      if (commerce?.coordinate) {
        setDestinationPoint(commerce.coordinate);
        return;
      }
      if (commerce) {
        const block = mapData.blocks.get(commerce.blockId);
        if (block && commerce.houseNumber) {
          const anchor = computeHouseAnchor(block, commerce.houseNumber);
          if (anchor) {
            setDestinationPoint(anchor.point);
            return;
          }
        }
        if (block) {
          setDestinationPoint(block.center);
          return;
        }
      }
    }

    if (destinationBlock) {
      const block = mapData.blocks.get(destinationBlock);
      if (block && destinationHouse) {
        const anchor = computeHouseAnchor(block, destinationHouse, housesPerBlock[destinationBlock]);
        if (anchor) {
          setDestinationPoint(anchor.point);
          return;
        }
      }
      if (block) {
        setDestinationPoint(block.center);
        return;
      }
    }

    setDestinationPoint(null);
  }, [destinationBlock, destinationHouse, destinationCommerce, mapData, commerces, mapClickDest, setDestinationPoint]);

  // Compute route when origin and destination are set.
  // CRITICAL: clone the graph and add connector edges for origin/destination
  // so that points outside the street grid can reach it.
  useEffect(() => {
    if (!graph || !originPoint || !destinationPoint) {
      setRoute(null);
      setRouteError(null);
      return;
    }

    // Deep clone graph so we don't pollute the base graph
    const workGraph = cloneGraph(graph);

    // Connect origin to the street network
    const originId = '__origin__';
    const originOk = connectPointToGraph(workGraph, originPoint, originId);

    // Connect destination to the street network
    const destId = '__dest__';
    const destOk = connectPointToGraph(workGraph, destinationPoint, destId);

    if (!originOk || !destOk) {
      setRoute(null);
      setRouteError('No se encontraron nodos cercanos al origen o destino.');
      return;
    }

    const result = astar(workGraph, originId, destId);
    if (result) {
      setRoute(result);
      setRouteError(null);
    } else {
      setRoute(null);
      setRouteError('No hay ruta posible entre el origen y el destino.');
    }
  }, [graph, originPoint, destinationPoint, setRoute, setRouteError]);

  // Animation loop
  useEffect(() => {
    if (!isNavigating || !route) return;

    let animId: number;
    const speed = 0.003;
    let progress = 0;

    const animate = () => {
      progress += speed;
      if (progress >= 1) {
        setAnimationProgress(1);
        setIsNavigating(false);
        return;
      }
      setAnimationProgress(progress);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isNavigating, route, setAnimationProgress, setIsNavigating]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dx = (e.clientX - lastMouseRef.current.x) / rect.width * viewBox.w;
    const dy = (e.clientY - lastMouseRef.current.y) / rect.height * viewBox.h;
    setViewBox(vb => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [isPanning, viewBox]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    setIsPanning(false);

    // Detect click (not drag) for map click mode
    const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
    if (dx < 4 && dy < 4 && clickMode && svgRef.current) {
      const svgPt = clientToSVG(svgRef.current, e.clientX, e.clientY);
      if (svgPt) {
        if (clickMode === 'origin') {
          setMapClickOrigin(svgPt);
          setOrigin('map_click');
        } else {
          setMapClickDest(svgPt);
        }
        setClickMode(null);
      }
    }
  }, [clickMode, setMapClickOrigin, setMapClickDest, setOrigin, setClickMode]);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Register wheel and touch handlers with { passive: false } to allow preventDefault.
  // This fixes: "Unable to preventDefault inside passive event listener"
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      setViewBox(vb => {
        const newW = Math.max(50, Math.min(MAP_W * 3, vb.w * factor));
        const newH = Math.max(50, Math.min(MAP_H * 3, vb.h * factor));
        const newX = vb.x + mx * (vb.w - newW);
        const newY = vb.y + my * (vb.h - newH);
        return { x: newX, y: newY, w: newW, h: newH };
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      lastTouchesRef.current = Array.from(e.touches);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touches = Array.from(e.touches);
      const prevTouches = lastTouchesRef.current;
      const rect = container.getBoundingClientRect();

      if (touches.length === 1 && prevTouches.length === 1) {
        const tdx = (touches[0].clientX - prevTouches[0].clientX) / rect.width * viewBoxRef.current.w;
        const tdy = (touches[0].clientY - prevTouches[0].clientY) / rect.height * viewBoxRef.current.h;
        setViewBox(vb => ({ ...vb, x: vb.x - tdx, y: vb.y - tdy }));
      } else if (touches.length === 2 && prevTouches.length === 2) {
        const prevDist = Math.sqrt(
          (prevTouches[0].clientX - prevTouches[1].clientX) ** 2 +
          (prevTouches[0].clientY - prevTouches[1].clientY) ** 2
        );
        const currDist = Math.sqrt(
          (touches[0].clientX - touches[1].clientX) ** 2 +
          (touches[0].clientY - touches[1].clientY) ** 2
        );

        const zFactor = prevDist / currDist;
        const midX = ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) / rect.width;
        const midY = ((touches[0].clientY + touches[1].clientY) / 2 - rect.top) / rect.height;

        setViewBox(vb => {
          const newW = Math.max(50, Math.min(MAP_W * 3, vb.w * zFactor));
          const newH = Math.max(50, Math.min(MAP_H * 3, vb.h * zFactor));
          const newX = vb.x + midX * (vb.w - newW);
          const newY = vb.y + midY * (vb.h - newH);
          return { x: newX, y: newY, w: newW, h: newH };
        });
      }

      lastTouchesRef.current = touches;
    };

    const handleTouchEnd = () => {
      lastTouchesRef.current = [];
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Extract inner SVG content (strip outer <svg> tag)
  const svgInner = svgContent ? extractSvgInner(svgContent) : '';

  if (!mapLoaded) {
    return (
      <div className="map-loading">
        <div className="spinner" />
        <p>Cargando mapa del barrio...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`map-container${clickMode ? ' click-mode' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Click mode indicator */}
      {clickMode && (
        <div className="click-mode-banner">
          Haz click en el mapa para seleccionar {clickMode === 'origin' ? 'el origen' : 'el destino'}
          <button className="btn-small" onClick={() => setClickMode(null)}>Cancelar</button>
        </div>
      )}

      {/* Single inline SVG -- stays vector at all zoom levels */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Base map (inner content of mapa.svg) */}
        <g dangerouslySetInnerHTML={{ __html: svgInner }} />

        {/* Overlays in same SVG coordinate space */}
        {debugMode && graph && mapData && (
          <DebugOverlay graph={graph} mapData={mapData} />
        )}

        {route && (
          <RouteOverlay
            route={route}
            animationProgress={animationProgress}
          />
        )}

        {originPoint && (
          <PinOverlay point={originPoint} color="#16a34a" label="A" />
        )}

        {destinationPoint && (
          <PinOverlay point={destinationPoint} color="#dc2626" label="B" />
        )}
      </svg>

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button onClick={() => setViewBox(vb => {
          const nw = vb.w / 1.3, nh = vb.h / 1.3;
          return { x: vb.x + (vb.w - nw) / 2, y: vb.y + (vb.h - nh) / 2, w: nw, h: nh };
        })}>+</button>
        <button onClick={() => setViewBox(vb => {
          const nw = Math.min(MAP_W * 3, vb.w * 1.3), nh = Math.min(MAP_H * 3, vb.h * 1.3);
          return { x: vb.x - (nw - vb.w) / 2, y: vb.y - (nh - vb.h) / 2, w: nw, h: nh };
        })}>-</button>
        <button onClick={() => setViewBox({ x: 0, y: 0, w: MAP_W, h: MAP_H })}>Fit</button>
      </div>
    </div>
  );
}
