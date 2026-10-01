import { Punch, Die, MachineEnvelope, Point2D } from '../types/tooling'

/**
 * Coordinate System:
 * Origin (0,0) is at the PUNCH TIP at neutral touch.
 * +Y is UPWARDS towards the Upper Ram and Punch Holder.
 * -Y is DOWNWARDS towards the Die and Lower Bed.
 * +X is to the REAR towards the Backgauge fingers.
 * -X is to the FRONT towards the Operator.
 */

export function generatePunchPolygon(punch: Punch): Point2D[] {
  const halfAngleRad = ((punch.angle / 2) * Math.PI) / 180
  const tipRadius = punch.tipRadius

  if (punch.type === 'straight') {
    // Standard European Straight Punch
    const slopeHeight = 35
    const slopeHalfWidth = slopeHeight * Math.tan(halfAngleRad) + tipRadius
    const bodyHalfWidth = Math.max(slopeHalfWidth, 14)
    const shankHalfWidth = punch.shankWidth / 2 // 6.5mm
    const h = punch.height

    return [
      { x: 0, y: 0 }, // Tip
      { x: slopeHalfWidth, y: slopeHeight },
      { x: bodyHalfWidth, y: slopeHeight + 20 },
      { x: shankHalfWidth, y: h - 25 },
      { x: shankHalfWidth, y: h },
      { x: -shankHalfWidth, y: h },
      { x: -shankHalfWidth, y: h - 25 },
      { x: -bodyHalfWidth, y: slopeHeight + 20 },
      { x: -slopeHalfWidth, y: slopeHeight },
    ]
  }

  if (punch.type === 'gooseneck') {
    // Gooseneck with deep throat relief for return flanges
    // Relief is positioned on the front side (negative X) or rear side.
    // Standard European gooseneck relief opens to the front (-X)
    const reliefDepth = punch.throatRelief || 55
    const reliefH = punch.throatHeight || 60
    const h = punch.height
    const shankHalf = punch.shankWidth / 2

    return [
      { x: 0, y: 0 }, // Tip
      { x: 12, y: 25 },
      { x: 16, y: 45 },
      { x: 16, y: h - 30 },
      { x: shankHalf, y: h - 15 },
      { x: shankHalf, y: h },
      { x: -shankHalf, y: h },
      { x: -shankHalf, y: h - 20 },
      // The Gooseneck Pocket:
      { x: -12, y: reliefH + 20 },
      { x: -(reliefDepth + 10), y: reliefH + 10 },
      { x: -reliefDepth, y: 25 },
      { x: -10, y: 15 },
    ]
  }

  if (punch.type === 'acute') {
    // 30° Acute punch
    const slopeH = 45
    const slopeW = slopeH * Math.tan(halfAngleRad) + tipRadius
    const h = punch.height
    const shankHalf = punch.shankWidth / 2

    return [
      { x: 0, y: 0 },
      { x: slopeW, y: slopeH },
      { x: 14, y: slopeH + 15 },
      { x: shankHalf, y: h - 20 },
      { x: shankHalf, y: h },
      { x: -shankHalf, y: h },
      { x: -shankHalf, y: h - 20 },
      { x: -14, y: slopeH + 15 },
      { x: -slopeW, y: slopeH },
    ]
  }

  // Default / Sash punch
  const slopeH = 30
  const slopeW = slopeH * Math.tan(halfAngleRad)
  const h = punch.height
  return [
    { x: 0, y: 0 },
    { x: slopeW, y: slopeH },
    { x: 10, y: slopeH + 30 },
    { x: 6.5, y: h },
    { x: -6.5, y: h },
    { x: -10, y: slopeH + 30 },
    { x: -slopeW, y: slopeH },
  ]
}

