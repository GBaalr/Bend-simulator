export interface Material {
  id: string
  name: string
  tensileStrength: number // Rm in MPa (N/mm²)
  yieldStrength: number   // Re in MPa
  defaultKFactor: number
  description: string
}

export interface Flange {
  id: string
  length: number // mm (outer nominal dimension)
}

export interface Bend {
  id: string
  angle: number        // target bend angle in degrees (e.g. 90, 45, 135)
  direction: 'UP' | 'DOWN' // direction of bend relative to prior segment
  radius: number       // inside radius (mm)
  kFactor?: number     // specific K-factor if overridden
}

export interface SheetMetalPart {
  name: string
  thickness: number    // T in mm
  width: number        // bend length W in mm
  materialId: string
  flanges: Flange[]
  bends: Bend[]
}

export interface BendCalculation {
  kFactor: number
  bendAllowance: number // BA
  bendDeduction: number // BD
  setback: number       // SB
  flatLength: number    // developed blank length
  tonnagePerMeter: number // kN/m
  totalTonnage: number  // kN (and Metric Tonnes)
  minFlangeLength: number // mm
  recommendedV: number  // mm
  springbackDeg?: number // predicted elastic recovery angle
  overbendAngle?: number // target press angle compensated for springback
}
