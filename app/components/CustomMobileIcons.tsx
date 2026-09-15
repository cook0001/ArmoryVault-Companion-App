import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect, SvgProps } from 'react-native-svg';

export interface MobileIconProps extends SvgProps {
  size?: number;
  color?: string;
}

/**
 * 3 Cartridges standing side-by-side (Left, Center taller, Right)
 * Featuring bullet tips, bottleneck casings, extractor grooves, and primer rims.
 */
export const CartridgesIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#f59e0b',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Left Cartridge */}
    <Path d="M4 11 L4 21 M8 11 L8 21" />
    <Path d="M4 21 L8 21" />
    <Path d="M4 11 C4 9.5, 6 6.5, 6 6.5 C6 6.5, 8 9.5, 8 11 Z" />
    <Line x1="4" y1="19" x2="8" y2="19" />

    {/* Center Cartridge (Taller Rifle Round) */}
    <Path d="M10 9 L10 21 M14 9 L14 21" />
    <Path d="M10 21 L14 21" />
    <Path d="M10 9 C10 7, 12 3, 12 3 C12 3, 14 7, 14 9 Z" />
    <Line x1="10" y1="19" x2="14" y2="19" />

    {/* Right Cartridge */}
    <Path d="M16 11 L16 21 M20 11 L20 21" />
    <Path d="M16 21 L20 21" />
    <Path d="M16 11 C16 9.5, 18 6.5, 18 6.5 C18 6.5, 20 9.5, 20 11 Z" />
    <Line x1="16" y1="19" x2="20" y2="19" />
  </Svg>
);

/**
 * .50 Cal Military Surplus Steel Ammo Can
 * With top carrying handle, hinged latch, and stamped structural body lines.
 */
export const AmmoCanIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#f59e0b',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Main can body */}
    <Rect x="3" y="8" width="18" height="13" rx="1.5" />
    {/* Overhanging weather lid */}
    <Path d="M2 8h20v2.5H2z" />
    {/* Top folding handle */}
    <Path d="M8.5 8V4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V8" />
    {/* Front toggle clasp */}
    <Rect x="10.5" y="10.5" width="3" height="4.5" rx="0.5" />
    {/* Embossed stiffening rib */}
    <Line x1="6" y1="17.5" x2="18" y2="17.5" />
  </Svg>
);

/**
 * Armory Gun Safe
 * Heavy vault safe with inset door, combination lock dial, and 3-spoke wheel handle.
 */
export const SafeIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#34d399',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Safe body */}
    <Rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Safe door bevel */}
    <Rect x="6" y="6" width="12" height="12" rx="1" />
    {/* Combination dial */}
    <Circle cx="10" cy="12" r="2" />
    <Line x1="10" y1="10.5" x2="10" y2="12" />
    {/* Wheel handle spokes */}
    <Path d="M14.5 10.5 L14.5 13.5" />
    <Path d="M13 12 L16 12" />
  </Svg>
);

/**
 * Ballistics Trajectory Reticle
 */
export const BallisticsTrajectoryIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#ef4444',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Circle cx="12" cy="12" r="9" />
    <Line x1="12" y1="3" x2="12" y2="21" />
    <Line x1="3" y1="12" x2="21" y2="12" />
    <Line x1="11" y1="15" x2="13" y2="15" />
    <Line x1="10" y1="18" x2="14" y2="18" />
    <Line x1="15" y1="11" x2="15" y2="13" />
  </Svg>
);

/**
 * Gunpowder Bottle / Canister
 */
export const GunpowderIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#60a5fa',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="5" y="8" width="14" height="13" rx="2" />
    <Path d="M9 8V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
    <Line x1="9" y1="12" x2="15" y2="12" />
    <Line x1="9" y1="15" x2="13" y2="15" />
    <Line x1="9" y1="18" x2="15" y2="18" />
  </Svg>
);

/**
 * Boxed Primer Cup
 */
export const PrimerIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#fbbf24',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Circle cx="12" cy="12" r="8" />
    <Circle cx="12" cy="12" r="3" />
    <Line x1="12" y1="4" x2="12" y2="9" />
    <Line x1="5" y1="16" x2="9.5" y2="13.5" />
    <Line x1="19" y1="16" x2="14.5" y2="13.5" />
  </Svg>
);

/**
 * Scope / Red Dot Crosshair
 */
export const ScopeIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#38bdf8',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Circle cx="12" cy="12" r="9" />
    <Line x1="12" y1="2" x2="12" y2="22" />
    <Line x1="2" y1="12" x2="22" y2="12" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

/**
 * Suppressor / Silencer
 */
export const SuppressorIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#f59e0b',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="2" y="7" width="20" height="10" rx="3" />
    <Line x1="7" y1="7" x2="7" y2="17" />
    <Line x1="12" y1="7" x2="12" y2="17" />
    <Line x1="17" y1="7" x2="17" y2="17" />
    <Rect x="1" y="9.5" width="2" height="5" rx="0.5" />
  </Svg>
);