export function generateDiePolygon(die: Die, sheetThickness: number): Point2D[] {
  const v = die.vOpening
  const halfAngleRad = ((die.vAngle / 2) * Math.PI) / 180
  const vDepth = (v / 2) / Math.tan(halfAngleRad)
  const baseW = die.baseWidth / 2
  const dieTopY = -sheetThickness // Die sits directly below sheet
  const dieBottomY = dieTopY - die.height

  return [
    { x: -v / 2, y: dieTopY }, // Left V shoulder
    { x: 0, y: dieTopY - vDepth }, // V Bottom
    { x: v / 2, y: dieTopY }, // Right V shoulder
    { x: baseW, y: dieTopY }, // Top right shoulder
    { x: baseW, y: dieTopY - 20 },
    { x: baseW * 0.9, y: dieBottomY + 15 },
    { x: baseW * 0.9, y: dieBottomY }, // Bottom right
    { x: -baseW * 0.9, y: dieBottomY }, // Bottom left
    { x: -baseW * 0.9, y: dieBottomY + 15 },
    { x: -baseW, y: dieTopY - 20 },
    { x: -baseW, y: dieTopY }, // Top left shoulder
  ]
}

export const STANDARD_PUNCHES: Punch[] = [
  {
    id: 'punch_straight_88',
    name: 'P-105.88 Straight Punch (88°, R0.8)',
    type: 'straight',
    height: 105,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 1000,
  },
  {
    id: 'punch_gooseneck_88',
    name: 'P-120.88 Gooseneck Punch (88°, R0.8, 55mm Relief)',
    type: 'gooseneck',
    height: 120,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 55,
    throatHeight: 60,
    shankWidth: 13,
    maxTonnage: 650,
  },
  {
    id: 'punch_acute_30',
    name: 'P-105.30 Acute Punch (30°, R1.0)',
    type: 'acute',
    height: 105,
    angle: 30,
    tipRadius: 1.0,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 500,
  },
  {
    id: 'punch_sash_86',
    name: 'P-105.86 Sash Punch (86°, R0.8, Narrow)',
    type: 'sash',
    height: 105,
    angle: 86,
    tipRadius: 0.8,
    throatRelief: 20,
    throatHeight: 40,
    shankWidth: 13,
    maxTonnage: 750,
  },
]

export const STANDARD_DIES: Die[] = [
  {
    id: 'die_v8_88',
    name: 'D-80.V8 Single V-Die (V=8mm, 88°)',
    height: 80,
    vOpening: 8,
    vAngle: 88,
    shoulderRadius: 1.0,
    baseWidth: 55,
    maxTonnage: 800,
  },
  {
    id: 'die_v12_88',
    name: 'D-80.V12 Single V-Die (V=12mm, 88°)',
    height: 80,
    vOpening: 12,
    vAngle: 88,
    shoulderRadius: 1.2,
    baseWidth: 55,
    maxTonnage: 900,
  },
  {
    id: 'die_v16_88',
    name: 'D-80.V16 Single V-Die (V=16mm, 88°)',
    height: 80,
    vOpening: 16,
    vAngle: 88,
    shoulderRadius: 1.5,
    baseWidth: 60,
    maxTonnage: 1000,
  },
  {
    id: 'die_v24_88',
    name: 'D-80.V24 Single V-Die (V=24mm, 88°)',
    height: 80,
    vOpening: 24,
    vAngle: 88,
    shoulderRadius: 2.0,
    baseWidth: 70,
    maxTonnage: 1200,
  },
]

export const DEFAULT_MACHINE_ENVELOPE: MachineEnvelope = {
  name: 'DELEM DA-53T Press Brake (100T x 2500mm)',
  controller: 'DELEM DA-53T',
  maxTonnageTonnes: 100,
  maxBendingLength: 2500,
  daylight: 420,
  stroke: 200,
  throatDepth: 350,
  ramWidth: 160,
  bedWidth: 160,
  backgaugeXMin: 10,
  backgaugeXMax: 650,
  backgaugeRMin: 0,
  backgaugeRMax: 180,
}
