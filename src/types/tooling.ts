export interface Point2D {
  x: number
  y: number
}

export type PunchType = 'straight' | 'gooseneck' | 'deep_gooseneck' | 'acute' | 'sash' | 'hemming'

export interface Punch {
  id: string
  name: string
  catalogCode?: string // e.g. 'Rolleri P.105.88', 'Eurostamp 1011'
  type: PunchType
  height: number       // total tool height (mm)
  angle: number        // tip angle (degrees, e.g. 88°, 30°)
  tipRadius: number    // tip radius (mm, e.g. 0.8mm)
  throatRelief: number // horizontal relief depth (mm, e.g. 0 for straight, 55mm for gooseneck, 80mm for deep)
  throatHeight: number // vertical height of relief pocket (mm)
  shankWidth: number   // European clamp width (typically 13mm)
  maxTonnage: number   // kN/m rating
  polygon2D?: Point2D[] // dynamic or precomputed relative to tip (0,0)
}

export type DieType = 'single_v' | 'acute_v' | 'multi_v' | 'hemming'

export interface Die {
  id: string
  name: string
  catalogCode?: string // e.g. 'Rolleri M.80.V12', 'Eurostamp 2009'
  type?: DieType
  height: number       // die height (mm, e.g. 80mm or 100mm)
  vOpening: number     // V width (mm, e.g. 8, 12, 16, 24)
  vAngle: number       // V angle (degrees, e.g. 86°, 88°, 30°)
  shoulderRadius: number // radius of V-opening shoulders (mm)
  baseWidth: number    // overall width of die body (mm, e.g. 55mm, 60mm, 80mm)
  maxTonnage: number   // kN/m rating
  polygon2D?: Point2D[] // dynamic or precomputed relative to top-center (0,0)
}

export interface BackgaugeFinger {
  x: number           // horizontal position from bend line (mm, positive is into the machine)
  r: number           // vertical height relative to die top (mm)
  width: number       // finger contact face width (mm)
  height: number      // finger face height (mm)
  step1Drop?: number  // second tier step drop depth (mm, e.g. 15mm)
  step2Drop?: number  // third tier step drop depth (mm, e.g. 40mm)
  polygon2D?: Point2D[]
}

export interface MachineEnvelope {
  name: string
  controller: string  // 'DELEM DA-53T'
  maxTonnageTonnes: number // e.g. 100 T
  maxBendingLength: number // e.g. 2500 mm
  daylight: number    // open height between upper beam and lower table (mm, e.g. 420mm)
  stroke: number      // max ram stroke (mm, e.g. 200mm)
  throatDepth: number // side frame throat clearance (mm, e.g. 350mm)
  ramWidth: number    // upper beam profile width (mm, e.g. 160mm)
  bedWidth: number    // lower table width (mm, e.g. 160mm)
  clampHolderHeight?: number // intermediate quick-clamp holder height (mm, e.g. 120mm)
  clampHolderWidth?: number  // intermediate quick-clamp holder width (mm, e.g. 100mm)
  dieRailHeight?: number     // lower die rail height (mm, e.g. 55mm)
  dieRailWidth?: number      // lower die rail width (mm, e.g. 95mm)
  tableHeightFromFloor?: number // distance from floor to lower table (mm, e.g. 880mm)
  step1Drop?: number    // 3-step finger step 1 drop depth (mm, e.g. 15mm)
  step2Drop?: number    // 3-step finger step 2 drop depth (mm, e.g. 40mm)
  backgaugeXMin: number // min X travel (mm)
  backgaugeXMax: number // max X travel (mm)
  backgaugeRMin: number // min R travel (mm)
  backgaugeRMax: number // max R travel (mm)
}
