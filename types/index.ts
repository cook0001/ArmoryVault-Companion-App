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
  type?: string;
  barrel_length?: string;
  action_type?: string;
  action?: string;
  finish?: string;
  notes?: string;
  purchase_price: number | null;
  purchase_date: string;
  purchase_location?: string;
  condition: string;
  image_path: string;
  photos?: string[];
  maintenance_schedules?: MaintenanceScheduleItem[];
  // ATF Bound Book acquisition & disposition fields
  acquire_date?: string;
  acquired_from_name?: string;
  acquired_from_address?: string;
  acquired_from_ffl?: string;
  acquire_license_type?: string;
  is_sold: boolean;
  sold_date?: string;
  sold_to_name?: string;
  sold_to_address?: string;
  sold_to_ffl?: string;
  sold_price?: number | null;
  sale_notes?: string;
  // NFA compliance fields
  is_nfa?: boolean;
  nfa_type?: string;
  nfa_tax_stamp_number?: string;
  nfa_trust_name?: string;
  nfa_form_type?: string;
  nfa_approval_date?: string;
  documents?: { name: string; path: string; date_added?: string; transferId?: string }[];
  logs?: MaintenanceLog[];
  storageLocationId?: number;
  round_count?: number;
  total_rounds?: number;
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
  roundsPerBox?: number;
  boxCount?: number;
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

export interface OpticItem {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  type: 'Rifle Scope' | 'Red Dot' | 'Holographic' | 'Prism' | 'LPVO' | 'Iron Sights' | string;
  focalPlane?: 'FFP (First)' | 'SFP (Second)' | 'N/A' | string;
  magnification?: string;
  objectiveLens?: string;
  tubeDiameter?: string;
  reticle: string;
  clickValue: '0.1 MRAD' | '1/4 MOA' | '1/2 MOA' | '1 MOA' | 'Custom' | string;
  zeroDistance: number;
  zeroStop: boolean;
  mountedOnFirearm?: string;
  ringTorque?: string;
  baseTorque?: string;
  batteryType: 'CR2032' | 'CR123A' | 'CR2' | 'AAA' | 'Solar / Integrated' | 'None' | string;
  batteryReplacedDate?: string;
  notes?: string;
  updatedAt?: string;
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

export interface BillOfSaleSyncItem extends SyncQueueItem {
  type: 'bill_of_sale_transfer';
  firearm_id?: number;
  serial_number?: string;
  transfer_id: string;
  date: string;
  buyer_name: string;
  buyer_dl?: string;
  buyer_address?: string;
  buyer_phone?: string;
  buyer_email?: string;
  seller_name: string;
  sale_price: number;
  payment_method: string;
  notes?: string;
  pdf_base64?: string;
  pdf_filename?: string;
}

export interface RangeSessionSyncItem extends SyncQueueItem {
  type: 'range_session';
  firearm_id: number;
  firearm_name?: string;
  ammo_id?: number;
  ammo_name?: string;
  rounds_fired: number;
  date: string;
  location?: string;
  cost?: number;
  notes?: string;
  distance_yards?: number;
  group_metrics?: {
    moa: number;
    extremeSpreadInches?: number;
    extreme_spread_in?: number;
    meanRadiusInches?: number;
    mean_radius_in?: number;
    shotCount?: number;
    shot_count?: number;
  };
  target_photo_path?: string;
  photo_path?: string;
  chrono_data?: {
    avg?: number;
    sd?: number;
    es?: number;
    shots?: number[];
  };
  optic_name?: string;
}

export type ModuleId =
  | 'ballistics'
  | 'boundbook'
  | 'labels'
  | 'maintenance'
  | 'nfa'
  | 'optics'
  | 'ranges'
  | 'reloading';

export interface BoundBookRecord {
  id?: number;
  firearm_id?: number;
  make: string;
  model: string;
  serial_number: string;
  caliber: string;
  type?: string;
  action?: string;
  acquire_date: string;
  acquired_from_name: string;
  acquired_from_address?: string;
  acquired_from_ffl?: string;
  acquire_license_type?: string;
  is_sold: boolean;
  sold_date?: string;
  sold_to_name?: string;
  sold_to_address?: string;
  sold_to_ffl?: string;
  sold_price?: number | null;
  sale_notes?: string;
}

export interface NfaRecord {
  id: string | number;
  firearm_id?: number;
  type: 'Suppressor' | 'SBR' | 'SBS' | 'AOW' | 'Machine Gun' | 'Destructive Device' | string;
  make: string;
  model: string;
  serial_number: string;
  caliber?: string;
  form_type?: 'Form 1' | 'Form 4' | 'Form 20' | 'Form 5320.20' | string;
  tax_stamp_number?: string;
  trust_name?: string;
  approval_date?: string;
  submission_date?: string;
  cleo_name?: string;
  notes?: string;
  status?: 'Approved' | 'Pending' | 'Draft' | string;
}

export interface ShootingRangeItem {
  id: number;
  name: string;
  trade_name?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  lane_fee?: number | null;
  fee_type?: string;
  amenities?: string;
  is_public?: number | boolean;
  distance_miles?: number;
  latitude?: number;
  longitude?: number;
  is_bookmarked?: boolean;
}

export interface ReloadingRecipe {
  id: string | number;
  name: string;
  caliber: string;
  bullet_id?: number;
  bullet_name?: string;
  grain?: number;
  powder_id?: number;
  powder_name?: string;
  powder_charge?: number;
  primer_id?: number;
  primer_name?: string;
  brass_id?: number;
  brass_name?: string;
  ccl_oal?: number;
  target_fps?: number;
  notes?: string;
  date_created?: string;
}

export interface FirearmMaintenanceSyncItem extends SyncQueueItem {
  type: 'firearm_maintenance';
  firearm_id: number;
  date: string;
  task_name: string;
  service_type: 'Cleaning' | 'Inspection' | 'Parts Replacement' | 'Repair' | 'Other';
  rounds_at_service: number;
  cost?: number;
  parts_replaced?: string;
  notes?: string;
}

export interface OpticZeroUpdateSyncItem extends SyncQueueItem {
  type: 'optic_zero_update';
  optic_id?: string;
  firearm_id?: number;
  zero_distance: number;
  click_unit: string;
  date: string;
  notes?: string;
}

export interface ComponentAdjustmentSyncItem extends SyncQueueItem {
  type: 'component_adjustment';
  upcOrId?: string;
  component_id?: number;
  count: number;
  action: 'add' | 'remove';
  measurement?: 'rds' | 'lbs' | 'brick' | 'grains' | string;
  notes?: string;
}

export interface AmmoAdjustmentSyncItem extends SyncQueueItem {
  type: 'ammo_adjustment';
  upcOrId?: string;
  ammo_id?: number;
  count: number;
  action: 'add' | 'remove';
  measurement?: 'rds' | string;
  notes?: string;
}
