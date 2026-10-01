export interface Point2D {
  x: number
  y: number
}

export type PunchType = 'straight' | 'gooseneck' | 'acute' | 'sash'

export interface Punch {
  id: string
  name: string
  type: PunchType
  height: number       // total tool height (mm)
  angle: number        // tip angle (degrees, e.g. 86°, 30°)
  tipRadius: number    // tip radius (mm, e.g. 0.8mm)
  throatRelief: number // horizontal relief depth (mm, e.g. 0 for straight, 55mm for gooseneck)
  throatHeight: number // vertical height of relief pocket (mm)
  shankWidth: number   // European clamp width (typically 13mm)
  maxTonnage: number   // kN/m rating
  polygon2D?: Point2D[] // dynamic or precomputed relative to tip (0,0)
}

export interface Die {
  id: string
  name: string
  height: number       // die height (mm, e.g. 80mm or 100mm)
  vOpening: number     // V width (mm, e.g. 8, 12, 16, 24)
  vAngle: number       // V angle (degrees, e.g. 86°, 88°)
  shoulderRadius: number // radius of V-opening shoulders (mm)
  baseWidth: number    // overall width of die body (mm, e.g. 60mm)
  maxTonnage: number   // kN/m rating
  polygon2D?: Point2D[] // dynamic or precomputed relative to top-center (0,0)
}

export interface BackgaugeFinger {
  x: number           // horizontal position from bend line (mm, positive is into the machine)
  r: number           // vertical height relative to die top (mm)
  width: number       // finger contact face width (mm)
  height: number      // finger face height (mm)
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
  ramWidth: number    // upper beam profile width (mm)
  bedWidth: number    // lower table width (mm)
  backgaugeXMin: number // min X travel (mm)
  backgaugeXMax: number // max X travel (mm)
  backgaugeRMin: number // min R travel (mm)
  backgaugeRMax: number // max R travel (mm)
}
