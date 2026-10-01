import { SheetMetalPart } from '../types/sheetMetal'

export interface PresetDef {
  key: string
  name: string
  desc: string
  part: SheetMetalPart
}

export const SAMPLE_PRESETS: Record<string, PresetDef> = {
  u_channel: {
    key: 'u_channel',
    name: 'U-Channel (Return Flanges)',
    desc: 'Standard 4-bend channel with tight clearances',
    part: {
      name: 'U-Channel with Return Flanges',
      thickness: 2.0,
      width: 500,
      materialId: 'mild_steel_s235',
      flanges: [
        { id: 'f0', length: 30 },
        { id: 'f1', length: 50 },
        { id: 'f2', length: 110 },
        { id: 'f3', length: 50 },
        { id: 'f4', length: 30 },
      ],
      bends: [
        { id: 'b0', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b1', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b2', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b3', angle: 90, direction: 'UP', radius: 1.5 },
      ],
    },
  },
  hat_profile: {
    key: 'hat_profile',
    name: 'Top-Hat Profile',
    desc: 'Symmetric 4-bend profile with outer flanges',
    part: {
      name: 'Top-Hat Profile',
      thickness: 1.5,
      width: 600,
      materialId: 'mild_steel_s235',
      flanges: [
        { id: 'f0', length: 35 },
        { id: 'f1', length: 60 },
        { id: 'f2', length: 130 },
        { id: 'f3', length: 60 },
        { id: 'f4', length: 35 },
      ],
      bends: [
        { id: 'b0', angle: 90, direction: 'UP', radius: 1.2 },
        { id: 'b1', angle: 90, direction: 'DOWN', radius: 1.2 },
        { id: 'b2', angle: 90, direction: 'DOWN', radius: 1.2 },
        { id: 'b3', angle: 90, direction: 'UP', radius: 1.2 },
      ],
    },
  },
  c_profile: {
    key: 'c_profile',
    name: 'C-Enclosure (Collision Demo)',
    desc: 'Demonstrates return flange collision & gooseneck fix',
    part: {
      name: 'C-Enclosure (Collision Demo)',
      thickness: 2.0,
      width: 450,
      materialId: 'mild_steel_s235',
      flanges: [
        { id: 'f0', length: 45 },
        { id: 'f1', length: 75 },
        { id: 'f2', length: 140 },
        { id: 'f3', length: 75 },
        { id: 'f4', length: 45 },
      ],
      bends: [
        { id: 'b0', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b1', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b2', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b3', angle: 90, direction: 'UP', radius: 1.5 },
      ],
    },
  },
  deep_box_flange: {
    key: 'deep_box_flange',
    name: 'Deep Box Flange',
    desc: 'Tall upright walls testing punch height limits',
    part: {
      name: 'Deep Box Flange',
      thickness: 3.0,
      width: 400,
      materialId: 'mild_steel_s235',
      flanges: [
        { id: 'f0', length: 110 },
        { id: 'f1', length: 140 },
        { id: 'f2', length: 110 },
      ],
      bends: [
        { id: 'b0', angle: 90, direction: 'UP', radius: 2.0 },
        { id: 'b1', angle: 90, direction: 'UP', radius: 2.0 },
      ],
    },
  },
  bracket_z: {
    key: 'bracket_z',
    name: 'Z-Bracket (2 Bends)',
    desc: 'Classic double 90° opposite bend',
    part: {
      name: 'Z-Bracket (2 Bends)',
      thickness: 2.0,
      width: 300,
      materialId: 'mild_steel_s235',
      flanges: [
        { id: 'f0', length: 50 },
        { id: 'f1', length: 80 },
        { id: 'f2', length: 50 },
      ],
      bends: [
        { id: 'b0', angle: 90, direction: 'UP', radius: 1.5 },
        { id: 'b1', angle: 90, direction: 'DOWN', radius: 1.5 },
      ],
    },
  },
}
