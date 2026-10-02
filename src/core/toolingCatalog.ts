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
  const tipRadius = punch.tipRadius || 0.8
  const h = punch.height || 105
  const shankHalfWidth = (punch.shankWidth || 13) / 2 // 6.5 mm standard European tang
  const tangBottomY = h - 20 // 20mm standard clamping tang height

  // Promecam / European Standard Clamping Tang with Anti-Fall Safety Groove (8.4mm neck)
  const tangRight: Point2D[] = [
    { x: shankHalfWidth, y: tangBottomY },
    { x: shankHalfWidth, y: h - 14 },
    { x: 4.2, y: h - 12 },
    { x: 4.2, y: h - 8 },
    { x: shankHalfWidth, y: h - 6 },
    { x: shankHalfWidth, y: h },
  ]
  const tangLeft: Point2D[] = [
    { x: -shankHalfWidth, y: h },
    { x: -shankHalfWidth, y: h - 6 },
    { x: -4.2, y: h - 8 },
    { x: -4.2, y: h - 12 },
    { x: -shankHalfWidth, y: h - 14 },
    { x: -shankHalfWidth, y: tangBottomY },
  ]

  if (punch.type === 'straight') {
    // European Standard Straight Punch (e.g. Rolleri 10.126 / P-105.88)
    // Symmetrical 24mm thick body (half-width 12mm), slender nose tapering at halfAngle
    const bodyHalfWidth = 12.0
    const taperH = Math.min(18, Math.max(8, (bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad)))
    const taperW = taperH * Math.tan(halfAngleRad) + tipRadius

    return [
      { x: 0, y: 0 }, // Tip at (0,0)
      { x: taperW, y: taperH }, // Right nose taper
      { x: bodyHalfWidth, y: taperH + 4 }, // Transition to body
      { x: bodyHalfWidth, y: tangBottomY }, // Shoulder right
      ...tangRight,
      ...tangLeft,
      { x: -bodyHalfWidth, y: tangBottomY }, // Shoulder left
      { x: -bodyHalfWidth, y: taperH + 4 }, // Transition left
      { x: -taperW, y: taperH }, // Left nose taper
    ]
  }

  if (punch.type === 'gooseneck') {
    // Standard European Swan-Neck Gooseneck Punch (e.g. Promecam 10.110 / Rolleri P.130.88 / P-120.88)
    // Deep throat clearance pocket on the front (-X) for return flanges and box shapes
    const reliefDepth = punch.throatRelief || 55
    const reliefH = punch.throatHeight || 55
    const bodyRearWidth = 12.0

    // Nose taper at tip
    const noseH = 8
    const noseRightW = noseH * Math.tan(halfAngleRad) + tipRadius
    const noseLeftW = noseH * Math.tan(halfAngleRad) + tipRadius

    // Rear face (+X towards backgauge): solid structural contour
    const rearPts: Point2D[] = [
      { x: noseRightW, y: noseH },
      { x: bodyRearWidth - 3, y: 25 },
      { x: bodyRearWidth, y: 60 },
      { x: bodyRearWidth + 1, y: tangBottomY },
    ]

    // Front throat curve (-X towards operator): authentic smooth C-shaped pocket
    const frontPts: Point2D[] = [
      { x: -bodyRearWidth, y: tangBottomY }, // Shoulder left
      { x: -16, y: Math.min(tangBottomY - 6, reliefH + 32) },
      { x: -reliefDepth * 0.55, y: reliefH + 24 }, // Upper curve
      { x: -reliefDepth * 0.85, y: reliefH + 14 },
      { x: -reliefDepth, y: reliefH }, // Deepest throat point
      { x: -reliefDepth * 0.95, y: reliefH - 12 },
      { x: -reliefDepth * 0.70, y: Math.max(noseH + 12, reliefH - 24) }, // Lower curve
      { x: -reliefDepth * 0.40, y: noseH + 8 },
      { x: -noseLeftW - 3, y: noseH + 3 },
      { x: -noseLeftW, y: noseH }, // Left nose taper
    ]

    return [
      { x: 0, y: 0 }, // Tip
      ...rearPts,
      ...tangRight,
      ...tangLeft,
      ...frontPts,
    ]
  }

  if (punch.type === 'acute') {
    // 30° Acute air-bending punch (e.g. Promecam 10.108 / 10.109 / P-105.30)
    // Slender nose extending ~35mm up before widening to standard body
    const bodyHalfWidth = 12.5
    const acuteNoseH = Math.min(42, Math.max(25, ((bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad)) * 0.9))
    const noseW = acuteNoseH * Math.tan(halfAngleRad) + tipRadius

    return [
      { x: 0, y: 0 },
      { x: noseW, y: acuteNoseH },
      { x: bodyHalfWidth, y: acuteNoseH + 8 },
      { x: bodyHalfWidth, y: tangBottomY },
      ...tangRight,
      ...tangLeft,
      { x: -bodyHalfWidth, y: tangBottomY },
      { x: -bodyHalfWidth, y: acuteNoseH + 8 },
      { x: -noseW, y: acuteNoseH },
    ]
  }

  // Sash / Sword Punch (e.g. 10.120 / P-105.86, 86° narrow profile punch)
  const bodyHalfWidth = 8.5
  const taperH = Math.min(14, (bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad))
  const taperW = taperH * Math.tan(halfAngleRad) + tipRadius

  return [
    { x: 0, y: 0 },
    { x: taperW, y: taperH },
    { x: bodyHalfWidth, y: taperH + 5 },
    { x: bodyHalfWidth, y: tangBottomY - 12 },
    { x: 12, y: tangBottomY },
    ...tangRight,
    ...tangLeft,
    { x: -12, y: tangBottomY },
    { x: -bodyHalfWidth, y: tangBottomY - 12 },
    { x: -bodyHalfWidth, y: taperH + 5 },
    { x: -taperW, y: taperH },
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
