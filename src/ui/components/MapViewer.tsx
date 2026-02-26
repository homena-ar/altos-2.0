import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../data/store';
import { parseSVGMap } from '../../map/parser';
import { buildGraph, findNearestNode } from '../../routing/graph';
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

export function MapViewer() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ViewBox-based pan/zoom (no CSS transforms → no rasterization)
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const {
    svgContent, setSvgContent, setMapData, setGraph,
    mapData, graph, route, debugMode, destinationPoint,
    originPoint, animationProgress, isNavigating,
    setRoute, setOriginPoint, setDestinationPoint,
    setIsNavigating, setAnimationProgress,
    origin, destinationBlock, destinationHouse, destinationCommerce,
    commerces, mapLoaded, setRouteError,
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
    }
  }, [origin, mapData, setOriginPoint]);

  // Compute destination point when destination changes
  useEffect(() => {
    if (!mapData) return;

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
  }, [destinationBlock, destinationHouse, destinationCommerce, mapData, commerces, setDestinationPoint]);

  // Compute route when origin and destination are set
  useEffect(() => {
    if (!graph || !originPoint || !destinationPoint) {
      setRoute(null);
      setRouteError(null);
      return;
    }

    const startNode = findNearestNode(originPoint, graph);
    const endNode = findNearestNode(destinationPoint, graph);

    if (!startNode || !endNode) {
      setRoute(null);
      setRouteError('No se encontraron nodos cercanos al origen o destino.');
      return;
    }

    const result = astar(graph, startNode, endNode);
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
    setLastMouse({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dx = (e.clientX - lastMouse.x) / rect.width * viewBox.w;
    const dy = (e.clientY - lastMouse.y) / rect.height * viewBox.h;
    setViewBox(vb => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastMouse, viewBox]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handler (viewBox based - stays vector at all zoom levels)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

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
  }, []);

  // Touch handlers for mobile
  const [lastTouches, setLastTouches] = useState<React.Touch[]>([]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setLastTouches(Array.from(e.touches));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (touches.length === 1 && lastTouches.length === 1) {
      const dx = (touches[0].clientX - lastTouches[0].clientX) / rect.width * viewBox.w;
      const dy = (touches[0].clientY - lastTouches[0].clientY) / rect.height * viewBox.h;
      setViewBox(vb => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    } else if (touches.length === 2 && lastTouches.length === 2) {
      const prevDist = Math.sqrt(
        (lastTouches[0].clientX - lastTouches[1].clientX) ** 2 +
        (lastTouches[0].clientY - lastTouches[1].clientY) ** 2
      );
      const currDist = Math.sqrt(
        (touches[0].clientX - touches[1].clientX) ** 2 +
        (touches[0].clientY - touches[1].clientY) ** 2
      );

      const factor = prevDist / currDist;
      const midX = ((touches[0].clientX + touches[1].clientX) / 2 - rect.left) / rect.width;
      const midY = ((touches[0].clientY + touches[1].clientY) / 2 - rect.top) / rect.height;

      setViewBox(vb => {
        const newW = Math.max(50, Math.min(MAP_W * 3, vb.w * factor));
        const newH = Math.max(50, Math.min(MAP_H * 3, vb.h * factor));
        const newX = vb.x + midX * (vb.w - newW);
        const newY = vb.y + midY * (vb.h - newH);
        return { x: newX, y: newY, w: newW, h: newH };
      });
    }

    setLastTouches(touches);
  }, [lastTouches, viewBox]);

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
      className="map-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setLastTouches([])}
    >
      {/* Single inline SVG — stays vector at all zoom levels */}
      <svg
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
          <PinOverlay point={originPoint} color="#22c55e" label="A" />
        )}

        {destinationPoint && (
          <PinOverlay point={destinationPoint} color="#ef4444" label="B" />
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
