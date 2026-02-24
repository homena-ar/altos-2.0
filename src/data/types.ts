import type { Point } from '../map/types';

export interface Commerce {
  id: string;
  name: string;
  category: CommerceCategory;
  blockId: string;
  houseNumber?: number;
  coordinate?: Point;    // Direct coordinate override
  schedule: string;
  whatsapp: string;
  description: string;
  tags: string[];
}

export type CommerceCategory =
  | 'almacen'
  | 'kiosco'
  | 'farmacia'
  | 'peluqueria'
  | 'comida'
  | 'servicios'
  | 'salud'
  | 'educacion'
  | 'deportes'
  | 'otro';

export const CATEGORY_LABELS: Record<CommerceCategory, string> = {
  almacen: 'Almacén',
  kiosco: 'Kiosco',
  farmacia: 'Farmacia',
  peluqueria: 'Peluquería',
  comida: 'Comida',
  servicios: 'Servicios',
  salud: 'Salud',
  educacion: 'Educación',
  deportes: 'Deportes',
  otro: 'Otro',
};

export const CATEGORY_ICONS: Record<CommerceCategory, string> = {
  almacen: '\u{1F6D2}',
  kiosco: '\u{1F3EA}',
  farmacia: '\u{1F48A}',
  peluqueria: '\u{2702}',
  comida: '\u{1F354}',
  servicios: '\u{1F527}',
  salud: '\u{1FA7A}',
  educacion: '\u{1F4DA}',
  deportes: '\u{26BD}',
  otro: '\u{1F4CD}',
};
