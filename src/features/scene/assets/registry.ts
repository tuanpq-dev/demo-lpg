import type { ComponentType } from 'react';
import type { AssetType, Vec3 } from '../types';
import { Filter, FlowMeter, Pump, Valve, Vaporizer } from './equipment';
import { ASSET_SPECS, type AssetParams, type AssetSpec } from './specs';
import { Building, Canopy, Fence, LoadingStation, TankerTruck } from './structures';
import { TankHorizontal, TankVertical } from './tanks';

export type AssetComponentProps = {
  /** Tham số đã gộp mặc định (`resolveParams`). */
  params: AssetParams;
  /** Asset theo đoạn (fence): polyline cục bộ từ `SceneObject.path`. */
  path?: Vec3[];
};

/** Spec thuần (specs.ts) + component R3F. */
export type AssetDefinition = AssetSpec & { type: AssetType; component: ComponentType<AssetComponentProps> };

const COMPONENTS: Record<AssetType, ComponentType<AssetComponentProps>> = {
  'tank-horizontal': TankHorizontal,
  'tank-vertical': TankVertical,
  pump: Pump,
  valve: Valve,
  filter: Filter,
  vaporizer: Vaporizer,
  'tanker-truck': TankerTruck,
  'loading-station': LoadingStation,
  'flow-meter': FlowMeter,
  building: Building,
  canopy: Canopy,
  fence: Fence,
};

export const ASSETS = Object.fromEntries(
  (Object.keys(COMPONENTS) as AssetType[]).map((type) => [type, { ...ASSET_SPECS[type], type, component: COMPONENTS[type] }]),
) as Record<AssetType, AssetDefinition>;
