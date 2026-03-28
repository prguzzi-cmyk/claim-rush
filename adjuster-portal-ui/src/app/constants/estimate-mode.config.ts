import { EstimateMode, EstimateModeConfig } from '../models/estimating.model';

export const ESTIMATE_MODE_MAP: Record<EstimateMode, EstimateModeConfig> = {
  residential: {
    label: 'Residential',
    description: 'Standard home / dwelling estimates',
    icon: 'home',
    room_types: [
      'kitchen', 'bathroom', 'bedroom', 'living_room', 'dining_room',
      'garage', 'basement', 'attic', 'hallway', 'exterior', 'other',
    ],
    line_item_categories: [
      'walls', 'ceiling', 'floor', 'trim', 'doors',
      'windows', 'cabinets', 'fixtures', 'misc_items',
    ],
    unit_options: ['SF', 'LF', 'SY', 'EA', 'HR', 'CF', 'GAL'],
  },
  commercial: {
    label: 'Commercial',
    description: 'Commercial property / building estimates',
    icon: 'business',
    room_types: [
      'kitchen', 'bathroom', 'bedroom', 'living_room', 'dining_room',
      'garage', 'basement', 'attic', 'hallway', 'exterior', 'other',
      'lobby', 'suite', 'office', 'common_area', 'mechanical',
      'elevator', 'stairwell', 'parking', 'roof', 'restroom',
    ],
    line_item_categories: [
      'walls', 'ceiling', 'floor', 'trim', 'doors',
      'windows', 'cabinets', 'fixtures', 'misc_items',
      'hvac', 'electrical', 'plumbing', 'fire_protection',
    ],
    unit_options: ['SF', 'LF', 'SY', 'EA', 'HR', 'CF', 'GAL', 'TON'],
  },
  restoration: {
    label: 'Restoration',
    description: 'Water / fire / mold restoration estimates',
    icon: 'build',
    room_types: [
      'kitchen', 'bathroom', 'bedroom', 'living_room', 'dining_room',
      'garage', 'basement', 'attic', 'hallway', 'exterior', 'other',
    ],
    line_item_categories: [
      'walls', 'ceiling', 'floor', 'trim', 'doors',
      'windows', 'cabinets', 'fixtures', 'misc_items',
      'extraction', 'drying_equipment', 'containment',
      'demo', 'antimicrobial', 'monitoring',
    ],
    unit_options: ['SF', 'LF', 'SY', 'EA', 'HR', 'CF', 'GAL', 'DAY'],
  },
  contents: {
    label: 'Contents',
    description: 'Personal property / contents-only estimates',
    icon: 'inventory_2',
    room_types: [
      'kitchen', 'bathroom', 'bedroom', 'living_room', 'dining_room',
      'garage', 'basement', 'attic', 'other',
    ],
    line_item_categories: [
      'furniture', 'electronics', 'clothing', 'appliances',
      'collectibles', 'documents', 'misc_items',
    ],
    unit_options: ['EA', 'SET', 'LOT'],
  },
  supplement: {
    label: 'Supplement',
    description: 'Supplement / additional scope estimates',
    icon: 'post_add',
    room_types: [
      'kitchen', 'bathroom', 'bedroom', 'living_room', 'dining_room',
      'garage', 'basement', 'attic', 'hallway', 'exterior', 'other',
    ],
    line_item_categories: [
      'walls', 'ceiling', 'floor', 'trim', 'doors',
      'windows', 'cabinets', 'fixtures', 'misc_items',
    ],
    unit_options: ['SF', 'LF', 'SY', 'EA', 'HR', 'CF', 'GAL'],
    default_view: 'blackout',
  },
};

export const ESTIMATE_MODES: { key: EstimateMode; config: EstimateModeConfig }[] = [
  { key: 'residential', config: ESTIMATE_MODE_MAP.residential },
  { key: 'commercial', config: ESTIMATE_MODE_MAP.commercial },
  { key: 'restoration', config: ESTIMATE_MODE_MAP.restoration },
  { key: 'contents', config: ESTIMATE_MODE_MAP.contents },
  { key: 'supplement', config: ESTIMATE_MODE_MAP.supplement },
];

export const CATEGORY_METADATA: Record<string, { label: string; icon: string }> = {
  // Residential / base
  walls: { label: 'Walls', icon: 'wall' },
  ceiling: { label: 'Ceiling', icon: 'roofing' },
  floor: { label: 'Floor', icon: 'grid_on' },
  trim: { label: 'Trim', icon: 'border_style' },
  doors: { label: 'Doors', icon: 'door_front' },
  windows: { label: 'Windows', icon: 'window' },
  cabinets: { label: 'Cabinets', icon: 'kitchen' },
  fixtures: { label: 'Fixtures', icon: 'light' },
  misc_items: { label: 'Misc Items', icon: 'category' },
  // Commercial
  hvac: { label: 'HVAC', icon: 'air' },
  electrical: { label: 'Electrical', icon: 'electrical_services' },
  plumbing: { label: 'Plumbing', icon: 'plumbing' },
  fire_protection: { label: 'Fire Protection', icon: 'local_fire_department' },
  // Restoration
  extraction: { label: 'Extraction', icon: 'water_drop' },
  drying_equipment: { label: 'Drying Equipment', icon: 'dry' },
  containment: { label: 'Containment', icon: 'shield' },
  demo: { label: 'Demolition', icon: 'construction' },
  antimicrobial: { label: 'Antimicrobial', icon: 'sanitizer' },
  monitoring: { label: 'Monitoring', icon: 'monitor_heart' },
  // Contents
  furniture: { label: 'Furniture', icon: 'chair' },
  electronics: { label: 'Electronics', icon: 'devices' },
  clothing: { label: 'Clothing', icon: 'checkroom' },
  appliances: { label: 'Appliances', icon: 'kitchen' },
  collectibles: { label: 'Collectibles', icon: 'diamond' },
  documents: { label: 'Documents', icon: 'description' },
};
