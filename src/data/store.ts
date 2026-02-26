import { create } from 'zustand';
import type { MapData, Point } from '../map/types';
import type { GraphNode } from '../routing/graph';
import type { RouteResult } from '../routing/astar';
import type { Commerce } from './types';
import type { BlockOverride } from '../houseNumbering';
import { mockCommerces } from './mockCommerces';

export type OriginType = 'marquez' | 'florida' | 'gps';

export interface AppState {
  // Map data
  mapData: MapData | null;
  graph: Map<string, GraphNode> | null;
  svgContent: string | null;
  mapLoaded: boolean;

  // Navigation
  origin: OriginType;
  originPoint: Point | null;
  destinationBlock: string;
  destinationHouse: number | null;
  destinationCommerce: string | null;
  destinationPoint: Point | null;
  route: RouteResult | null;
  routeError: string | null;
  isNavigating: boolean;
  animationProgress: number;

  // GPS
  userPosition: Point | null;
  isInsidePerimeter: boolean;

  // Commerce
  commerces: Commerce[];
  selectedCommerce: Commerce | null;
  searchQuery: string;
  categoryFilter: string | null;

  // Admin
  blockOverrides: Map<string, BlockOverride>;
  isAdminOpen: boolean;

  // UI
  debugMode: boolean;
  activePanel: 'nav' | 'commerce' | 'admin' | null;

  // Actions
  setMapData: (data: MapData) => void;
  setGraph: (graph: Map<string, GraphNode>) => void;
  setSvgContent: (svg: string) => void;
  setOrigin: (origin: OriginType) => void;
  setOriginPoint: (point: Point | null) => void;
  setDestination: (blockId: string, houseNumber: number | null) => void;
  setDestinationCommerce: (commerceId: string | null) => void;
  setDestinationPoint: (point: Point | null) => void;
  setRoute: (route: RouteResult | null) => void;
  setRouteError: (error: string | null) => void;
  setIsNavigating: (val: boolean) => void;
  setAnimationProgress: (val: number) => void;
  setUserPosition: (pos: Point | null) => void;
  setIsInsidePerimeter: (val: boolean) => void;
  addCommerce: (commerce: Commerce) => void;
  updateCommerce: (id: string, data: Partial<Commerce>) => void;
  deleteCommerce: (id: string) => void;
  setSelectedCommerce: (commerce: Commerce | null) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (cat: string | null) => void;
  setBlockOverride: (blockId: string, override: BlockOverride) => void;
  setIsAdminOpen: (val: boolean) => void;
  setDebugMode: (val: boolean) => void;
  setActivePanel: (panel: 'nav' | 'commerce' | 'admin' | null) => void;
  resetRoute: () => void;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  mapData: null,
  graph: null,
  svgContent: null,
  mapLoaded: false,
  origin: 'marquez',
  originPoint: null,
  destinationBlock: '',
  destinationHouse: null,
  destinationCommerce: null,
  destinationPoint: null,
  route: null,
  routeError: null,
  isNavigating: false,
  animationProgress: 0,
  userPosition: null,
  isInsidePerimeter: false,
  commerces: mockCommerces,
  selectedCommerce: null,
  searchQuery: '',
  categoryFilter: null,
  blockOverrides: new Map(),
  isAdminOpen: false,
  debugMode: false,
  activePanel: 'nav',

  // Actions
  setMapData: (data) => set({ mapData: data, mapLoaded: true }),
  setGraph: (graph) => set({ graph }),
  setSvgContent: (svg) => set({ svgContent: svg }),
  setOrigin: (origin) => set({ origin }),
  setOriginPoint: (point) => set({ originPoint: point }),
  setDestination: (blockId, houseNumber) => set({
    destinationBlock: blockId,
    destinationHouse: houseNumber,
    destinationCommerce: null,
  }),
  setDestinationCommerce: (commerceId) => set({ destinationCommerce: commerceId }),
  setDestinationPoint: (point) => set({ destinationPoint: point }),
  setRoute: (route) => set({ route }),
  setRouteError: (error) => set({ routeError: error }),
  setIsNavigating: (val) => set({ isNavigating: val, animationProgress: 0 }),
  setAnimationProgress: (val) => set({ animationProgress: val }),
  setUserPosition: (pos) => set({ userPosition: pos }),
  setIsInsidePerimeter: (val) => set({ isInsidePerimeter: val }),
  addCommerce: (commerce) => set((s) => ({ commerces: [...s.commerces, commerce] })),
  updateCommerce: (id, data) => set((s) => ({
    commerces: s.commerces.map(c => c.id === id ? { ...c, ...data } : c),
  })),
  deleteCommerce: (id) => set((s) => ({
    commerces: s.commerces.filter(c => c.id !== id),
  })),
  setSelectedCommerce: (commerce) => set({ selectedCommerce: commerce }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCategoryFilter: (cat) => set({ categoryFilter: cat }),
  setBlockOverride: (blockId, override) => set((s) => {
    const newMap = new Map(s.blockOverrides);
    newMap.set(blockId, { ...newMap.get(blockId), ...override });
    return { blockOverrides: newMap };
  }),
  setIsAdminOpen: (val) => set({ isAdminOpen: val }),
  setDebugMode: (val) => set({ debugMode: val }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  resetRoute: () => set({
    destinationBlock: '',
    destinationHouse: null,
    destinationCommerce: null,
    destinationPoint: null,
    route: null,
    routeError: null,
    isNavigating: false,
    animationProgress: 0,
  }),
}));
