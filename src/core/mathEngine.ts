import { Material, SheetMetalPart, BendCalculation } from '../types/sheetMetal'
import { Die } from '../types/tooling'

export const STANDARD_MATERIALS: Material[] = [
  {
    id: 'mild_steel_s235',
    name: 'Mild Steel (S235 / A36)',
    tensileStrength: 420,
    yieldStrength: 235,
    defaultKFactor: 0.38,
    description: 'Standard structural mild carbon steel',
  },
  {
    id: 'stainless_304',
    name: 'Stainless Steel (AISI 304)',
    tensileStrength: 650,
    yieldStrength: 290,
    defaultKFactor: 0.42,
    description: 'Austenitic stainless steel with higher springback',
  },
  {
    id: 'aluminum_5052',
    name: 'Aluminum (5052-H32)',
    tensileStrength: 220,
    yieldStrength: 190,
    defaultKFactor: 0.35,
    description: 'Medium-strength ductile sheet aluminum',
  },
  {
    id: 'copper_c110',
    name: 'Copper (C11000)',
    tensileStrength: 250,
    yieldStrength: 200,
    defaultKFactor: 0.34,
    description: 'Soft ductile electrical grade copper',
  },
]

/**
 * Calculates standard neutral axis K-factor if not specified.
 * Uses empirical industrial approximation based on inside radius Ri and thickness T.
 */
export function calculateKFactor(insideRadius: number, thickness: number): number {
  if (thickness <= 0) return 0.33
  const ratio = insideRadius / thickness
  if (ratio <= 1.0) {
    return 0.33 + ratio * 0.05 // 0.33 to 0.38
  } else if (ratio <= 3.0) {
    return 0.38 + (ratio - 1.0) * 0.035 // 0.38 to 0.45
  } else {
    return Math.min(0.50, 0.45 + (ratio - 3.0) * 0.01)
  }
}

/**
 * Bend Allowance (BA) - Developed arc length along the neutral axis.
 * angleDeg: bend angle in degrees (the turn angle, e.g. 90° for right angle)
 */
export function calculateBendAllowance(
  angleDeg: number,
  insideRadius: number,
  thickness: number,
  kFactor: number
): number {
  const angleRad = (angleDeg * Math.PI) / 180
  return angleRad * (insideRadius + kFactor * thickness)
}

/**
 * Setback (SB) - Distance from the apex (virtual sharp corner) to the tangent bend line.
 */
export function calculateSetback(
  angleDeg: number,
  insideRadius: number,
  thickness: number
): number {
  const halfAngleRad = ((angleDeg / 2) * Math.PI) / 180
  return (insideRadius + thickness) * Math.tan(halfAngleRad)
}

/**
 * Bend Deduction (BD) - Amount subtracted from the sum of outside flange dimensions.
 * BD = 2 * Setback - Bend Allowance
 */
export function calculateBendDeduction(
  angleDeg: number,
  insideRadius: number,
  thickness: number,
  kFactor: number
): number {
  const ba = calculateBendAllowance(angleDeg, insideRadius, thickness, kFactor)
  const sb = calculateSetback(angleDeg, insideRadius, thickness)
  return 2 * sb - ba
}

/**
 * Recommended standard V-die opening for a given sheet thickness.
 */
export function getRecommendedVOpening(thickness: number): number {
  if (thickness <= 2.5) {
    return Math.max(6, Math.round((thickness * 6) / 2) * 2)
  } else if (thickness <= 8.0) {
    return Math.round((thickness * 8) / 2) * 2
  } else {
    return Math.round((thickness * 10) / 2) * 2
  }
}

/**
 * Air bending tonnage calculation:
 * F = (C * Rm * b * T^2) / V (Newtons)
 */
export function calculateBendingTonnage(
  thickness: number,
  widthMm: number,
  vOpeningMm: number,
  materialRm: number = 420
): { kNPerMeter: number; totalKn: number; totalTonnes: number } {
  if (vOpeningMm <= 0 || thickness <= 0) {
    return { kNPerMeter: 0, totalKn: 0, totalTonnes: 0 }
  }
  const C = 1.42
  // Force per meter length (N/m): (1.42 * Rm * 1000 * T^2) / V
  const forcePerMeterN = (C * materialRm * 1000 * Math.pow(thickness, 2)) / vOpeningMm
  const kNPerMeter = forcePerMeterN / 1000

  // Total force for given width
  const totalForceN = (forcePerMeterN * widthMm) / 1000
  const totalKn = totalForceN / 1000
  const totalTonnes = totalForceN / 9806.65

  return {
    kNPerMeter: Math.round(kNPerMeter * 10) / 10,
    totalKn: Math.round(totalKn * 10) / 10,
    totalTonnes: Math.round(totalTonnes * 10) / 10,
  }
}

/**
 * Minimum safe flange length to prevent workpiece slipping into the V-groove.
 * b_min ≈ 0.7 * V (plus thickness)
 */
export function calculateMinFlangeLength(vOpeningMm: number, thickness: number): number {
  return Math.round((0.7 * vOpeningMm + thickness) * 10) / 10
}

/**
 * Ram penetration depth Y in air bending (bottom dead center position relative to die top).
 */
export function calculatePenetrationDepth(
  targetAngleDeg: number,
  vOpeningMm: number,
  punchTipRadius: number,
  thickness: number
): number {
  const halfAngleRad = ((targetAngleDeg / 2) * Math.PI) / 180
  const vHalf = vOpeningMm / 2
  // Simple trigonometric air bending depth approximation
  const depth = vHalf / Math.tan(halfAngleRad) - (punchTipRadius + thickness) * (1 / Math.sin(halfAngleRad) - 1)
  return Math.max(0.5, Math.round(depth * 100) / 100)
}

/**
 * Comprehensive part calculations
 */
export function calculatePartMetrics(
  part: SheetMetalPart,
  material: Material,
  die: Die
): BendCalculation {
  const recV = getRecommendedVOpening(part.thickness)
  const v = die.vOpening > 0 ? die.vOpening : recV
  const tonnage = calculateBendingTonnage(part.thickness, part.width, v, material.tensileStrength)
  const minFlange = calculateMinFlangeLength(v, part.thickness)

  let totalBD = 0
  let avgK = 0

  part.bends.forEach((bend) => {
    const k = bend.kFactor ?? calculateKFactor(bend.radius, part.thickness)
    avgK += k
    const bd = calculateBendDeduction(bend.angle, bend.radius, part.thickness, k)
    totalBD += bd
  })

  avgK = part.bends.length > 0 ? avgK / part.bends.length : material.defaultKFactor

  const sumFlanges = part.flanges.reduce((acc, f) => acc + f.length, 0)
  const flatLength = Math.max(0, Math.round((sumFlanges - totalBD) * 100) / 100)

  return {
    kFactor: Math.round(avgK * 100) / 100,
    bendAllowance: 0,
    bendDeduction: Math.round(totalBD * 100) / 100,
    setback: 0,
    flatLength,
    tonnagePerMeter: tonnage.kNPerMeter,
    totalTonnage: tonnage.totalTonnes,
    minFlangeLength: minFlange,
    recommendedV: recV,
  }
}
