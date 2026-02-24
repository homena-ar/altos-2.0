import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../data/store';
import { parseSVGMap } from '../../map/parser';
import { buildGraph, findNearestNode } from '../../routing/graph';
import { astar } from '../../routing/astar';
import { computeHouseAnchor, housesPerBlock } from '../../houseNumbering';
import { DebugOverlay } from './DebugOverlay';
import { RouteOverlay } from './RouteOverlay';
import { PinOverlay } from './PinOverlay';

export function MapViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  const {
    svgContent, setSvgContent, setMapData, setGraph,
    mapData, graph, route, debugMode, destinationPoint,
    originPoint, animationProgress, isNavigating,
    setRoute, setOriginPoint, setDestinationPoint,
    setIsNavigating, setAnimationProgress,
    origin, destinationBlock, destinationHouse, destinationCommerce,
    commerces, mapLoaded,
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
        // GPS position handled externally
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
      return;
    }

    const startNode = findNearestNode(originPoint, graph);
    const endNode = findNearestNode(destinationPoint, graph);

    if (!startNode || !endNode) {
      setRoute(null);
      return;
    }

    const result = astar(graph, startNode, endNode);
    setRoute(result);
  }, [graph, originPoint, destinationPoint, setRoute]);

  // Animation loop
  useEffect(() => {
    if (!isNavigating || !route) return;

    let animId: number;
    const speed = 0.003; // progress per frame
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
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastMouse]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(10, transform.scale * delta));

    // Zoom toward mouse position
    const scaleRatio = newScale / transform.scale;
    const newX = mouseX - (mouseX - transform.x) * scaleRatio;
    const newY = mouseY - (mouseY - transform.y) * scaleRatio;

    setTransform({ x: newX, y: newY, scale: newScale });
  }, [transform]);

  // Touch handlers for mobile
  const [lastTouches, setLastTouches] = useState<React.Touch[]>([]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches);
    setLastTouches(touches);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches);

    if (touches.length === 1 && lastTouches.length === 1) {
      // Pan
      const dx = touches[0].clientX - lastTouches[0].clientX;
      const dy = touches[0].clientY - lastTouches[0].clientY;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (touches.length === 2 && lastTouches.length === 2) {
      // Pinch zoom
      const prevDist = Math.sqrt(
        (lastTouches[0].clientX - lastTouches[1].clientX) ** 2 +
        (lastTouches[0].clientY - lastTouches[1].clientY) ** 2
      );
      const currDist = Math.sqrt(
        (touches[0].clientX - touches[1].clientX) ** 2 +
        (touches[0].clientY - touches[1].clientY) ** 2
      );

      const delta = currDist / prevDist;
      const newScale = Math.max(0.3, Math.min(10, transform.scale * delta));

      const midX = (touches[0].clientX + touches[1].clientX) / 2;
      const midY = (touches[0].clientY + touches[1].clientY) / 2;

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const px = midX - rect.left;
        const py = midY - rect.top;
        const scaleRatio = newScale / transform.scale;
        const newX = px - (px - transform.x) * scaleRatio;
        const newY = py - (py - transform.y) * scaleRatio;
        setTransform({ x: newX, y: newY, scale: newScale });
      }
    }

    setLastTouches(touches);
  }, [lastTouches, transform]);

  // Process SVG for display (fix ns0: prefix)
  const displaySvg = svgContent
    ? svgContent
        .replace(/ns0:/g, '')
        .replace(/xmlns:ns0/g, 'xmlns')
    : '';

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
      <div
        ref={svgRef}
        className="map-svg-wrapper"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        <div
          className="map-svg"
          dangerouslySetInnerHTML={{ __html: displaySvg }}
        />

        {/* Overlays rendered on top of SVG */}
        <svg
          className="map-overlay-svg"
          viewBox={mapData ? `0 0 ${mapData.viewBox.width} ${mapData.viewBox.height}` : '0 0 573.2 704.1'}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
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
      </div>

      {/* Zoom controls */}
      <div className="zoom-controls">
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(10, t.scale * 1.3) }))}>+</button>
        <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.3, t.scale / 1.3) }))}>-</button>
        <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>Fit</button>
      </div>
    </div>
  );
}