/**
 * Box Magazine
 */
export const MagazineIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#c084fc',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="6" y="2" width="12" height="20" rx="1.5" />
    <Path d="M8 2 L8 5 L16 5 L16 2" />
    <Circle cx="12" cy="8" r="1" fill={color} />
    <Circle cx="12" cy="12" r="1" fill={color} />
    <Circle cx="12" cy="16" r="1" fill={color} />
    <Line x1="5" y1="22" x2="19" y2="22" />
  </Svg>
);

/**
 * Molded Holster
 */
export const HolsterIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#34d399',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M7 3 L17 3 L18 10 L15 21 L9 21 L6 10 Z" />
    <Rect x="10" y="7" width="4" height="7" rx="1" />
  </Svg>
);

/**
 * Gun Storage Cabinet
 */
export const CabinetIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#38bdf8',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="4" y="3" width="16" height="18" rx="1.5" />
    <Line x1="12" y1="3" x2="12" y2="21" />
    <Line x1="10" y1="11" x2="10" y2="13" />
    <Line x1="14" y1="11" x2="14" y2="13" />
    <Line x1="6" y1="21" x2="6" y2="23" />
    <Line x1="18" y1="21" x2="18" y2="23" />
  </Svg>
);

/**
 * Tactical Gun Case
 */
export const GunCaseIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#a78bfa',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="2" y="6" width="20" height="13" rx="2" />
    <Path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <Rect x="5.5" y="10" width="2" height="4" rx="0.5" />
    <Rect x="16.5" y="10" width="2" height="4" rx="0.5" />
    <Line x1="2" y1="12" x2="22" y2="12" />
  </Svg>
);

/**
 * Vehicle Center Console Vault / Car Safe
 */
export const VehicleVaultIcon: React.FC<MobileIconProps> = ({
  size = 18,
  color = '#fb7185',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <Rect x="3" y="11" width="18" height="9" rx="2" />
    <Circle cx="7.5" cy="16.5" r="1.5" />
    <Circle cx="16.5" cy="16.5" r="1.5" />
    <Circle cx="12" cy="14" r="1.5" />
  </Svg>
);

/**
 * Bound Book / ATF Ledger Icon
 */
export const BoundBookIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#38bdf8',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <Line x1="8" y1="7" x2="16" y2="7" />
    <Line x1="8" y1="11" x2="14" y2="11" />
  </Svg>
);

/**
 * Armorer Maintenance Wrench & Tool
 */
export const MaintenanceWrenchIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#f59e0b',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Svg>
);

/**
 * NFA Tax Stamp & Compliance Badge
 */
export const NfaTaxStampIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#a855f7',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Rect x="4" y="3" width="16" height="18" rx="2" />
    <Circle cx="12" cy="11" r="4" />
    <Path d="M10 11l1.5 1.5L14 9.5" />
    <Line x1="8" y1="17" x2="16" y2="17" />
  </Svg>
);

/**
 * Shooting Range Concentric Target
 */
export const RangeTargetIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#10b981',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" fill={color} />
  </Svg>
);

/**
 * Reloading Scale / Powder Workbench
 */
export const ReloadingScaleIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#ec4899',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Line x1="12" y1="3" x2="12" y2="21" />
    <Line x1="4" y1="7" x2="20" y2="7" />
    <Path d="M4 7l3 6h-6l3-6z" />
    <Path d="M20 7l3 6h-6l3-6z" />
    <Line x1="8" y1="21" x2="16" y2="21" />
  </Svg>
);

/**
 * Label & QR Studio Printer
 */
export const LabelPrinterIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#6366f1',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Polyline points="6 9 6 2 18 2 18 9" />
    <Path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <Rect x="6" y="14" width="12" height="8" />
  </Svg>
);

/**
 * Bullet Projectile with Ogive and Cannelure
 */
export const BulletProjectileIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#ef4444',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M8 21 L8 12 C8 7 12 3 12 3 C12 3 16 7 16 12 L16 21 Z" />
    <Line x1="8" y1="14" x2="16" y2="14" strokeDasharray="1 1" />
    <Line x1="8" y1="17" x2="16" y2="17" />
  </Svg>
);

/**
 * Brass Cartridge Casing with Extractor Groove
 */
export const BrassCaseIcon: React.FC<MobileIconProps> = ({
  size = 20,
  color = '#eab308',
  ...props
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <Path d="M9 4 L15 4 L15 7 L17 10 L17 20 L7 20 L7 10 L9 7 Z" />
    <Line x1="7" y1="18" x2="17" y2="18" />
    <Line x1="6" y1="21" x2="18" y2="21" />
  </Svg>
);

export default function CustomMobileIcons() {
  return null;
}


