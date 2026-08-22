/**
 * Shared type definitions for the ArmoryVault Companion mobile app.
 * These interfaces mirror the desktop types in src/types/index.ts.
 * Keep in sync when modifying the desktop schemas.
 */

export interface Firearm {
  id?: number;
  make: string;
  model: string;
  serial_number: string;
  caliber: string;
  barrel_length?: string;
  action_type?: string;
  finish?: string;
  notes?: string;
  purchase_price: number | null;
  purchase_date: string;
  condition: string;
  image_path: string;
  photos?: string[];
  maintenance_schedules?: MaintenanceScheduleItem[];
  is_sold: boolean;
  sold_date?: string;
  logs?: MaintenanceLog[];
  storageLocationId?: number;
  is_nfa?: boolean;
  nfa_type?: string;
}

export interface Ammo {
  id?: number;
  caliber: string;
  category?: 'Pistol' | 'Rifle' | 'Shotgun' | 'Other' | string;
  type: 'factory' | 'handload';
  count: number;
  measurement?: string;
  min_threshold?: number;
  low_stock_threshold?: number;
  costPerRound?: number;
  manufacturer?: string;
  bullet_manufacturer?: string;
  grain?: number;
  projectile?: string;
  shell_length?: string;
  shot_size?: string;
  oz_payload?: string;
  pellet_count?: number;
  powder?: string;
  powderCharge?: number;
  primer_type?: string;
  primer?: string;
  brass?: string;
  oal?: number;
  notes?: string;
  upc_code?: string;
  isPlusP?: boolean;
  storageLocationId?: number;
}

export interface ReloadingComponent {
  id?: number;
  type: 'Powder' | 'Brass' | 'Bullet' | 'Primer';
  manufacturer: string;
  name?: string;
  quantity: number;
  min_threshold?: number;
  cost?: number;
  purchaseDate?: string;
  notes?: string;
  upc_code?: string;
  weightUnit?: 'lbs' | 'oz' | 'grains';
  caliber?: string;
  grain?: number;
  bulletType?: string;
  storageLocationId?: number;
}

export interface AccessoryMount {
  firearmId: number;
  quantity: number;
}

export interface Accessory {
  id?: number;
  type: 'Optic' | 'Suppressor' | 'Light' | 'Holster' | 'Mount' | 'Sling' | 'Magazine' | 'Stock' | 'Chassis' | 'Belt' | 'Other';
  manufacturer: string;
  model: string;
  quantity?: number;
  serialNumber?: string;
  round_count?: number;
  value?: number | null;
  purchaseDate?: string;
  mounts?: AccessoryMount[];
  notes?: string;
  photo?: string | null;
  photos?: string[];
  upc_code?: string;
  storageLocationId?: number;
  is_nfa?: boolean;
}

export interface MaintenanceScheduleItem {
  id: string;
  task_name: string;
  interval_rounds: number;
  interval_days?: number;
  last_performed_rounds: number;
  last_performed_date?: string;
  notes?: string;
}

export interface MaintenanceLog {
  id: number;
  date: string;
  type: 'Cleaning' | 'Range' | 'Modification' | 'Repair' | 'Other';
  rounds_fired?: number;
  ammo_used?: string;
  cost?: number;
  notes: string;
}

export interface StorageLocation {
  id?: number;
  name: string;
  type: 'Safe' | 'Cabinet' | 'AmmoCan' | 'Case' | 'Vehicle' | 'Other';
  capacity?: number;
  capacityMode?: 'firearms' | 'ammo' | 'all';
  notes?: string;
  firearmIds?: number[];
  accessoryIds?: number[];
  ammoIds?: number[];
  componentIds?: number[];
}

export interface SyncQueueItem {
  id?: number;
  type: string;
  timestamp: string;
  upcOrId?: string;
  data?: Record<string, unknown>;
  device?: string;
  // Dynamic payload fields vary by item type (e.g., notes, firearmId, photoBase64)
  [key: string]: unknown;
}

export interface DashboardStats {
  firearms: number;
  ammo: number;
  components: number;
  skus?: number;
}

export interface NewFirearmPayload {
  make: string;
  model: string;
  serial_number: string;
  caliber: string;
  firearm_type?: string;
  action_type?: string;
  barrel_length?: string;
  finish?: string;
  condition?: string;
  purchase_price?: number | null;
  purchase_date?: string;
  purchased_from?: string;
  storageLocationId?: number;
  notes?: string;
  is_nfa?: boolean;
  nfa_type?: string;
  photoBase64?: string;
  photosBase64?: string[];
  [key: string]: unknown;
}

export interface FirearmUpdatePayload extends Partial<NewFirearmPayload> {
  firearmId: number;
}
